# Magentic Architecture

> 🖼️ See [architecture_diagram.svg](architecture_diagram.svg) for visual overview.

## Overview

Magentic is a production-ready multi-agent orchestration system built on **LangGraph**. It dynamically generates agent networks per query, executes them in parallel layers with barrier synchronization, and provides full state management with persistence.

```
User Query → Meta-Coordinator → Dynamic Agent Plan → LangGraph Execution → Output
                   ↓
            Analyzes complexity, selects roles, defines dependencies
```

## Core Technologies

| Technology | Purpose | Key Features |
|------------|---------|---------------|
| **LangGraph** | Agent Orchestration | DAG execution, state reducers, checkpointing, crash recovery |
| **FastAPI-Users** | Authentication | JWT tokens, user management, secure password hashing |
| **MCP Gateway** | Tool Integration | Docker-based Model Context Protocol server, extensible tools |
| **Qdrant/ChromaDB** | RAG Vector Store | Semantic search, document retrieval, embedding storage |
| **SQLAlchemy** | Persistence | Conversation history, user accounts, usage stats |
| **Token Tracker** | Usage Monitoring | Per-query token counting, cost calculation by LLM provider |
| **Prometheus** | Observability | Metrics collection, Grafana dashboards, alerting |
| **FastAPI** | API Layer | Async endpoints, WebSocket streaming, auth middleware |
| **React + Zustand** | Frontend | Real-time UI, state management, execution visualization |

## System Layers

| Layer | Components | Purpose |
|-------|------------|---------|
| **Frontend** | React, WebSocket | Real-time UI, agent visualization |
| **API** | FastAPI | REST + WebSocket endpoints |
| **Coordination** | MetaCoordinator | Query analysis, plan generation |
| **Execution** | LangGraph | State management, parallel execution |
| **Agents** | MetaAgentSystem | Agent orchestration, tool access |
| **Observability** | Prometheus + Grafana | Metrics, dashboards, logging |
| **RAG** | Qdrant/Chroma | Vector search, document retrieval |

## Execution Flow

```text
Query --> MetaCoordinator --> Plan --> Build Graph --> Layer 0 (Parallel) --> Barrier --> Layer 1 (Dependent) --> Output
```

## Key Concepts

### Dynamic Topology
Each query gets a unique agent configuration:
- "Hi" → 1 agent
- "Compare X vs Y" → 2 researchers + 1 synthesizer

### Layer Barriers
Synchronization points ensuring all agents in layer N complete before layer N+1 starts.

### Parallel Execution
Agents without dependencies run concurrently within the same layer.

## LangGraph Integration

Magentic uses LangGraph for robust agent orchestration:

```python
# State definition with typed reducers
class MagenticState(TypedDict):
    query: str
    agent_outputs: Annotated[Dict[str, str], merge_dicts]
    conversation_history: Annotated[List[Dict], operator.add]
    final_output: str
```

**Key Features:**
- **Checkpointing**: Resume interrupted executions
- **State Reducers**: Merge parallel agent outputs safely
- **Barrier Nodes**: Synchronize layer completion
- **Dynamic Graphs**: Build topology per query

## MCP Gateway

Model Context Protocol integration via Docker:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent     │────▶│ MCP Gateway │────▶│ MCP Servers │
│  Executor   │     │  (Docker)   │     │ filesystem  │
└─────────────┘     └─────────────┘     │ fetch, etc  │
                                        └─────────────┘
```

Add custom MCP servers in `docker/mcp-gateway/config.json`.

## RAG System

Retrieval-Augmented Generation with **active** knowledge injection:

### Active RAG (Automatic)

When RAG is enabled, the system automatically injects relevant context into the planning phase:

```
User Query → RAGService.get_relevant_context_for_planning() → Enriched Query
                              ↓
                   Knowledge Base Search (top 3 docs, min 0.5 score)
                              ↓
                   MetaCoordinator receives enriched context
                              ↓
                   Better informed agent planning
```

**Active RAG Features:**
- Auto-searches knowledge base on every query
- Injects relevant context before planning (not just execution)
- Configurable relevance threshold (default: 0.5)
- Coordinator makes better decisions with domain context

### Passive RAG (Tool-based)

Agents can also explicitly search via `search_knowledge_base` tool during execution.

### Vector Stores

- **Qdrant**: Production-ready, supports memory or server mode
- **ChromaDB**: Lightweight alternative for local development
- **Embeddings**: Ollama (local), OpenAI, or Voyage AI

## Observability

Magentic includes comprehensive observability via **Prometheus**, **Grafana**, and **Loki**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Magentic Application                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ FastAPI     │  │ Agents      │  │ Token Tracker           │  │
│  │ /metrics    │  │ Execution   │  │                         │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         └────────────────┼──────────────────────┘                │
└──────────────────────────┼───────────────────────────────────────┘
                           │ scrape /metrics
                           ▼
               ┌───────────────────────┐
               │     Prometheus        │───────▶ Alerting
               │   localhost:9090      │
               └───────────┬───────────┘
                           ▼
               ┌───────────────────────┐
               │       Grafana         │◀──── Loki (logs)
               │   localhost:3001      │
               └───────────────────────┘
```

**Key Features:**
- **Prometheus Metrics**: HTTP, LLM, agent, tool metrics at `/metrics`
- **Grafana Dashboards**: Pre-built dashboards for API and MCP monitoring
- **Loki Logs**: Centralized log aggregation with LogQL queries
- **Token Tracking**: Per-agent token counts and cost calculation

**Configuration:**
```bash
ENABLE_METRICS=true   # Enable Prometheus metrics endpoint
```

**Docker Services:**
```bash
cd docker
docker compose up -d prometheus grafana loki promtail
```

See [OBSERVABILITY.md](OBSERVABILITY.md) for detailed setup and usage.

## Persistence Layer

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   FastAPI    │────▶│  SQLAlchemy  │────▶│    SQLite    │
│   Endpoints  │     │     ORM      │     │  magentic.db │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Persisted Data:**
- User accounts (FastAPI-Users with JWT auth)
- User profiles with preferences and usage stats
- Conversation history with messages
- Execution metadata and token usage
- Per-user token usage and cost accumulation

## Usage Tracking

Token usage and costs are tracked per user:

```
Query Execution → Token Tracker → save_conversation() → UserProfile
                        ↓
                 {total: {total_tokens, total_cost}}
                        ↓
                 user_profiles.total_tokens_used += total_tokens
                 user_profiles.total_cost += total_cost
```

**Stats Endpoint:** `/auth/me/stats`
- `total_queries`: Calculated from conversations table
- `total_agents_executed`: Sum of agents_used from conversations
- `total_tokens_used`: Accumulated from token tracker
- `total_cost`: Accumulated based on LLM pricing

## Directory Structure

```
src/
├── agents/          # Agent system, executor, LLM factory, token tracking
├── coordinator/     # Meta-planner, validators, prompts
├── execution/       # LangGraph builder, state, barrier nodes
├── services/        # MCP client, RAG service
├── tools/           # Tool manager, web search
└── api.py           # FastAPI + WebSocket endpoints
frontend/src/
├── components/      # Chat, AgentStep, ExecutionSummary
├── hooks/           # useWebSocket for real-time updates
├── store/           # Zustand state management
└── contexts/        # Auth context
docker/
├── mcp-gateway/     # MCP server configuration
└── docker-compose.yml
```
