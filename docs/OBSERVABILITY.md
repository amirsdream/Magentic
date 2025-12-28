# Observability

Magentic includes comprehensive observability features using **Prometheus**, **Grafana**, and **Loki** for monitoring, metrics, and log aggregation.

## Overview

The observability stack includes:

| Component | Purpose | Port |
|-----------|---------|------|
| **Prometheus** | Metrics collection & alerting | 9090 |
| **Grafana** | Dashboards & visualization | 3001 |
| **Loki** | Log aggregation | 3100 |
| **Promtail** | Log collector | - |
| **Token Tracker** | Usage metrics per agent | - |

## Quick Start

```bash
# Start observability stack with Docker
cd docker
docker compose up -d prometheus grafana loki promtail

# Enable metrics in the API
export ENABLE_METRICS=true
python -m src.run_api
```

**Access Points:**
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **API Metrics**: http://localhost:8000/metrics

## Prometheus Metrics

The API exposes metrics at `/metrics` when `ENABLE_METRICS=true`.

### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by method, endpoint, status |
| `http_request_duration_seconds` | Histogram | HTTP request latency |
| `llm_requests_total` | Counter | LLM API calls by provider, model, status |
| `llm_request_duration_seconds` | Histogram | LLM request latency |
| `llm_tokens_total` | Counter | Tokens used by provider, model, type |
| `llm_cost_dollars_total` | Counter | Total cost in dollars |
| `agent_executions_total` | Counter | Agent executions by type, status |
| `agent_execution_duration_seconds` | Histogram | Agent execution time |
| `agents_in_progress` | Gauge | Currently executing agents |
| `tool_calls_total` | Counter | Tool invocations by name, status |
| `queries_total` | Counter | User queries by status |
| `websocket_connections_active` | Gauge | Active WebSocket connections |
| `rag_queries_total` | Counter | RAG queries by status |
| `mcp_requests_total` | Counter | MCP server requests |

### Configuration

```bash
# Enable Prometheus metrics
ENABLE_METRICS=true

# The API will expose /metrics endpoint
```

### Example Prometheus Queries

```promql
# Request rate over 5 minutes
sum(rate(http_requests_total[5m]))

# Average LLM latency by provider
avg(llm_request_duration_seconds) by (provider)

# Total tokens used today
sum(increase(llm_tokens_total[24h]))

# Agent execution success rate
sum(rate(agent_executions_total{status="success"}[5m])) 
  / sum(rate(agent_executions_total[5m]))
```

## Grafana Dashboards

Pre-configured dashboards are included:

### Magentic Dashboard
Located at `docker/observability/grafana/dashboards/magentic-dashboard.json`

**Panels:**
- HTTP Request Rate
- Request Latency (p50, p95, p99)
- LLM Provider Usage
- Token Consumption
- Agent Execution Times
- Active WebSocket Connections
- Error Rate

### MCP Dashboard
Located at `docker/observability/grafana/dashboards/mcp-dashboard.json`

**Panels:**
- MCP Request Rate
- MCP Latency by Server
- Tool Call Distribution
- Error Tracking

### Accessing Grafana

1. Open http://localhost:3001
2. Login with `admin` / `admin`
3. Navigate to Dashboards → Browse
4. Select "Magentic" or "MCP" dashboard

## Loki Log Aggregation

Loki collects logs from all containers via Promtail.

### Log Queries (LogQL)

```logql
# All API logs
{container_name="magentic-api"}

# Error logs only
{container_name=~".*"} |= "error"

# LLM request logs
{container_name="magentic-api"} |~ "LLM|llm"

# Agent execution logs
{container_name="magentic-api"} |= "agent" |= "executing"
```

### Viewing Logs in Grafana

1. Open Grafana → Explore
2. Select "Loki" datasource
3. Enter LogQL query
4. View log streams

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Magentic Application                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ FastAPI     │  │ Agents      │  │ Token Tracker           │  │
│  │ /metrics    │  │ Execution   │  │                         │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │ scrape /metrics
                           ▼
               ┌───────────────────────┐
               │     Prometheus        │
               │   localhost:9090      │
               └───────────┬───────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │       Grafana         │
               │   localhost:3001      │◄──── Loki (logs)
               └───────────────────────┘
```

## Token Tracking

Beyond Prometheus metrics, Magentic tracks token usage at the application level.

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
        }
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

## Docker Compose Services

The observability stack is defined in `docker/docker-compose.yml`:

```yaml
services:
  prometheus:
    image: prom/prometheus:v2.48.0
    ports:
      - "9090:9090"
    volumes:
      - ./observability/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      
  grafana:
    image: grafana/grafana:10.2.2
    ports:
      - "3001:3000"
    volumes:
      - ./observability/grafana/dashboards:/var/lib/grafana/dashboards
      - ./observability/grafana/provisioning:/etc/grafana/provisioning
      
  loki:
    image: grafana/loki:2.9.3
    ports:
      - "3100:3100"
      
  promtail:
    image: grafana/promtail:2.9.3
    volumes:
      - /var/log:/var/log
      - ./observability/promtail/promtail-config.yml:/etc/promtail/config.yml
```

## Troubleshooting

### Metrics Not Appearing

1. Check `ENABLE_METRICS=true` is set
2. Verify `/metrics` endpoint works: `curl http://localhost:8000/metrics`
3. Check Prometheus targets: http://localhost:9090/targets

### Grafana Shows No Data

1. Verify Prometheus is running: http://localhost:9090
2. Check datasource in Grafana → Configuration → Data Sources
3. Ensure time range is correct

### Loki Not Receiving Logs

1. Check Promtail is running: `docker logs promtail`
2. Verify Loki URL in promtail config
3. Check container log paths

## Best Practices

1. **Enable in Production** - Always use metrics in production
2. **Set Alerts** - Configure Prometheus alerting for errors, latency
3. **Monitor Token Usage** - Track costs via Grafana dashboards
4. **Review Logs** - Use Loki for debugging slow queries
5. **Dashboard Rotation** - Display dashboards on team monitors

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System design overview
- [Authentication](AUTHENTICATION.md) - User auth and stats
- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Docs](https://grafana.com/docs/)
