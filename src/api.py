"""FastAPI backend for Magentic UI with WebSocket support for real-time updates."""

import asyncio
import logging
import os
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .config import Config
from .tools import ToolManager
from .agents import MetaAgentSystem
from .agents.token_tracker import reset_tracker, get_tracker
from .langgraph_runner import LangGraphExecutor
from .engines.ropex_executor import RopexExecutor
from .database import (
    get_db,
    get_or_create_user,
    save_conversation,
    get_user_conversations,
    update_user_activity,
    UserProfile,
    create_user,
    authenticate_user,
    create_chat_session,
    get_chat_session,
    get_user_chat_sessions,
    update_chat_session_title,
    delete_chat_session,
    add_chat_message,
    get_chat_messages,
    SessionLocal,
    Artifact,
)
from .services.rag import RAGService
from .services.mcp_client import MCPClient
from .metrics import (
    setup_metrics,
    get_metrics_middleware,
    add_metrics_endpoint,
    record_websocket_connect,
    record_websocket_disconnect,
    record_websocket_message,
    record_tokens,
    record_cost,
    record_error,
    track_query,
    PROMETHEUS_AVAILABLE,
)

logger = logging.getLogger(__name__)


class RegisterRequest(BaseModel):
    """Register request model."""

    username: str
    password: str


class LoginRequest(BaseModel):
    """Login request model."""

    username: str
    password: str


app = FastAPI(
    title="Magentic API",
    version="1.3.0",
    description="""
## Magentic - Dynamic Multi-Agent AI Orchestration

Magentic is an AI orchestrator that analyzes queries and deploys specialized agents to tackle each part.

### Features
- **Dynamic Planning** - AI creates optimal agent networks per query
- **Parallel Execution** - Agents run simultaneously via LangGraph DAG
- **Real-time Streaming** - WebSocket updates with streaming logs
- **Usage Tracking** - Token counts and cost tracking per user

### Authentication
Most endpoints require JWT authentication. Get a token via `/auth/jwt/login`.

### WebSocket
Connect to `/ws` for real-time query execution with streaming updates.
    """,
    docs_url="/docs",  # Swagger UI
    redoc_url="/redoc",  # ReDoc
    openapi_url="/openapi.json",
    openapi_tags=[
        {"name": "auth", "description": "Authentication endpoints (JWT)"},
        {"name": "profile", "description": "User profile management"},
        {"name": "chat", "description": "Chat sessions and history"},
        {"name": "query", "description": "Query execution"},
        {"name": "documents", "description": "Document upload for RAG"},
        {"name": "memory", "description": "Conversation memory management"},
        {"name": "health", "description": "Health checks and system info"},
    ],
)

# Import and include auth router (using fastapi-users)
from .auth.router import router as auth_router
from .auth.users import create_db_and_tables
app.include_router(auth_router)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081", "http://localhost:8080", "http://localhost:5173", "http://localhost:3000"],  # React dev servers
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Prometheus metrics middleware and endpoint (must be added before app starts)
metrics_middleware = get_metrics_middleware()
if metrics_middleware:
    app.add_middleware(metrics_middleware)
add_metrics_endpoint(app)

# Global instances
config: Config = None  # type: ignore
meta_system: MetaAgentSystem = None  # type: ignore
executor: Any = None  # LangGraphExecutor | RopexExecutor

# Active WebSocket connections
active_connections: List[WebSocket] = []

# Cancellation tokens for active executions (websocket -> Event)
cancellation_tokens: Dict[WebSocket, asyncio.Event] = {}


class QueryRequest(BaseModel):
    """Query request model."""

    query: str


class QueryResponse(BaseModel):
    """Query response model."""

    success: bool
    message: str
    session_id: str = ""


@app.on_event("startup")
async def startup_event():
    """Initialize the system on startup."""
    global config, meta_system, executor

    logger.info("🚀 Starting Magentic API...")
    
    # Run database migrations first
    from .database import run_migrations
    run_migrations()
    logger.info("✓ Database migrations complete")
    
    # Set Prometheus app info (middleware/endpoint already registered at module load)
    setup_metrics(app, version="2.0.0")
    
    # Create fastapi-users database tables
    await create_db_and_tables()
    logger.info("✓ Auth database tables ready")

    # Load configuration
    config = Config()
    is_valid, error_msg = config.validate()
    if not is_valid:
        raise RuntimeError(f"Invalid configuration: {error_msg}")

    # Ropex path: HTTP + SSE only — do NOT initialize or fall back to LangGraph
    if config.execution_engine == "ropex":
        executor = RopexExecutor(base_url=config.ropex_base_url)
        logger.info(
            "✓ Ropex executor ready (%s) — LangGraph skipped",
            config.ropex_base_url,
        )
        return

    # Initialize RAG service (optional)
    global rag_service
    if config.enable_rag:
        try:
            rag_service = RAGService(
                persist_directory=config.rag_persist_directory,
                qdrant_mode=config.rag_qdrant_mode,
                qdrant_url=config.rag_qdrant_url,
                qdrant_collection=config.rag_qdrant_collection,
                chunk_size=config.rag_chunk_size,
                chunk_overlap=config.rag_chunk_overlap,
                embedding_provider=config.rag_embedding_provider,
                embedding_model=config.rag_embedding_model,
                ollama_base_url=config.rag_ollama_base_url,
            )
            logger.info("✓ RAG service initialized")
        except Exception as e:
            logger.warning(f"RAG service initialization failed: {e}")

    # Initialize MCP client (optional)
    mcp_client = None
    if config.enable_mcp:
        try:
            mcp_client = MCPClient(gateway_url=config.mcp_gateway_url)
            health = await mcp_client.health_check()
            if health.get("status") == "healthy":
                healthy_servers = health.get("healthy_servers", 0)
                total_servers = health.get("total_servers", 0)
                logger.info(
                    f"✓ MCP Gateway ready: {healthy_servers}/{total_servers} servers healthy"
                )
                # Set MCP gateway metric
                from .metrics import MCP_GATEWAY_UP
                if MCP_GATEWAY_UP:
                    MCP_GATEWAY_UP.set(1)
            else:
                logger.warning("MCP Gateway health check failed")
                from .metrics import MCP_GATEWAY_UP
                if MCP_GATEWAY_UP:
                    MCP_GATEWAY_UP.set(0)
                mcp_client = None
        except Exception as e:
            logger.warning(f"MCP client initialization failed: {e}")
            from .metrics import MCP_GATEWAY_UP
            if MCP_GATEWAY_UP:
                MCP_GATEWAY_UP.set(0)
            mcp_client = None

    # Initialize tools with RAG and MCP support
    tool_manager = ToolManager(rag_service=rag_service, mcp_client=mcp_client)
    tools = await tool_manager.initialize_tools()
    logger.info(f"✓ Loaded {len(tools)} tools")

    # Initialize meta-agent system with RAG for active retrieval and tool manager
    meta_system = MetaAgentSystem(config, tools, rag_service=rag_service, tool_manager=tool_manager)
    logger.info("✓ Meta-agent system initialized")

    # Pre-cache MCP tools for all roles to avoid async/sync issues during execution
    if mcp_client:
        logger.info("🔧 Pre-caching role tools...")
        await meta_system.agent_executor.pre_cache_role_tools()
        logger.info("✓ Role tools pre-cached")

    # Initialize executor
    executor = LangGraphExecutor(meta_system)
    logger.info("✓ LangGraph executor ready")

    # Warm up
    meta_system.coordinator.warmup()
    logger.info("✓ System warmed up")


