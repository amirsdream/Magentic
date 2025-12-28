# Observability

Comprehensive monitoring with Prometheus, Grafana, and Loki.

## Overview

| Component | Purpose | Port |
|-----------|---------|------|
| **Prometheus** | Metrics collection | 9090 |
| **Grafana** | Dashboards | 3001 |
| **Loki** | Log aggregation | 3100 |
| **Promtail** | Log collector | - |

## Quick Start

```bash
# Start observability stack
./magentic.sh metrics

# Or manually with Docker
cd docker && docker compose up -d prometheus grafana loki promtail

# Enable metrics in API
export ENABLE_METRICS=true
python -m src.run_api
```

**Access:**
- Grafana: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090
- API Metrics: http://localhost:8000/metrics

## Prometheus Metrics

### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | HTTP requests |
| `http_request_duration_seconds` | Histogram | Request latency |
| `llm_requests_total` | Counter | LLM API calls |
| `llm_tokens_total` | Counter | Tokens used |
| `llm_cost_dollars_total` | Counter | Total cost |
| `agent_executions_total` | Counter | Agent executions |
| `agent_execution_duration_seconds` | Histogram | Agent duration |
| `tool_calls_total` | Counter | Tool invocations |
| `websocket_connections_active` | Gauge | Active connections |

### Example Queries

```promql
# Request rate
sum(rate(http_requests_total[5m]))

# LLM latency by provider
avg(llm_request_duration_seconds) by (provider)

# Tokens used today
sum(increase(llm_tokens_total[24h]))

# Agent success rate
sum(rate(agent_executions_total{status="success"}[5m])) 
  / sum(rate(agent_executions_total[5m]))
```

## Grafana Dashboards

Pre-configured dashboards in `docker/observability/grafana/dashboards/`:

### Magentic Dashboard
- HTTP Request Rate
- Request Latency (p50, p95, p99)
- LLM Provider Usage
- Token Consumption
- Agent Execution Times
- Error Rate

### MCP Dashboard
- MCP Request Rate
- Latency by Server
- Tool Call Distribution

## Loki Logs

### LogQL Queries

```bash
# API logs
{container_name="magentic-api"}

# Errors only
{container_name=~".*"} |= "error"

# LLM requests
{container_name="magentic-api"} |~ "LLM|llm"

# Agent execution
{container_name="magentic-api"} |= "agent" |= "executing"
```

### View in Grafana

1. Grafana → Explore
2. Select "Loki" datasource
3. Enter LogQL query

## Token Tracking

Application-level tracking via `TokenTracker`:

```python
from src.agents.token_tracker import get_tracker

tracker = get_tracker()
summary = tracker.get_summary()
# {
#   "total": {"total_tokens": 7000, "total_cost": 0.007},
#   "agents": {...}
# }
```

### User Stats Endpoint

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/auth/me/stats

# Response:
{
  "total_queries": 205,
  "total_agents_executed": 397,
  "total_tokens_used": 1250000,
  "total_cost": 12.50
}
```

## Docker Services

```yaml
services:
  prometheus:
    image: prom/prometheus:v2.48.0
    ports: ["9090:9090"]
      
  grafana:
    image: grafana/grafana:10.2.2
    ports: ["3001:3000"]
      
  loki:
    image: grafana/loki:2.9.3
    ports: ["3100:3100"]
      
  promtail:
    image: grafana/promtail:2.9.3
```

## Troubleshooting

**Metrics not appearing:**
1. Check `ENABLE_METRICS=true`
2. Verify `curl http://localhost:8000/metrics`
3. Check Prometheus targets: http://localhost:9090/targets

**Grafana shows no data:**
1. Verify Prometheus running
2. Check datasource configuration
3. Adjust time range

**Loki not receiving logs:**
1. Check Promtail: `docker logs promtail`
2. Verify Loki URL in config
