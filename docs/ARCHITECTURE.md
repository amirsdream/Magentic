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
├── hooks/           # WebSocket, auth hooks
├── store/           # Zustand state
└── contexts/        # React contexts

docker/
├── mcp-gateway/     # MCP configuration
└── observability/   # Prometheus, Grafana, Loki
```