@app.get("/", tags=["health"])
async def root():
    """Root endpoint - API info and status."""
    return {
        "name": "Magentic API",
        "version": "1.3.0",
        "status": "ready",
        "llm_provider": config.llm_provider if config else "unknown",
        "execution_engine": config.execution_engine if config else "unknown",
    }


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint - verify API is running."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "llm_provider": config.llm_provider if config else "unknown",
        "execution_engine": config.execution_engine if config else "unknown",
    }


@app.get("/pricing", tags=["health"])
async def get_pricing():
    """Get LLM pricing information for token cost calculation."""
    from .pricing import get_pricing_table_summary, get_model_pricing
    
    current_model_pricing = None
    if config:
        pricing = get_model_pricing(config.llm_provider, config.get_model_name())
        if pricing:
            current_model_pricing = {
                "provider": config.llm_provider,
                "model": config.get_model_name(),
                "input_cost_per_1m": pricing.input_cost,
                "output_cost_per_1m": pricing.output_cost,
            }
    
    return {
        "current_model": current_model_pricing,
        "pricing_table": get_pricing_table_summary(),
    }


@app.get("/roles", tags=["health"])
async def get_roles():
    """Get all available agent roles for the frontend.
    
    Returns role configurations loaded from config/roles.yaml.
    Frontend uses this for dynamic role icons and labels.
    """
    from .role_library import RoleLibrary
    
    try:
        role_library = RoleLibrary()
        return {
            "success": True,
            "roles": role_library.get_all_roles_config(),
        }
    except Exception as e:
        logger.warning(f"Failed to load roles: {e}")
        return {
            "success": False,
            "roles": {},
            "error": str(e),
        }


@app.post("/roles/reload", tags=["health"])
async def reload_roles():
    """Reload roles from YAML config file.
    
    Use this after editing config/roles.yaml to apply changes
    without restarting the server.
    """
    from .role_library import RoleLibrary
    
    try:
        role_library = RoleLibrary()
        return {
            "success": True,
            "message": f"Reloaded {len(role_library.roles)} roles",
            "roles": role_library.get_all_roles_config(),
        }
    except Exception as e:
        logger.error(f"Failed to reload roles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/profile/{username}", tags=["profile"])
async def get_profile(username: str, db: Session = Depends(get_db)):
    """Get user profile by username."""
    user = get_or_create_user(db, username, is_guest=True)
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_emoji": user.avatar_emoji,
        "is_guest": user.is_guest,
        "created_at": user.created_at.isoformat(),
        "last_active": user.last_active.isoformat(),
        "theme": user.theme,
        "show_execution_details": bool(user.show_execution_details),
        "stats": {
            "total_queries": user.total_queries,
            "total_agents_executed": user.total_agents_executed,
            "total_tokens_used": user.total_tokens_used or 0,
            "total_cost": user.total_cost or 0.0,
        },
    }


@app.post("/register", tags=["auth"], deprecated=True)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user (deprecated - use /auth/register instead)."""
    if len(request.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")

    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user, error = create_user(db, request.username, request.password)

    if error or not user:
        raise HTTPException(status_code=400, detail=error or "Failed to create user")

    return {
        "success": True,
        "message": "User registered successfully",
        "user": {
            "id": user.id,  # type: ignore
            "username": user.username,  # type: ignore
            "display_name": user.display_name,  # type: ignore
            "avatar_emoji": user.avatar_emoji,  # type: ignore
        },
    }


@app.post("/login", tags=["auth"], deprecated=True)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login user (deprecated - use /auth/jwt/login instead)."""
    user, error = authenticate_user(db, request.username, request.password)

    if error or not user:
        raise HTTPException(status_code=401, detail=error or "Authentication failed")

    return {
        "success": True,
        "message": "Login successful",
        "user": {
            "id": user.id,  # type: ignore
            "username": user.username,  # type: ignore
            "display_name": user.display_name,  # type: ignore
            "avatar_emoji": user.avatar_emoji,  # type: ignore
            "is_guest": user.is_guest,  # type: ignore
        },
    }


@app.put("/profile/{username}", tags=["profile"])
async def update_profile(username: str, updates: dict, db: Session = Depends(get_db)):
    """Update user profile settings (display name, avatar, theme)."""
    user = get_or_create_user(db, username)

    if "display_name" in updates:
        user.display_name = updates["display_name"]
    if "avatar_emoji" in updates:
        user.avatar_emoji = updates["avatar_emoji"]
    if "theme" in updates:
        user.theme = updates["theme"]
    if "show_execution_details" in updates:
        setattr(user, "show_execution_details", 1 if updates["show_execution_details"] else 0)

    update_user_activity(db, user.id)  # type: ignore

    return {"success": True, "message": "Profile updated"}


@app.get("/history/{username}", tags=["chat"])
async def get_history(username: str, limit: int = 50, db: Session = Depends(get_db)):
    """Get conversation history for user (queries and responses)."""
    user = get_or_create_user(db, username)
    conversations = get_user_conversations(db, user.id, limit)  # type: ignore

    return {
        "username": username,
        "total": len(conversations),
        "conversations": [
            {
                "id": conv.id,
                "timestamp": conv.timestamp.isoformat(),
                "query": conv.query,
                "response": conv.response,
                "agents_used": conv.agents_used,
                "execution_time": conv.execution_time,
            }
            for conv in conversations
        ],
    }


