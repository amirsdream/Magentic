# Magentic + Ropex

Magentic uses **Ropex** as its execution engine when configured. The UI stays in Magentic; planning and stage runs happen in Ropex over HTTP + SSE.

```
Magentic Studio ──WebSocket──▶ Magentic API ──HTTP+SSE──▶ Ropex (:7780)
  home chat → create pipeline → open (stages + agents + actions + HITL)
       ◀── plan / approval_required / agent_* / complete
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
ROPEX_REQUIRE_APPROVAL=true
```

If `ROPEX_BASE_URL` is set and `EXECUTION_ENGINE` is omitted, Magentic selects Ropex automatically.
`ROPEX_REQUIRE_APPROVAL` defaults to on when using Ropex (pause after plan until the UI approves drain).

3. Start Magentic:

```bash
./magentic.sh start
```

Open the UI — the header shows a **Ropex** badge. Chat on the home page to create a pipeline, or open a recent one.

## Studio + human-in-the-loop

1. Chat on home (or open a recent pipeline)
2. Ropex plans with `drain: false` → Magentic emits `plan` + Ropex-style pipeline YAML (`pipeline.stages[].agents`)
3. Studio shows the execution pipeline strip + stage/agent canvas; then `approval_required`
4. User sends WebSocket `{ type: "approve"|"reject", pipeline_id }`
5. On approve → Magentic calls Ropex scoped drain and streams `agent_*` / `complete`

Set `ROPEX_REQUIRE_APPROVAL=false` to drain immediately after plan (no HITL pause).

## Contract

See [Ropex executor API](https://github.com/amirsdream/ropex/blob/main/docs/executor-api.md):

| Call | Purpose |
|------|---------|
| `POST /api/v1/pipeline` `{ prompt, drain: false }` | Plan + enqueue |
| `GET /api/v1/events?pipelineId=&format=ui` | SSE → Magentic WebSocket types |
| `POST /api/v1/pipeline` `{ action: "drain", pipelineId }` | Scoped sequential drain |

Event map: `plan`, `approval_required` (Magentic), `agent_start`, `agent_log`, `agent_complete`, `complete`, `error`, `stream_end`.

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
