# Installation Guide

> **Recommended:** Use `./magentic.sh setup` for automated installation.

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** (frontend)
- **Docker** (optional, for MCP services)

## Quick Setup

```bash
git clone https://github.com/amirsdream/Magentic.git && cd Magentic
chmod +x magentic.sh && ./magentic.sh setup
./magentic.sh start
```

## Manual Installation

### 1. Environment Setup

```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cd frontend && npm install && cd ..
```

### 2. Configuration

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Ollama (default, free, local)
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2:1b

# OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Claude
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Database

```bash
alembic upgrade head
```

### 4. Start Services

**Terminal 1 (Backend):**
```bash
source .venv/bin/activate
python -m src.run_api
```

**Terminal 2 (Frontend):**
```bash
cd frontend && npm run dev
```

Open http://localhost:3000

## LLM Setup

### Ollama (Recommended)

```bash
# Install: https://ollama.com
ollama pull llama3.2:1b
ollama pull nomic-embed-text  # For RAG
```

### OpenAI

Get API key: https://platform.openai.com

### Claude

Get API key: https://console.anthropic.com

## Optional Features

### RAG (Knowledge Base)

```bash
ENABLE_RAG=true
RAG_VECTOR_STORE=qdrant
```

See [RAG & Tools](docs/RAG_AND_TOOLS.md).

### MCP (Model Context Protocol)

```bash
./magentic.sh mcp
```

### Observability

```bash
./magentic.sh metrics
```

Access Grafana at http://localhost:3001

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | LLM provider | `ollama` |
| `OLLAMA_MODEL` | Ollama model | `llama3.2:1b` |
| `JWT_SECRET` | Auth secret (set in production) | Random |
| `ENABLE_RAG` | Enable RAG | `false` |
| `ENABLE_MCP` | Enable MCP | `false` |
| `ENABLE_METRICS` | Enable Prometheus | `false` |

## Troubleshooting

**Port in use:**
```bash
./magentic.sh stop
```

**Database issues:**
```bash
./magentic.sh db-reset
```

**Missing dependencies:**
```bash
pip install -r requirements.txt
```