# ============== Chat Session Endpoints ==============


class CreateChatRequest(BaseModel):
    """Create chat session request."""

    username: str
    title: str = "New Chat"


class UpdateChatTitleRequest(BaseModel):
    """Update chat title request."""

    title: str


class AddMessageRequest(BaseModel):
    """Add message to chat request."""

    role: str  # 'user' or 'assistant'
    content: str
    execution_data: Optional[dict] = None


@app.post("/chats", tags=["chat"])
async def create_chat(request: CreateChatRequest, db: Session = Depends(get_db)):
    """Create a new chat session."""
    user = get_or_create_user(db, request.username)
    user_id = int(user.id)  # type: ignore[arg-type]
    session_id = f"chat_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{user_id}"

    session = create_chat_session(db, user_id, session_id, request.title)

    return {
        "success": True,
        "chat": {
            "id": session.session_id,
            "title": session.title,
            "createdAt": session.created_at.isoformat(),
            "updatedAt": session.updated_at.isoformat(),
            "messages": [],
        },
    }


@app.get("/chats/{username}", tags=["chat"])
async def get_user_chats(username: str, limit: int = 50, db: Session = Depends(get_db)):
    """Get all chat sessions for a user."""
    user = get_or_create_user(db, username)
    sessions = get_user_chat_sessions(db, int(user.id), limit)  # type: ignore[arg-type]

    return {
        "username": username,
        "total": len(sessions),
        "chats": [
            {
                "id": s.session_id,
                "title": s.title,
                "createdAt": s.created_at.isoformat(),
                "updatedAt": s.updated_at.isoformat(),
                "messageCount": len(s.messages),
            }
            for s in sessions
        ],
    }


@app.get("/chats/{username}/{session_id}", tags=["chat"])
async def get_chat(username: str, session_id: str, db: Session = Depends(get_db)):
    """Get a specific chat session with all messages."""
    session = get_chat_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat not found")

    messages = get_chat_messages(db, session_id)

    return {
        "id": session.session_id,
        "title": session.title,
        "createdAt": session.created_at.isoformat(),
        "updatedAt": session.updated_at.isoformat(),
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "timestamp": m.timestamp.isoformat(),
                "executionData": m.execution_data,
            }
            for m in messages
        ],
    }


@app.patch("/chats/{session_id}", tags=["chat"])
async def update_chat(
    session_id: str, request: UpdateChatTitleRequest, db: Session = Depends(get_db)
):
    """Update chat session title."""
    session = update_chat_session_title(db, session_id, request.title)
    if not session:
        raise HTTPException(status_code=404, detail="Chat not found")

    return {"success": True, "title": session.title}


