# Documentation

## Structure

```
docs/
├── ARCHITECTURE.md      # System design
├── AUTHENTICATION.md    # JWT auth, usage stats
├── OBSERVABILITY.md     # Prometheus, Grafana, Loki
├── RAG_AND_TOOLS.md     # RAG and MCP setup
├── architecture_diagram.svg
└── sphinx/              # Sphinx API documentation
    ├── conf.py
    ├── index.rst
    ├── Makefile
    └── api/
```

## Sphinx API Docs

Build API documentation with Sphinx:

```bash
# Install dependencies
pip install -r docs/sphinx/requirements-docs.txt

# Build static HTML
cd docs/sphinx && make html
# View: docs/sphinx/_build/html/index.html

# Live reload server (port 8010)
cd docs/sphinx && make livehtml
# Opens http://localhost:8010
```

## Guides

| Document | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE.md) | System design, execution flow |
| [Authentication](AUTHENTICATION.md) | JWT auth, usage stats |
| [Observability](OBSERVABILITY.md) | Prometheus, Grafana, Loki |
| [RAG & Tools](RAG_AND_TOOLS.md) | RAG setup, MCP integration |

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System status |
| `/auth/register` | POST | Create user |
| `/auth/jwt/login` | POST | Login (returns JWT) |
| `/auth/me` | GET | Current user |
| `/auth/me/stats` | GET | Usage stats |
| `/profile/{username}` | GET | User profile |
| `/profile/{username}` | PUT | Update profile |

### WebSocket

Connect to `ws://localhost:8000/ws`

**Send:**
```json
{"query": "What is Python?", "conversation_id": "uuid"}
```

**Receive Events:**

| Event | Description |
|-------|-------------|
| `plan` | Execution plan with agents |
| `agent_start` | Agent began |
| `agent_log` | Real-time activity log |
| `agent_complete` | Agent finished |
| `complete` | Final response |
| `error` | Error occurred |

### Stats Response

```json
{
  "total_queries": 150,
  "total_agents_executed": 420,
  "total_tokens_used": 45000,
  "total_cost": 0.125
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | ollama, openai, claude | `ollama` |
| `OLLAMA_MODEL` | Model name | `llama3.2:1b` |
| `JWT_SECRET` | Auth secret | Random |
| `ENABLE_RAG` | Enable RAG | `false` |
| `ENABLE_MCP` | Enable MCP | `false` |
| `ENABLE_METRICS` | Enable Prometheus | `false` |
