# Documentation

## Guides

| Document | Description |
|----------|-------------|
| [Architecture](ARCHITECTURE.md) | System design, execution flow, components |
| [Authentication](AUTHENTICATION.md) | User auth, JWT tokens, usage stats |
| [RAG & Tools](RAG_AND_TOOLS.md) | RAG setup, MCP integration |

## Quick Reference

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | System status |
| `WS /ws` | WebSocket for queries |
| `POST /auth/register` | Create user |
| `POST /auth/jwt/login` | Authenticate (returns JWT) |
| `GET /auth/me` | Current user info |
| `GET /auth/me/stats` | Usage stats (queries, tokens, cost) |
| `GET /profile/{username}` | User profile |
| `PUT /profile/{username}` | Update profile |

### WebSocket Protocol

**Send query:**
```json
{"query": "What is Python?", "conversation_id": "uuid"}
```

**Events received:**
- `plan` — Execution plan with agents
- `agent_start` — Agent began execution  
- `agent_complete` — Agent finished with output and token usage
- `complete` — Final response with total token usage
- `error` — Error occurred

### Usage Stats

Stats available via `/auth/me/stats`:
```json
{
  "total_queries": 150,
  "total_agents_executed": 420,
  "total_tokens_used": 45000,
  "total_cost": 0.125
}
```

### Environment Variables

```bash
# LLM Provider (required)
LLM_PROVIDER=ollama          # ollama, openai, or claude
OLLAMA_MODEL=llama3.2:1b

# Authentication
JWT_SECRET=your-secret       # Required for production

# Optional Features
ENABLE_RAG=false
ENABLE_MCP=false
DEBUG_STATE=false
```

See main [README](../README.md) for quick start.
