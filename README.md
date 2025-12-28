# Magentic

[![CI](https://github.com/amirsdream/magentic/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/amirsdream/magentic/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agent%20Orchestration-orange.svg)](https://github.com/langchain-ai/langgraph)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker)](https://www.docker.com/)

**Magnetic Agent Networks** — Dynamic multi-agent AI system with parallel execution.

![MagenticUI Screenshot](assets/MagenticUI.png)

## Why Magentic?

Traditional AI assistants use a single model for every task. Magentic takes a different approach: it acts as an **AI orchestrator** that understands your question, breaks it into components, and deploys the right combination of specialized agents to tackle each part. A research question might spawn a web researcher and an analyzer working in parallel; a coding task might use a planner, coder, and critic in sequence. This dynamic orchestration means you get expert-level responses without manually prompting different models—Magentic figures out the optimal strategy automatically and executes it efficiently using parallel processing.

## Quick Start

```bash
# 1. Setup
git clone <your-repo-url> && cd test_langchain
chmod +x magentic.sh && ./magentic.sh setup

# 2. Start all services
./magentic.sh start

# 3. Open http://localhost:3000
```

> **CLI mode:** Run `./magentic.sh cli` for interactive terminal mode.

## What is Magentic?

Magentic analyzes your questions and automatically creates an optimal network of specialized AI agents. Simple questions use one agent; complex questions spawn multiple agents working in parallel.

**Key Features:**
- 🤖 **Dynamic Planning** — AI creates optimal agent networks per query
- ⚡ **Parallel Execution** — Agents run simultaneously via LangGraph
- 🔍 **Web Search** — Agents can search the web for current info
- 📚 **RAG Support** — Query your own documents (optional)
- 🎨 **Modern Web UI** — Real-time execution visualization
- 🔐 **User Auth** — JWT-based accounts with history, or guest mode
- 📊 **Usage Tracking** — Real-time token usage and cost tracking per user
- 🔭 **Observability** — Phoenix tracing with OpenTelemetry instrumentation
- 🌓 **Dark/Light Mode** — Theme toggle with per-user persistence

**Supported LLMs:** Ollama (local/free), OpenAI, Claude

## Commands

```bash
./magentic.sh start     # Start all services
./magentic.sh stop      # Stop all services
./magentic.sh status    # Show service status
./magentic.sh cli       # Interactive CLI mode
./magentic.sh help      # All available commands
```

## Configuration

Edit `.env` to configure your LLM:

```bash
# Ollama (default, free, local)
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2:1b

# OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Claude
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**Optional features:**
```bash
ENABLE_RAG=true              # Enable document retrieval
ENABLE_MCP=true              # Enable MCP tools (requires Docker)
DEBUG_STATE=true             # Enable debug visualization
AGENT_CONTEXT_LIMIT=4000     # Max chars passed between agent layers (default: 4000)
AGENT_HISTORY_LIMIT=500      # Max chars for conversation history preview (default: 500)
UI_DISPLAY_LIMIT=200         # Max chars shown in UI per agent (default: 200)
```

## Agent Roles

| Role | Description |
|------|-------------|
| **Researcher** | Searches the web for current information |
| **Retriever** | Searches your knowledge base (RAG) |
| **Analyzer** | Analyzes data and explains concepts |
| **Planner** | Creates step-by-step plans |
| **Writer** | Writes articles and documentation |
| **Coder** | Generates and explains code |
| **Critic** | Reviews and improves content |
| **Synthesizer** | Combines multiple inputs into final output |

## Architecture Highlights

| Component | Technology | Description |
|-----------|------------|-------------|
| **Orchestration** | LangGraph | DAG-based execution with state management, checkpointing, and crash recovery |
| **Authentication** | FastAPI-Users + JWT | Secure token-based auth with user profiles |
| **MCP Gateway** | Docker + FastMCP | Model Context Protocol server for extensible tool integration |
| **RAG Engine** | Qdrant/ChromaDB | Active retrieval: auto-injects relevant context into planning phase |
| **Persistence** | SQLAlchemy + SQLite | Full conversation history, user profiles, usage stats, and session management |
| **Usage Tracking** | Token Tracker | Per-query token counting and cost calculation by LLM provider |
| **Observability** | Phoenix + OpenTelemetry | LLM tracing, latency metrics, execution debugging |
| **State Management** | LangGraph State | Typed state with reducers, enabling complex multi-agent workflows |
| **Real-time** | WebSocket | Live streaming of agent execution with token usage tracking |

### Execution Flow

```
Query → RAG Context Injection → Meta-Coordinator → Execution Plan → LangGraph DAG
                ↓
Knowledge Base (auto-search) → Enriched Query
                ↓
Layer 0: [researcher_0, researcher_1] (parallel)
                ↓ barrier
Layer 1: [analyzer_2] (waits for layer 0)
                ↓ barrier  
Layer 2: [synthesizer_3] (final answer)
                ↓
WebSocket Stream → React UI
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design and components |
| [Authentication](docs/AUTHENTICATION.md) | User auth and security |
| [Observability](docs/OBSERVABILITY.md) | Phoenix tracing and monitoring |
| [RAG & Tools](docs/RAG_AND_TOOLS.md) | RAG setup and MCP integration |
| [Changelog](CHANGELOG.md) | Version history |

### Build Docs Locally (Sphinx)

```bash
# Install doc dependencies
pip install -r docs/requirements-docs.txt

# Build HTML docs
cd docs && make html

# View at docs/_build/html/index.html
# Or use live reload:
make livehtml  # Opens at http://127.0.0.1:8000
```

## Tech Stack

**Backend:** FastAPI, SQLAlchemy, LangGraph, SQLite  
**Frontend:** React 18, Vite, Tailwind CSS  
**LLMs:** Ollama, OpenAI, Claude

## License

AGPLv3 License - see [LICENSE](LICENSE)