@app.delete("/chats/{session_id}", tags=["chat"])
async def delete_chat(session_id: str, db: Session = Depends(get_db)):
    """Delete a chat session."""
    success = delete_chat_session(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found")

    return {"success": True}


@app.post("/chats/{session_id}/messages", tags=["chat"])
async def add_message(session_id: str, request: AddMessageRequest, db: Session = Depends(get_db)):
    """Add a message to a chat session."""
    message = add_chat_message(
        db, session_id, request.role, request.content, request.execution_data
    )
    if not message:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Get updated session for new title
    session = get_chat_session(db, session_id)

    return {
        "success": True,
        "message": {
            "id": str(message.id),
            "role": message.role,
            "content": message.content,
            "timestamp": message.timestamp.isoformat(),
        },
        "chatTitle": session.title if session else "New Chat",
    }


@app.post("/query", response_model=QueryResponse, tags=["query"])
async def process_query(request: QueryRequest):
    """Process a query (non-streaming endpoint)."""
    try:
        if not executor:
            raise HTTPException(status_code=503, detail="System not initialized")

        result = await executor.execute_query(request.query)

        return QueryResponse(
            success=True,
            message=result.get("final_output", "No output generated"),
            session_id=result.get("session_id", ""),
        )
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time query processing."""
    await websocket.accept()
    active_connections.append(websocket)
    record_websocket_connect()

    # Get username from query params or default to guest
    username = websocket.query_params.get("username", "guest")
    
    # Current execution task (if any)
    current_task: Optional[asyncio.Task] = None
    cancel_event: Optional[asyncio.Event] = None
    
    # Track current query and session for saving stopped message
    current_query: Optional[str] = None
    current_session_id: Optional[str] = None

    async def handle_message(message_data: dict):
        """Handle incoming WebSocket message."""
        nonlocal current_task, cancel_event, current_query, current_session_id
        
        message_type = message_data.get("type", "")
        
        # Handle stop message
        if message_type == "stop":
            logger.info("Stop message received")
            if cancel_event is not None:
                cancel_event.set()
                logger.info("Cancellation signal sent to running execution")
            if current_task is not None and not current_task.done():
                current_task.cancel()
                logger.info("Execution task cancelled")
            
            # Save stopped message to database if we have a session
            stopped_message = "Execution stopped by user"
            if current_session_id and not username.startswith("guest"):
                try:
                    from .database import SessionLocal
                    db = SessionLocal()
                    try:
                        add_chat_message(db, current_session_id, "assistant", stopped_message, None)
                        logger.info(f"Saved stopped message to session {current_session_id}")
                    finally:
                        db.close()
                except Exception as e:
                    logger.error(f"Failed to save stopped message: {e}")
            
            await websocket.send_json({
                "type": "stopped",
                "message": stopped_message
            })
            
            # Clear current query/session
            current_query = None
            current_session_id = None
            return
        
        # Handle query message
        query = message_data.get("query", "")
        session_id = message_data.get("session_id", "")
        logger.info(f"📝 Received query with session_id='{session_id}'")
        if not query:
            await websocket.send_json({"type": "error", "message": "Empty query"})
            return

        # Cancel any previous execution
        if current_task is not None and not current_task.done():
            if cancel_event is not None:
                cancel_event.set()
            current_task.cancel()
            try:
                await current_task
            except asyncio.CancelledError:
                pass

        # Track current query and session
        current_query = query
        current_session_id = session_id if session_id else None

        # Create new cancellation token
        cancel_event = asyncio.Event()
        cancellation_tokens[websocket] = cancel_event

        # Send acknowledgment
        await websocket.send_json(
            {"type": "status", "message": "Processing query...", "stage": "received"}
        )

        # Start query processing as a task
        async def run_query():
            nonlocal current_query, current_session_id
            try:
                await process_query_with_updates(
                    websocket, query, username, cancel_event, 
                    session_id=current_session_id
                )
            except asyncio.CancelledError:
                logger.info("Query processing cancelled")
                # Don't send stopped message here - it's sent by handle_message
            except Exception as e:
                logger.error(f"Error processing query: {e}")
                try:
                    await websocket.send_json({"type": "error", "message": str(e)})
                except Exception:
                    pass
            finally:
                if websocket in cancellation_tokens:
                    del cancellation_tokens[websocket]
                # Clear tracking after completion
                current_query = None
                current_session_id = None

        current_task = asyncio.create_task(run_query())

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            query_data = json.loads(data)
            await handle_message(query_data)

    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
        record_websocket_disconnect()
        # Cancel any running execution
        if cancel_event is not None:
            cancel_event.set()
        if current_task is not None and not current_task.done():
            current_task.cancel()
        if websocket in cancellation_tokens:
            del cancellation_tokens[websocket]
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        record_error(type(e).__name__, 'websocket')
        if websocket in active_connections:
            active_connections.remove(websocket)
        record_websocket_disconnect()
        if websocket in cancellation_tokens:
            del cancellation_tokens[websocket]


async def process_query_with_updates(
    websocket: WebSocket, 
    query: str, 
    username: str = "guest",
    cancel_event: Optional[asyncio.Event] = None,
    session_id: Optional[str] = None
):
    """Process query and send real-time updates via WebSocket."""
    try:
        # Ropex engine: relay SSE → WebSocket; never fall back to LangGraph
        if config and config.execution_engine == "ropex":
            if not isinstance(executor, RopexExecutor):
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "EXECUTION_ENGINE=ropex but RopexExecutor is not initialized",
                    }
                )
                return
            await _process_query_via_ropex(
                websocket, query, username, cancel_event, session_id=session_id
            )
            return

        # Helper to check if cancelled
        def is_cancelled():
            return cancel_event is not None and cancel_event.is_set()
        
        # Reset token tracker for this execution with LLM info
        reset_tracker(provider=config.llm_provider, model=config.get_model_name())

        # Load and set session-specific conversation history
        if session_id:
            try:
                from .database import SessionLocal
                db = SessionLocal()
                try:
                    messages = get_chat_messages(db, session_id)
                    logger.info(f"📚 Raw messages from DB for session {session_id}: {len(messages)} messages")
                    for i, m in enumerate(messages):
                        logger.info(f"📚   [{i}] {m.role}: {m.content[:80]}...")
                    # Convert to conversation history format (cast to str for type safety)
                    history: list[dict[str, str]] = [
                        {"role": str(m.role), "content": str(m.content)}
                        for m in messages
                    ]
                    meta_system.load_session_history(session_id, history)
                    meta_system.set_session(session_id)
                    logger.info(f"📚 Loaded {len(history)} messages from session {session_id}")
                    if history:
                        logger.info(f"📚 First message: {history[0]['role']}: {history[0]['content'][:100]}...")
                        logger.info(f"📚 Last message: {history[-1]['role']}: {history[-1]['content'][:100]}...")
                    logger.info(f"📚 Current conversation_history length: {len(meta_system.conversation_history)}")
                finally:
                    db.close()
            except Exception as e:
                logger.warning(f"Failed to load session history: {e}", exc_info=True)
                meta_system.set_session(None)
        else:
            meta_system.set_session(None)
            logger.info("📚 No session_id provided, using empty conversation history")

        # Check cancellation before starting
        if is_cancelled():
            raise asyncio.CancelledError("Execution cancelled before start")

        # === COORDINATOR AS LAYER 0 ===
        # Send coordinator as the first "agent" in the flow
        coordinator_agent_id = "coordinator_0"
        
        # Send initial plan with just coordinator (Layer 0)
        await websocket.send_json({
            "type": "plan",
            "data": {
                "description": "Analyzing query and creating execution plan...",
                "agents": [{
                    "agent_id": coordinator_agent_id,
                    "role": "coordinator",
                    "task": "Analyze query and determine which specialized agents to deploy",
                    "layer": 0,
                    "status": "pending",
                }],
                "total_agents": 1,
                "total_layers": 1,
                "is_planning": True,  # Flag to indicate more agents may be added
            },
        })

        # Send coordinator start
        await websocket.send_json({
            "type": "agent_start",
            "data": {
                "agent_id": coordinator_agent_id,
                "role": "coordinator",
                "task": "Analyze query and create execution plan",
                "input": query[:500],
            },
        })

        # Build conversation context for the coordinator
        conversation_context = meta_system._build_context()
        logger.info(f"📚 Coordinator context length: {len(conversation_context)} chars")
        logger.info(f"📚 Coordinator context content: {conversation_context[:500]}..." if conversation_context else "📚 NO CONVERSATION CONTEXT - history is empty")
        logger.info(f"📚 meta_system.conversation_history: {meta_system.conversation_history}")

        # Create execution plan - use streaming for thinking models
        if config.is_thinking_model():
            # Use streaming planning to show thinking process
            async def thinking_callback(content: str):
                await websocket.send_json({
                    "type": "agent_log",
                    "data": {
                        "agent_id": coordinator_agent_id,
                        "log_type": "thinking",
                        "content": content,
                        "metadata": {},
                    },
                })
            
            plan = await meta_system.coordinator.create_execution_plan_with_thinking(
                query, 
                conversation_history=conversation_context,
                thinking_callback=thinking_callback
            )
        else:
            # Regular planning without thinking stream
            plan = meta_system.coordinator.create_execution_plan(query, conversation_context)

        # Check cancellation after planning
        if is_cancelled():
            raise asyncio.CancelledError("Execution cancelled after planning")

        # Compute layers for each agent (offset by 1 since coordinator is layer 0)
        layers = plan.get_execution_layers()
        agent_to_layer = {}
        for layer_idx, layer_agents in enumerate(layers):
            for agent_idx in layer_agents:
                agent_to_layer[agent_idx] = layer_idx + 1  # +1 because coordinator is layer 0

        # Convert plan to dict for database storage
        plan_dict = {
            "description": plan.description,
            "agents": plan.agents,
            "total_agents": len(plan.agents),
            "total_layers": len(layers),
        }

        # Build agents data with agent_ids (layer numbers offset by 1)
        agents_data = [
            {
                "agent_id": f"{agent.get('role')}_{idx}",
                "role": agent.get("role"),
                "task": agent.get("task"),
                "layer": agent_to_layer.get(idx, 1),  # Default to layer 1
            }
            for idx, agent in enumerate(plan.agents)
        ]

        # Log agent IDs being sent
        logger.info(f"Plan agent IDs: {[a['agent_id'] for a in agents_data]}")

        # Get coordinator token usage from tracker
        tracker = get_tracker()
        coordinator_tokens = tracker.planning_tokens.to_dict()
        logger.info(f"💰 Coordinator tokens: {coordinator_tokens}")

        # Send coordinator complete with plan description as output
        await websocket.send_json({
            "type": "agent_complete",
            "data": {
                "agent_id": coordinator_agent_id,
                "role": "coordinator",
                "input": query[:500],
                "output": f"Plan: {plan.description}\n\nDeploying {len(plan.agents)} specialized agents across {len(layers)} execution layers.",
                "output_length": len(plan.description),
                "tool_calls": [],
                "token_usage": coordinator_tokens,
            },
        })

        # Send updated plan with all agents (coordinator + execution agents)
        # Mark layer 1 agents as 'running' since they start immediately after coordinator
        all_agents_data = [
            {
                "agent_id": coordinator_agent_id,
                "role": "coordinator",
                "task": "Analyze query and create execution plan",
                "layer": 0,
                "status": "complete",  # Use 'complete' to match frontend constant
            }
        ] + [{
            **agent,
            # Layer 1 agents start immediately, others are pending
            "status": "running" if agent.get("layer") == 1 else "pending",
        } for agent in agents_data]

        await websocket.send_json({
            "type": "plan",
            "data": {
                "description": plan.description,
                "agents": all_agents_data,
                "total_agents": len(plan.agents) + 1,  # +1 for coordinator
                "total_layers": len(layers) + 1,  # +1 for coordinator layer
            },
        })

        # Send execution stage
        await websocket.send_json(
            {
                "type": "stage",
                "stage": "executing",
                "message": f"Executing {len(plan.agents)} agents...",
            }
        )

        # Check cancellation before execution
        if is_cancelled():
            raise asyncio.CancelledError("Execution cancelled before agent execution")

        # Set up TRUE streaming for the final agent (last agent in plan)
        # This enables real-time token streaming from Claude/OpenAI APIs
        last_agent_id = None
        stream_started = {"value": False}
        
        if plan.agents:
            last_agent = plan.agents[-1]
            last_agent_id = f"{last_agent['role']}_{len(plan.agents)-1}"
            logger.info(f"🌊 Setting up TRUE streaming for final agent: {last_agent_id}")
            
            async def stream_token_callback(token: str):
                """Send streaming tokens to WebSocket in real-time."""
                # Send stream_start on first token
                if not stream_started["value"]:
                    stream_started["value"] = True
                    await websocket.send_json({
                        "type": "stream_start",
                        "data": {"agent_id": last_agent_id}
                    })
                
                await websocket.send_json({
                    "type": "stream_token",
                    "token": token
                })
            
            # Set the callback on meta_system for TRUE streaming
            meta_system.set_stream_callback(stream_token_callback, last_agent_id)

        # Execute with custom callback for progress - pass the SAME plan and cancel_event
        result = await execute_with_progress(websocket, query, plan, cancel_event)
        
        # Send stream_end if streaming was active
        if last_agent_id and stream_started["value"]:
            await websocket.send_json({
                "type": "stream_end",
                "data": {"agent_id": last_agent_id}
            })
        
        # If streaming was NOT active (agent needed tools), stream the final output now
        # This provides the streaming UX even when real-time streaming wasn't possible
        final_output = result.get("final_output", "")
        if last_agent_id and not stream_started["value"] and final_output:
            logger.info(f"📤 Post-execution streaming for tools-using agent")
            await websocket.send_json({
                "type": "stream_start",
                "data": {"agent_id": last_agent_id}
            })
            
            # Stream the output in chunks for smooth display
            chunk_size = 20  # Characters per chunk
            for i in range(0, len(final_output), chunk_size):
                chunk = final_output[i:i + chunk_size]
                await websocket.send_json({
                    "type": "stream_token",
                    "token": chunk
                })
                await asyncio.sleep(0.01)  # Small delay for smooth streaming
            
            await websocket.send_json({
                "type": "stream_end",
                "data": {"agent_id": last_agent_id}
            })
        
        # Clear the stream callback
        meta_system.set_stream_callback(None, None)

        # Wait to ensure all agent_complete events are sent before the final complete event
        await asyncio.sleep(0.2)

        final_output = result.get("final_output", "")
        session_id = result.get("session_id", "")

        # Get token usage summary BEFORE saving to include in DB
        tracker = get_tracker()
        token_summary = tracker.get_summary()

        # Save conversation to database (only for registered users, not guests)
        try:
            from .database import SessionLocal

            db = SessionLocal()
            try:
                user = get_or_create_user(db, username, is_guest=username.startswith("guest_"))

                # Only save conversations for registered users
                if not user.is_guest:  # type: ignore
                    save_conversation(db, user.id, query, final_output, plan_dict, session_id, token_summary)  # type: ignore
                    logger.info(f"Saved conversation for user {username}")
                    
                    # Also save to ChatMessage table for session history
                    # This ensures conversation history is available for future queries
                    if session_id:
                        add_chat_message(db, session_id, "user", query)
                        add_chat_message(db, session_id, "assistant", final_output, {"token_usage": token_summary})
                        logger.info(f"Saved messages to chat session {session_id}")
                else:
                    logger.info(f"Skipped saving conversation for guest user {username}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to save conversation: {e}")

        # NOTE: TRUE streaming now happens DURING execution via stream_token_callback
        # No need for fake post-completion streaming anymore

        await websocket.send_json(
            {
                "type": "complete",
                "data": {
                    "output": final_output,
                    "session_id": session_id,
                    "execution_time": result.get("execution_time", 0),
                    "token_usage": token_summary,
                    "references": result.get("references", []),
                    "artifacts": result.get("artifacts", []),
                },
            }
        )

    except asyncio.CancelledError:
        logger.info("Query processing was cancelled")
        # Re-raise to be handled by the caller
        raise
    except Exception as e:
        logger.error(f"Error in process_query_with_updates: {e}")
        await websocket.send_json({"type": "error", "message": str(e)})


async def _process_query_via_ropex(
    websocket: WebSocket,
    query: str,
    username: str = "guest",
    cancel_event: Optional[asyncio.Event] = None,
    session_id: Optional[str] = None,
):
    """Delegate execution to Ropex and relay format=ui SSE events to the WebSocket."""
    assert isinstance(executor, RopexExecutor)

    async def send_json(payload: Dict[str, Any]) -> None:
        await websocket.send_json(payload)

    result = await executor.relay_to_websocket(send_json, query, cancel_event=cancel_event)
    final_output = result.get("final_output", "")
    pipeline_id = result.get("session_id", "")
    save_session_id = session_id or pipeline_id

    try:
        from .database import SessionLocal

        db = SessionLocal()
        try:
            user = get_or_create_user(db, username, is_guest=username.startswith("guest_"))
            if not user.is_guest:  # type: ignore
                save_conversation(
                    db,
                    user.id,
                    query,
                    final_output,
                    {"engine": "ropex", "pipeline_id": pipeline_id},
                    save_session_id,
                    None,
                )
                if save_session_id:
                    add_chat_message(db, save_session_id, "user", query)
                    add_chat_message(
                        db,
                        save_session_id,
                        "assistant",
                        final_output,
                        {"engine": "ropex", "pipeline_id": pipeline_id},
                    )
                logger.info(f"Saved Ropex conversation for user {username}")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to save Ropex conversation: {e}")


async def execute_with_progress(
    websocket: WebSocket, 
    query: str, 
    plan,
    cancel_event: Optional[asyncio.Event] = None
) -> Dict[str, Any]:
    """Execute query and send progress updates.

    Args:
        websocket: WebSocket connection for sending updates
        query: User query to process
        plan: ExecutionPlan to use (same plan sent to frontend)
        cancel_event: Optional event to signal cancellation
    """
    import queue
    import threading

    # Helper to check if cancelled
    def is_cancelled():
        return cancel_event is not None and cancel_event.is_set()

    # Set up log callback for streaming agent logs
    # Use a thread-safe queue since executor runs in thread pool
    log_queue = queue.Queue()
    stop_log_consumer = threading.Event()
    
    async def log_consumer():
        """Consume logs from the queue and send via WebSocket."""
        while not stop_log_consumer.is_set():
            try:
                # Non-blocking check with small timeout
                try:
                    log_entry = log_queue.get(timeout=0.05)
                except queue.Empty:
                    await asyncio.sleep(0.01)  # Yield to event loop
                    continue
                
                logger.info(f"📝 Sending agent_log: {log_entry['agent_id']} - {log_entry['log_type']}")
                await websocket.send_json({
                    "type": "agent_log",
                    "data": log_entry,
                })
            except Exception as e:
                logger.warning(f"Failed to send log: {e}")
    
    def log_callback(agent_id: str, log_type: str, content: str, metadata: Optional[Dict[str, Any]] = None):
        """Queue log events for async sending - thread-safe."""
        try:
            log_entry = {
                "agent_id": agent_id,
                "log_type": log_type,
                "content": content,
                "metadata": metadata,
                "timestamp": time.time() * 1000,  # JS-compatible timestamp
            }
            logger.info(f"📝 Log callback called: {agent_id} - {log_type}")
            log_queue.put(log_entry)
        except Exception as e:
            logger.warning(f"Failed to queue log: {e}")
    
    # Set log callback on agent executor
    meta_system.agent_executor.set_log_callback(log_callback)
    
    # Start log consumer task
    log_consumer_task = asyncio.create_task(log_consumer())

    # Monkey-patch the meta_system to send updates
    original_execute = meta_system.execute_agent_for_langgraph

    async def execute_with_notification(*args, **kwargs):
        # Check cancellation before each agent
        if is_cancelled():
            raise asyncio.CancelledError("Execution cancelled")
        
        agent_id = kwargs.get("agent_id", args[0] if args else "unknown")
        role = kwargs.get("role", args[1] if len(args) > 1 else "unknown")
        task = kwargs.get("task", args[2] if len(args) > 2 else "")
        context = kwargs.get("context", args[3] if len(args) > 3 else "")

        # Send agent start
        logger.info(f"Sending agent_start event for {agent_id} ({role})")
        try:
            await websocket.send_json(
                {
                    "type": "agent_start",
                    "data": {
                        "agent_id": agent_id,
                        "role": role,
                        "task": task,
                        "input": (
                            context[: config.ui_display_limit]
                            if context
                            else "(No previous agent outputs)"
                        ),
                    },
                }
            )
        except Exception as e:
            logger.error(f"Failed to send agent_start event: {e}")
            # Continue anyway

        # Execute agent
        try:
            result = await original_execute(*args, **kwargs)
        except Exception as e:
            logger.error(f"Agent {agent_id} execution failed: {e}", exc_info=True)
            # Send error event
            try:
                await websocket.send_json(
                    {
                        "type": "agent_complete",
                        "data": {
                            "agent_id": agent_id,
                            "role": role,
                            "input": (
                                context[: config.ui_display_limit]
                                if context
                                else "(No previous agent outputs)"
                            ),
                            "output": f"[ERROR: {str(e)[:config.ui_display_limit]}]",
                            "output_length": len(str(e)),
                            "tool_calls": [],
                            "error": True,
                        },
                    }
                )
            except Exception as ws_error:
                logger.error(f"Failed to send error event: {ws_error}")
            # Return error as dict to maintain consistency
            return {"content": f"[ERROR: {str(e)}]", "tool_calls": []}

        # Debug logging
        logger.info(f"Agent {agent_id} result type: {type(result)}")

        # Extract content and tool calls from result dict
        if isinstance(result, dict):
            output_str = result.get("content", str(result))
            tool_calls = result.get("tool_calls", [])
            artifacts = result.get("artifacts", [])
            logger.info(f"Agent {agent_id} has {len(tool_calls)} tool calls, {len(artifacts)} artifacts")
        else:
            # Fallback for string results
            output_str = str(result)
            tool_calls = []
            artifacts = []
            logger.warning(f"Agent {agent_id} returned non-dict result: {type(result)}")

        logger.info(f"Agent {agent_id} output: {output_str[:500]}")

        # Check cancellation after agent execution
        if is_cancelled():
            raise asyncio.CancelledError("Execution cancelled after agent completed")

        # Send agent complete with full output and token usage
        logger.info(
            f"Sending agent_complete event for {agent_id} with {len(tool_calls)} tool calls"
        )
        try:
            # Get token usage for this agent
            tracker = get_tracker()
            agent_tokens = tracker.get_agent_summary(agent_id)

            await websocket.send_json(
                {
                    "type": "agent_complete",
                    "data": {
                        "agent_id": agent_id,
                        "role": role,
                        "input": (
                            context[: config.ui_display_limit]
                            if context
                            else "(No previous agent outputs)"
                        ),
                        "output": output_str[: config.ui_display_limit],
                        "output_length": len(output_str),
                        "tool_calls": tool_calls,
                        "token_usage": agent_tokens,
                        "artifacts": artifacts,
                    },
                }
            )
            logger.info(f"✓ Successfully sent agent_complete for {agent_id}")
        except Exception as e:
            logger.error(f"Failed to send agent_complete event: {e}")
            # Continue anyway

        return result

    # Temporarily replace the method
    meta_system.execute_agent_for_langgraph = execute_with_notification  # type: ignore[method-assign]

    try:
        # Pass the SAME plan to executor to ensure consistent agent IDs
        # Pass cancel_event to allow interruption during execution
        result = await executor.execute_query(query, plan=plan, cancel_event=cancel_event)
        return result
    finally:
        # Stop log consumer and drain remaining logs
        stop_log_consumer.set()
        log_consumer_task.cancel()
        try:
            await log_consumer_task
        except asyncio.CancelledError:
            pass
        
        # Send any remaining logs in queue
        while not log_queue.empty():
            try:
                log_entry = log_queue.get_nowait()
                await websocket.send_json({
                    "type": "agent_log",
                    "data": log_entry,
                })
            except:
                break
        
        # Clear log callback
        meta_system.agent_executor.set_log_callback(None)
        
        # Restore original method
        meta_system.execute_agent_for_langgraph = original_execute


# Global RAG service reference (set during startup)
rag_service = None


# =============================================================================
# Artifacts API - File downloads from agent-created files
# =============================================================================

@app.get("/artifacts/{file_path:path}", tags=["artifacts"])
async def get_artifact(file_path: str):
    """Retrieve content of a file created by an agent from database.
    
    Artifacts are saved to the database when created, so we serve directly
    from DB - no dependency on MCP gateway or disk files.
    """
    from .database import Artifact
    
    # Extract just the filename for matching
    filename = file_path.split("/")[-1] if "/" in file_path else file_path
    
    logger.info(f"Fetching artifact: {file_path} (filename: {filename})")
    
    # Determine content type based on file extension
    ext = filename.split(".")[-1].lower() if "." in filename else "txt"
    content_types = {
        "py": "text/x-python",
        "js": "text/javascript",
        "ts": "text/typescript",
        "html": "text/html",
        "css": "text/css",
        "json": "application/json",
        "md": "text/markdown",
        "txt": "text/plain",
        "yaml": "text/yaml",
        "yml": "text/yaml",
        "sql": "text/x-sql",
        "sh": "text/x-sh",
        "csv": "text/csv",
        "xml": "text/xml",
    }
    content_type = content_types.get(ext, "text/plain")
    
    # Get artifact from database
    db = SessionLocal()
    try:
        # Search by exact path first, then by filename
        artifact = db.query(Artifact).filter(Artifact.path == file_path).order_by(Artifact.created_at.desc()).first()
        
        if not artifact:
            # Try with /workspace/ prefix
            artifact = db.query(Artifact).filter(Artifact.path == f"/workspace/{file_path}").order_by(Artifact.created_at.desc()).first()
        
        if not artifact:
            # Try matching just filename
            artifact = db.query(Artifact).filter(Artifact.name == filename).order_by(Artifact.created_at.desc()).first()
        
        if not artifact:
            # Last resort: partial match on path
            artifact = db.query(Artifact).filter(Artifact.path.like(f"%{filename}")).order_by(Artifact.created_at.desc()).first()
        
        if artifact is not None and artifact.content is not None:
            logger.info(f"Found artifact in database: {artifact.name} (id={artifact.id})")
            return Response(
                content=str(artifact.content),
                media_type=content_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{artifact.name}"'
                }
            )
        
        raise HTTPException(status_code=404, detail=f"Artifact not found: {file_path}")
    finally:
        db.close()


@app.get("/artifacts/db/{session_id}", tags=["artifacts"])
async def get_artifacts_by_session(session_id: str):
    """Get all artifacts for an execution session from database.
    
    This retrieves artifacts that were persisted to the database,
    which survive docker restarts.
    """
    from .artifact_service import ArtifactService
    
    artifacts = ArtifactService.get_artifacts_by_session(session_id)
    return {
        "session_id": session_id,
        "artifacts": [ArtifactService.to_dict(a) for a in artifacts]
    }


@app.get("/artifacts/db/{session_id}/{artifact_id}", tags=["artifacts"])
async def get_artifact_content_from_db(session_id: str, artifact_id: int):
    """Get artifact content from database by ID.
    
    Fallback for when the file is no longer on disk.
    """
    from .artifact_service import ArtifactService
    
    content = ArtifactService.get_artifact_content(artifact_id)
    if content is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    
    # Get artifact metadata for content type
    db = SessionLocal()
    try:
        artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        # Determine content type
        ext = artifact.path.split(".")[-1].lower() if "." in artifact.path else "txt"
        content_types = {
            "py": "text/x-python",
            "js": "text/javascript",
            "ts": "text/typescript",
            "html": "text/html",
            "css": "text/css",
            "json": "application/json",
            "md": "text/markdown",
            "txt": "text/plain",
        }
        content_type = content_types.get(ext, "text/plain")
        
        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{artifact.name}"'
            }
        )
    finally:
        db.close()


@app.post("/documents/upload", tags=["documents"])
async def upload_document(file: UploadFile = File(...)):
    """Upload a document to the RAG knowledge base.
    
    Supported formats: .txt, .md, .pdf, .json, .csv, .py, .js, .ts, .html, .css
    """
    global rag_service
    
    if not rag_service:
        raise HTTPException(status_code=503, detail="RAG service not enabled. Set ENABLE_RAG=true")
    
    # Check file extension
    allowed_extensions = {'.txt', '.md', '.pdf', '.json', '.csv', '.py', '.js', '.ts', '.html', '.css'}
    file_ext = os.path.splitext(file.filename or '')[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {file_ext}. Allowed: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Read file content
        content = await file.read()
        
        # Handle different file types
        if file_ext == '.pdf':
            # Try to extract text from PDF
            try:
                import pypdf
                from io import BytesIO
                reader = pypdf.PdfReader(BytesIO(content))
                text_content = "\n".join(page.extract_text() or "" for page in reader.pages)
                if not text_content.strip():
                    raise HTTPException(status_code=400, detail="Could not extract text from PDF")
            except ImportError:
                raise HTTPException(status_code=400, detail="PDF support not installed. Run: pip install pypdf")
        else:
            # Text files - try multiple encodings
            text_content = None
            for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1']:
                try:
                    text_content = content.decode(encoding)
                    break
                except (UnicodeDecodeError, LookupError):
                    continue
            
            if text_content is None:
                raise HTTPException(status_code=400, detail="Could not decode file. Unsupported encoding.")
        
        # Create document with metadata
        from langchain_core.documents import Document
        doc = Document(
            page_content=text_content,
            metadata={
                "source": file.filename,
                "file_type": file_ext,
            }
        )
        
        # Add to RAG service
        success = rag_service.add_documents([doc])
        
        if success:
            return {
                "success": True,
                "message": f"Document '{file.filename}' uploaded successfully",
                "filename": file.filename,
                "size": len(content),
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to add document to knowledge base")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/documents/upload-multiple", tags=["documents"])
async def upload_multiple_documents(files: list[UploadFile] = File(...)):
    """Upload multiple documents to the RAG knowledge base."""
    global rag_service
    
    if not rag_service:
        raise HTTPException(status_code=503, detail="RAG service not enabled. Set ENABLE_RAG=true")
    
    allowed_extensions = {'.txt', '.md', '.pdf', '.json', '.csv', '.py', '.js', '.ts', '.html', '.css'}
    results = []
    
    for file in files:
        file_ext = os.path.splitext(file.filename or '')[1].lower()
        
        if file_ext not in allowed_extensions:
            results.append({
                "filename": file.filename,
                "success": False,
                "error": f"Unsupported file type: {file_ext}"
            })
            continue
            
        try:
            content = await file.read()
            text_content = content.decode('utf-8')
            
            from langchain_core.documents import Document
            doc = Document(
                page_content=text_content,
                metadata={
                    "source": file.filename,
                    "file_type": file_ext,
                }
            )
            
            success = rag_service.add_documents([doc])
            results.append({
                "filename": file.filename,
                "success": success,
                "size": len(content) if success else 0,
            })
            
        except UnicodeDecodeError:
            results.append({
                "filename": file.filename,
                "success": False,
                "error": "File must be UTF-8 encoded text"
            })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })
    
    successful = sum(1 for r in results if r.get("success"))
    return {
        "success": successful > 0,
        "total": len(files),
        "successful": successful,
        "results": results,
    }


@app.get("/documents/stats", tags=["documents"])
async def get_document_stats():
    """Get statistics about the RAG knowledge base."""
    global rag_service
    
    if not rag_service:
        raise HTTPException(status_code=503, detail="RAG service not enabled. Set ENABLE_RAG=true")
    
    return rag_service.get_stats()


@app.delete("/documents/clear", tags=["documents"])
async def clear_documents():
    """Clear all documents from the RAG knowledge base."""
    global rag_service
    
    if not rag_service:
        raise HTTPException(status_code=503, detail="RAG service not enabled. Set ENABLE_RAG=true")
    
    success = rag_service.clear()
    if success:
        return {"success": True, "message": "Knowledge base cleared"}
    else:
        raise HTTPException(status_code=500, detail="Failed to clear knowledge base")


@app.get("/documents/sources", tags=["documents"])
async def list_document_sources():
    """List all document sources in the knowledge base."""
    global rag_service
    
    if not rag_service:
        raise HTTPException(status_code=503, detail="RAG service not enabled. Set ENABLE_RAG=true")
    
    sources = rag_service.list_sources()
    return {"sources": sources, "count": len(sources)}


@app.delete("/documents/{source}", tags=["documents"])
async def delete_document_by_source(source: str):
    """Delete documents by source filename."""
    global rag_service
    
    if not rag_service:
        raise HTTPException(status_code=503, detail="RAG service not enabled. Set ENABLE_RAG=true")
    
    success = rag_service.delete_by_source(source)
    if success:
        return {"success": True, "message": f"Deleted documents with source: {source}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete documents")


@app.post("/documents/search", tags=["documents"])
async def search_documents(query: str, k: int = 4, score_threshold: Optional[float] = None):
    """Search the knowledge base.
    
    Args:
        query: Search query
        k: Number of results (default 4)
        score_threshold: Minimum relevance score (0-1)
    """
    global rag_service
    
    if not rag_service:
        raise HTTPException(status_code=503, detail="RAG service not enabled. Set ENABLE_RAG=true")
    
    results = rag_service.search(query, k=k, score_threshold=score_threshold)
    return {
        "query": query,
        "count": len(results),
        "results": [
            {
                "content": doc.page_content[:500] + ("..." if len(doc.page_content) > 500 else ""),
                "source": doc.metadata.get("source", "unknown"),
                "score": score,
            }
            for doc, score in results
        ]
    }


@app.get("/memory", tags=["memory"])
async def get_memory():
    """Get conversation memory."""
    if not meta_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    return {
        "history": meta_system.conversation_history,
        "count": len(meta_system.conversation_history),
    }


@app.post("/memory/clear", tags=["memory"])
async def clear_memory():
    """Clear conversation memory."""
    if not meta_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    meta_system.clear_memory()
    return {"message": "Memory cleared"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
