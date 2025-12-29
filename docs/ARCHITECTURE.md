# Architecture

Magentic is a multi-agent orchestration system built on **LangGraph**. It dynamically generates agent networks per query and executes them in parallel layers with barrier synchronization.

## Overview

```
User Query → Meta-Coordinator → Execution Plan → LangGraph DAG → Output
                   ↓
            Analyzes complexity, selects roles, defines dependencies
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Orchestration** | LangGraph | DAG execution, state management, checkpointing |
| **Backend** | FastAPI | REST API, WebSocket streaming |
| **Auth** | FastAPI-Users + JWT | User management, token auth |
| **Frontend** | React 18 + Zustand | Real-time UI, state management |
| **Database** | SQLAlchemy + SQLite | Persistence |
| **RAG** | Qdrant / ChromaDB | Vector search, document retrieval |
| **MCP** | Docker + FastMCP | Extensible tool integration |
| **Observability** | Prometheus + Grafana | Metrics, dashboards |

## System Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + WebSocket)                                │
├─────────────────────────────────────────────────────────────┤
│  API Layer (FastAPI)                                         │
├─────────────────────────────────────────────────────────────┤
│  Coordination (MetaCoordinator)                              │
├─────────────────────────────────────────────────────────────┤
│  Execution (LangGraph)                                       │
├─────────────────────────────────────────────────────────────┤
│  Agents (MetaAgentSystem + Tools)                            │
├─────────────────────────────────────────────────────────────┤
│  Services (RAG, MCP, Observability)                          │
└─────────────────────────────────────────────────────────────┘
```

## Execution Flow

```
Query
  ↓
RAG Context Injection (if enabled)
  ↓
MetaCoordinator → Execution Plan
  ↓
LangGraph DAG Builder
  ↓
Layer 0: [researcher_0, researcher_1]  ← parallel
  ↓ barrier
Layer 1: [analyzer_2]                  ← waits for layer 0
  ↓ barrier
Layer 2: [synthesizer_3]               ← final output
  ↓
WebSocket Stream → React UI
```

## Key Concepts

### Dynamic Topology

Each query generates a unique agent configuration:
- "What's the weather?" → 1 agent
- "Compare X vs Y" → 2 researchers + 1 synthesizer
- Complex analysis → Multiple layers with dependencies

### Layer Barriers

Synchronization points ensuring all agents in layer N complete before layer N+1 starts.

### State Management

```python
class MagenticState(TypedDict):
    query: str
    agent_outputs: Annotated[Dict[str, str], merge_dicts]
    conversation_history: Annotated[List[Dict], operator.add]
    final_output: str
```

## LangGraph Features

| Feature | Description |
|---------|-------------|
| **Checkpointing** | Resume interrupted executions |
| **State Reducers** | Merge parallel outputs safely |
| **Barrier Nodes** | Synchronize layer completion |
| **Dynamic Graphs** | Build topology per query |

## MCP Gateway

```
┌───────────┐     ┌─────────────┐     ┌─────────────┐
│  Agent    │────▶│ MCP Gateway │────▶│ MCP Servers │
│ Executor  │     │  (Docker)   │     │ filesystem  │
└───────────┘     └─────────────┘     │ fetch, etc  │
                                      └─────────────┘
```

Configure in `docker/mcp-gateway/config.json`.

## RAG System

### Active RAG (Automatic)

```
Query → RAGService.get_relevant_context_for_planning() → Enriched Query
                              ↓
                   MetaCoordinator receives context
                              ↓
                   Better informed planning
```

### Passive RAG (Tool-based)

Agents call `search_knowledge_base` tool during execution.

### Inline Citations

RAG and web search results are tracked as references and included in responses as Wikipedia-style numbered citations `[1]`, `[2]`. The LLM receives a citation guide instructing it to cite sources inline. Each citation badge is clickable, showing:
- Source title and URL (for web)
- Content snippet
- Relevance score (for RAG)

## Artifacts System

When agents create files via MCP filesystem tools, they are tracked as **artifacts**:

```
Agent Executor → Tool Call (write_file) → Extract Artifact Metadata
                              ↓
              {path, name, language, type}
                              ↓
              Deduplicate by path (keep latest)
                              ↓
              WebSocket → Frontend Artifacts Panel
```

### Artifact Sharing Between Agents

Artifacts are stored in shared state (`available_artifacts`) and passed to subsequent agents:

```
Layer 0: [coder_0] creates file.py
              ↓
         available_artifacts: {"/workspace/file.py": {...}}
              ↓ barrier
Layer 1: [tester_1] receives context:
         "Available files created by previous agents:
           - file.py (python) at: /workspace/file.py
          You can read these files using the filesystem tool."
```

This enables workflows like:
- Coder writes code → Tester reads and tests it
- Writer creates document → Critic reviews it
- Data engineer exports data → Analyzer processes it

**Claude-style Preview Panel:**
- Slide-in panel from right side
- Fetches file content from MCP filesystem server
- Syntax highlighting for code files
- HTML preview mode for web files
- Copy and download buttons

## Persistence

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   FastAPI    │────▶│  SQLAlchemy  │────▶│    SQLite    │
│   Endpoints  │     │     ORM      │     │  magentic.db │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Persisted:**
- User accounts and profiles
- Conversation history
- Token usage and costs
- Execution metadata

## Usage Tracking

```
Execution → Token Tracker → save_conversation() → UserProfile
                  ↓
         {total_tokens, total_cost}
```

Stats endpoint: `GET /auth/me/stats`

## Directory Structure

```
src/
├── agents/          # Agent system, executor, LLM factory
├── coordinator/     # Meta-planner, validators
├── execution/       # LangGraph builder, state
├── services/        # MCP, RAG services
├── tools/           # Tool manager, web search
├── auth/            # Authentication
└── api.py           # FastAPI endpoints

frontend/src/
├── components/      # UI components
│   ├── MessageBubble.jsx      # Message with citations & artifacts
│   ├── ArtifactPreviewPanel.jsx  # Claude-style file preview
│   └── WorkflowVisualization.jsx # Execution flow graph
├── hooks/           # WebSocket, auth hooks
├── store/           # Zustand state
└── contexts/        # React contexts

docker/
├── mcp-gateway/     # MCP configuration
└── observability/   # Prometheus, Grafana, Loki
```
