# Observability

Magentic includes comprehensive observability features to help you monitor, debug, and understand agent executions.

## Overview

The observability stack includes:

| Component | Purpose | Port |
|-----------|---------|------|
| **Phoenix** | LLM tracing and debugging | 6006 |
| **OpenTelemetry** | Distributed tracing | 4317 |
| **Application Logs** | Structured logging | - |
| **Token Tracker** | Usage metrics per agent | - |

## Phoenix Tracing

[Arize Phoenix](https://github.com/Arize-ai/phoenix) provides real-time LLM observability with:

- **Trace Visualization** - See the complete execution flow
- **Token Analysis** - Track input/output tokens per call
- **Latency Metrics** - Identify slow agents or calls
- **Error Tracking** - Debug failed executions

### Installation

Phoenix is optional. To enable it:

```bash
pip install arize-phoenix openinference-instrumentation-langchain
```

### Configuration

Set these environment variables:

```bash
# Enable Phoenix (default: true if installed)
PHOENIX_ENABLED=true

# Phoenix ports
PHOENIX_PORT=6006
PHOENIX_GRPC_PORT=4317
```

### Usage

Phoenix starts automatically when the API server launches:

```bash
python -m src.run_api
```

Access the Phoenix UI at: **http://localhost:6006**

### What You'll See

1. **Traces** - Each query creates a trace showing:
   - Meta-coordinator planning
   - Agent executions (parallel and sequential)
   - Tool calls (RAG, web search, etc.)
   - Token usage per LLM call

2. **Spans** - Individual operations within a trace:
   - LLM invocations with prompts/responses
   - Embedding generations
   - Vector store queries

3. **Metrics** - Aggregated statistics:
   - Average latency by agent type
   - Token usage over time
   - Error rates

## OpenTelemetry Integration

Phoenix uses OpenTelemetry for distributed tracing. The integration is handled by `src/observability.py`:

```python
from src.observability import ObservabilityManager
from src.config import Config

config = Config()
obs_manager = ObservabilityManager(config)

# Start Phoenix and instrument LangChain
if obs_manager.setup():
    print(f"Phoenix running at {obs_manager.get_url()}")
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Magentic Application                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ LangChain   │  │ LangGraph   │  │ Agent Executions    │  │
│  │ Calls       │  │ State       │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┴─────────────────────┘             │
│                          │                                   │
│              ┌───────────▼───────────┐                       │
│              │ LangChainInstrumentor │                       │
│              │   (OpenInference)     │                       │
│              └───────────┬───────────┘                       │
│                          │                                   │
│              ┌───────────▼───────────┐                       │
│              │   TracerProvider      │                       │
│              │   (OpenTelemetry)     │                       │
│              └───────────┬───────────┘                       │
└──────────────────────────┼───────────────────────────────────┘
                           │ OTLP/HTTP
                           ▼
               ┌───────────────────────┐
               │     Phoenix Server    │
               │   http://localhost:   │
               │        6006           │
               └───────────────────────┘
```

## Token Tracking

Beyond Phoenix traces, Magentic tracks token usage at the application level for billing and analytics.

### TokenTracker Module

Located at `src/agents/token_tracker.py`:

```python
from src.agents.token_tracker import get_tracker, reset_tracker

# Get current session tracker
tracker = get_tracker()

# After query execution
summary = tracker.get_summary()
print(f"Total tokens: {summary['total']['total_tokens']}")
print(f"Total cost: ${summary['total']['total_cost']:.4f}")

# Reset for next query
reset_tracker()
```

### Token Data Structure

```python
{
    "agents": {
        "researcher_0": {
            "agent_id": "researcher_0",
            "role": "researcher",
            "prompt_tokens": 1500,
            "completion_tokens": 800,
            "total_tokens": 2300,
            "total_cost": 0.0023
        },
        # ... more agents
    },
    "planning": {
        "prompt_tokens": 500,
        "completion_tokens": 200,
        "total_tokens": 700,
        "total_cost": 0.0007
    },
    "total": {
        "prompt_tokens": 5000,
        "completion_tokens": 2000,
        "total_tokens": 7000,
        "total_cost": 0.0070
    }
}
```

### User Stats Endpoint

Get aggregated stats for the authenticated user:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/auth/me/stats
```

Response:

```json
{
    "total_queries": 205,
    "total_agents_executed": 397,
    "total_tokens_used": 1250000,
    "total_cost": 12.50
}
```

## Application Logging

Magentic uses Python's `logging` module with structured output.

### Log Levels

| Level | Usage |
|-------|-------|
| `DEBUG` | Detailed execution info, token counts |
| `INFO` | Normal operation, agent start/complete |
| `WARNING` | Non-fatal issues, fallbacks |
| `ERROR` | Failures requiring attention |

### Configuration

```bash
# Set log level
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR

# Example output
2024-12-28 10:15:23 INFO  [api] Query received: "Compare Python and Rust"
2024-12-28 10:15:24 INFO  [coordinator] Planned 4 agents in 2 layers
2024-12-28 10:15:24 INFO  [executor] Starting layer 0: researcher_0, researcher_1
2024-12-28 10:15:30 INFO  [executor] Layer 0 complete (6.2s)
2024-12-28 10:15:35 INFO  [executor] All agents complete, total tokens: 5230
```

## Troubleshooting

### Phoenix Won't Start

**Port conflict:**
```bash
# Check what's using port 4317
lsof -i :4317

# Kill the process
lsof -ti:4317 | xargs kill -9

# Or use a different port
export PHOENIX_GRPC_PORT=4318
```

**Missing dependencies:**
```bash
pip install arize-phoenix openinference-instrumentation-langchain
```

### No Traces Appearing

1. Verify Phoenix is running: http://localhost:6006
2. Check logs for instrumentation errors
3. Ensure `PHOENIX_ENABLED=true`
4. Try restarting the API server

### High Memory Usage

Phoenix stores traces in memory. For long-running servers:

```bash
# Restart Phoenix periodically
# Or configure external storage (see Phoenix docs)
```

## Best Practices

1. **Enable in Development** - Always use Phoenix during development
2. **Disable in Production** - Unless you need production tracing
3. **Monitor Token Usage** - Check `/auth/me/stats` regularly
4. **Set Alerts** - Monitor for unusual token consumption
5. **Review Traces** - Debug slow queries using Phoenix UI

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System design overview
- [Authentication](AUTHENTICATION.md) - User auth and stats
- [Phoenix Documentation](https://docs.arize.com/phoenix)
- [OpenTelemetry Python](https://opentelemetry.io/docs/instrumentation/python/)
