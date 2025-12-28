# Documentation

## Building Docs

Uses [Sphinx](https://www.sphinx-doc.org/) with Furo theme.

### Quick Start

```bash
pip install -r docs/requirements-docs.txt
cd docs && make html
# View: docs/_build/html/index.html
```

### Live Reload

```bash
cd docs && make livehtml
# Opens http://127.0.0.1:8000
```

## Guides

| Document | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE.md) | System design, execution flow |
| [Authentication](AUTHENTICATION.md) | JWT auth, usage stats |
| [Observability](OBSERVABILITY.md) | Prometheus, Grafana, Loki |
| [RAG & Tools](RAG_AND_TOOLS.md) | RAG setup, MCP integration |

## API Reference

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | System status |
| `WS /ws` | WebSocket for queries |
| `POST /auth/register` | Create user |
| `POST /auth/jwt/login` | Login (returns JWT) |
| `GET /auth/me` | Current user |
| `GET /auth/me/stats` | Usage stats |
| `GET /profile/{username}` | User profile |
| `PUT /profile/{username}` | Update profile |

### WebSocket Protocol

**Send:**
```json
{"query": "What is Python?", "conversation_id": "uuid"}
```

**Receive:**

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
