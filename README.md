# Magentic

[![CI](https://github.com/amirsdream/Magentic/actions/workflows/ci.yml/badge.svg)](https://github.com/amirsdream/Magentic/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-blue?logo=github)](https://amirsdream.github.io/Magentic/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Orchestration-orange.svg)](https://github.com/langchain-ai/langgraph)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react)](https://reactjs.org/)

**Dynamic multi-agent AI orchestration with parallel execution.**

![Magentic UI](assets/MagenticUI.png)

## Why Magentic?

Traditional AI assistants use one model for every task. Magentic acts as an **AI orchestrator**—it analyzes your question, breaks it into components, and deploys specialized agents to tackle each part. A research question spawns researchers and analyzers working in parallel; a coding task uses a planner, coder, and critic in sequence. Dynamic orchestration delivers expert-level responses without manual prompt engineering.

## Quick Start

```bash
git clone https://github.com/amirsdream/Magentic.git && cd Magentic
chmod +x magentic.sh && ./magentic.sh setup
./magentic.sh start
# Open http://localhost:3000
```

## Features

| Feature | Description |
|---------|-------------|
| 🤖 **Dynamic Planning** | AI creates optimal agent networks per query |
| ⚡ **Parallel Execution** | Agents run simultaneously via LangGraph DAG |
| 🔍 **Web Search** | Real-time information retrieval with inline citations |
| 📚 **RAG Support** | Query your own documents with Wikipedia-style references |
| 📎 **Artifacts** | Claude-style preview panel for agent-created files |
| 🎨 **Real-time UI** | Live execution visualization with WebSocket streaming |
| 🔐 **User Auth** | JWT authentication with conversation history |
| 📊 **Usage Tracking** | Token usage and cost tracking per user |
| 🔭 **Observability** | Prometheus, Grafana, Loki integration |
| 🌓 **Theming** | Dark/light mode with persistence |

**Supported LLMs:** Ollama (local), OpenAI, Claude

## Commands

```bash
./magentic.sh setup      # First-time setup
./magentic.sh start      # Start all services
./magentic.sh stop       # Stop all services
./magentic.sh status     # Show service status
./magentic.sh cli        # Interactive CLI mode
./magentic.sh help       # Show all commands
```

<details>
<summary><b>All Commands</b></summary>

| Command | Description |
|---------|-------------|
| `setup` | First-time setup (venv, deps, config) |
| `start` | Start all services |
| `stop` | Stop all services |
| `restart` | Restart all services |
| `status` | Show service status |
| `remove` | Remove all resources |
| `cli` | Interactive CLI mode |
| `api` | Start API server (port 8000) |
| `api-stop` | Stop API server |
| `frontend` | Start frontend (port 8081) |
| `frontend-stop` | Stop frontend |
| `mcp` | Start MCP Docker services |
| `mcp-stop` | Stop MCP services |
| `mcp-logs` | Show MCP logs |
| `metrics` | Start observability stack |
| `metrics-stop` | Stop observability stack |
| `db-init` | Initialize database |
| `db-reset` | Reset database |
| `health` | Check all services |

</details>

## Configuration

Edit `.env`:

```bash
# LLM Provider (choose one)
LLM_PROVIDER=ollama              # Default, free, local
OLLAMA_MODEL=llama3.2:1b

LLM_PROVIDER=openai              # OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

LLM_PROVIDER=claude              # Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Optional Features
ENABLE_RAG=true                  # Document retrieval
ENABLE_MCP=true                  # MCP tools (requires Docker)
ENABLE_METRICS=true              # Prometheus metrics
```

## Agent Roles

| Role | Description |
|------|-------------|
| **Researcher** | Web search for current information |
| **Retriever** | Knowledge base search (RAG) |
| **Analyzer** | Data analysis and explanations |
| **Planner** | Step-by-step planning |
| **Writer** | Articles and documentation |
| **Coder** | Code generation and explanation |
| **Critic** | Review and improvement |
| **Synthesizer** | Combine inputs into final output |

## Citations & Artifacts

**Inline Citations**: Responses include Wikipedia-style numbered references `[1]`, `[2]` from RAG documents and web search results. Click any citation badge to see the source with title, snippet, and relevance score.

**Artifacts Panel**: When agents create files (code, documents, etc.), they appear as downloadable artifacts. Click to open a Claude-style preview panel with:
- Syntax-highlighted code view
- HTML preview mode (for web files)
- Copy to clipboard
- One-click download

## Architecture

```
Query → RAG Context → Meta-Coordinator → Execution Plan → LangGraph DAG
                                              ↓
                       Layer 0: [researcher_0, researcher_1] (parallel)
                                              ↓ barrier
                       Layer 1: [analyzer_2]
                                              ↓ barrier
                       Layer 2: [synthesizer_3] → Final Output
                                              ↓
                                    WebSocket → React UI
```

| Component | Technology |
|-----------|------------|
| Orchestration | LangGraph (DAG, checkpointing) |
| Backend | FastAPI + WebSocket |
| Auth | FastAPI-Users + JWT |
| Frontend | React 18 + Zustand + TailwindCSS |
| Database | SQLAlchemy + SQLite |
| RAG | Qdrant / ChromaDB |
| MCP | Docker + FastMCP |
| Observability | Prometheus + Grafana + Loki |

## Documentation

| Document | Description |
|----------|-------------|
| [📖 Documentation](https://amirsdream.github.io/Magentic/) | Full documentation (GitHub Pages) |
| [Swagger UI](/docs) | Interactive API documentation |
| [ReDoc](/redoc) | Alternative API documentation |
| [INSTALL.md](INSTALL.md) | Manual installation guide |
| [Architecture](docs/ARCHITECTURE.md) | System design |
| [Authentication](docs/AUTHENTICATION.md) | Auth and security |
| [Observability](docs/OBSERVABILITY.md) | Monitoring setup |
| [RAG & Tools](docs/RAG_AND_TOOLS.md) | RAG and MCP setup |
| [CHANGELOG](CHANGELOG.md) | Version history |

### API Documentation

When the server is running, interactive API docs are available:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

### Build Static Docs (Sphinx)

```bash
pip install -r docs/sphinx/requirements-docs.txt
cd docs/sphinx && make html          # Build static docs
cd docs/sphinx && make livehtml      # Live server on http://localhost:8010
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

[AGPL-3.0](LICENSE) — Free to use, modify, and distribute with source code disclosure.

## Links

- 🐙 [GitHub](https://github.com/amirsdream/Magentic)
- 📖 [Documentation](docs/README.md)
- 🐛 [Issues](https://github.com/amirsdream/Magentic/issues)
