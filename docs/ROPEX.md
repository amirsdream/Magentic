# Magentic + Ropex

Magentic uses **Ropex** as its execution engine when configured. The UI stays in Magentic; planning and stage runs happen in Ropex over HTTP + SSE.

```
Magentic UI ──WebSocket──▶ Magentic API ──HTTP+SSE──▶ Ropex (:7780)
                              AgentLoopBar ◀── plan / agent_* / complete
```

## Quick start

1. Start Ropex control plane (port `7780`):

```bash
# in the Ropex repo
ropex ui
# or: docker compose up --build
```

2. Configure Magentic (`.env`):

```env
EXECUTION_ENGINE=ropex
ROPEX_BASE_URL=http://127.0.0.1:7780
ROPEX_ASYNC_DRAIN=true
```

If `ROPEX_BASE_URL` is set and `EXECUTION_ENGINE` is omitted, Magentic selects Ropex automatically.

3. Start Magentic:

```bash
./magentic.sh start
```

Open the UI — the header shows a **Ropex** badge when the API is using that engine.

## Contract

See [Ropex executor API](https://github.com/amirsdream/ropex/blob/main/docs/executor-api.md):

| Call | Purpose |
|------|---------|
| `POST /api/v1/pipeline` `{ prompt, drain: false }` | Plan + enqueue |
| `GET /api/v1/events?pipelineId=&format=ui` | SSE → Magentic WebSocket types |
| `POST /api/v1/pipeline` `{ action: "drain", pipelineId }` | Scoped sequential drain |

Event map: `plan`, `agent_start`, `agent_log`, `agent_complete`, `complete`, `error`, `stream_end`.

When `EXECUTION_ENGINE=ropex`, LangGraph is **not** initialized and is never used as a fallback.

## Docker

`docker-compose.yml` defaults the app service to Ropex via `host.docker.internal:7780` (Ropex on the host). Override:

```env
ROPEX_BASE_URL=http://ropex-control-plane:7780
```

if you put both stacks on a shared network.

## LangGraph fallback

```env
EXECUTION_ENGINE=langgraph
# leave ROPEX_BASE_URL unset
```
