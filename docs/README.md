# Magentic Documentation

## Quick Links

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, execution flow, directory structure |
| [RAG_AND_TOOLS.md](RAG_AND_TOOLS.md) | RAG setup, MCP integration, tool configuration |
| [AUTHENTICATION.md](AUTHENTICATION.md) | User auth, API endpoints, database |
| [architecture_diagram.svg](architecture_diagram.svg) | Visual system diagram |

## Getting Started

```bash
# Install
pip install -r requirements.txt
cd frontend && npm install

# Configure
cp .env.example .env
# Edit .env with your LLM provider settings

# Run
./magentic.sh start        # Start all services
./magentic.sh cli          # CLI mode only
./magentic.sh status       # Check status
```

## Environment Variables

```bash
# Required
LLM_PROVIDER=ollama|openai|anthropic
OLLAMA_MODEL=llama3.2
# or OPENAI_API_KEY=sk-...
# or ANTHROPIC_API_KEY=sk-...

# Optional
RAG_ENABLED=true
MCP_ENABLED=true
DEBUG=false
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Health check |
| `GET /health` | System status |
| `WS /ws` | WebSocket for queries |
| `POST /register` | Create user |
| `POST /login` | Authenticate |
| `GET /profile/{user}` | Get profile |

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `{query: "..."}` | Client→Server | Send query |
| `plan` | Server→Client | Execution plan |
| `agent_start` | Server→Client | Agent began |
| `agent_complete` | Server→Client | Agent finished |
| `complete` | Server→Client | Final response |
| `error` | Server→Client | Error occurred |
