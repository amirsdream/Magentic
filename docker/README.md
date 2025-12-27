# MCP Docker Infrastructure

A comprehensive Docker-based Model Context Protocol (MCP) server infrastructure providing multiple AI-agent-callable tools.

## Quick Start

```bash
# Make script executable
chmod +x mcp.sh

# Start all services
./mcp.sh start

# Check status
./mcp.sh status

# Run tests
./mcp.sh test
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| **mcp-gateway** | 9000 | Central API gateway with routing, caching, metrics |
| mcp-filesystem | - | File read/write/list operations |
| mcp-websearch | - | DuckDuckGo web search |
| mcp-github | - | GitHub repository operations |
| mcp-python | - | Sandboxed Python code execution |
| mcp-database | - | SQLite database operations |
| mcp-memory | - | In-memory key-value store |

## API Endpoints

All tools are accessed through the gateway at `http://localhost:9000`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API information |
| `/health` | GET | Health status of all services |
| `/servers` | GET | List registered servers |
| `/tools` | GET | List all available tools |
| `/execute` | POST | Execute a single tool |
| `/batch` | POST | Execute multiple tools |
| `/metrics` | GET | Gateway and server metrics |

## Usage Examples

### Execute a Tool
```bash
curl -X POST http://localhost:9000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "server": "websearch",
    "tool": "search",
    "params": {"query": "langchain", "max_results": 5}
  }'
```

### Batch Execution
```bash
curl -X POST http://localhost:9000/batch \
  -H "Content-Type: application/json" \
  -d '{
    "parallel": true,
    "requests": [
      {"server": "websearch", "tool": "search", "params": {"query": "AI"}},
      {"server": "github", "tool": "search_repos", "params": {"query": "langchain"}}
    ]
  }'
```

### Python Code Execution
```bash
curl -X POST http://localhost:9000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "server": "python",
    "tool": "execute_python",
    "params": {
      "code": "result = sum(range(100))\nprint(f\"Sum: {result}\")"
    }
  }'
```

### Database Query
```bash
curl -X POST http://localhost:9000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "server": "database",
    "tool": "query",
    "params": {
      "database": "mydb",
      "sql": "SELECT * FROM users LIMIT 10"
    }
  }'
```

### Memory Store
```bash
# Set value
curl -X POST http://localhost:9000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "server": "memory",
    "tool": "set",
    "params": {"namespace": "session", "key": "user_id", "value": "12345"}
  }'

# Get value
curl -X POST http://localhost:9000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "server": "memory",
    "tool": "get",
    "params": {"namespace": "session", "key": "user_id"}
  }'
```

## Management Commands

```bash
# Version management
./mcp.sh version              # Show current version
./mcp.sh bump patch           # 1.0.0 → 1.0.1
./mcp.sh bump minor           # 1.0.0 → 1.1.0
./mcp.sh bump major           # 1.0.0 → 2.0.0
./mcp.sh bump 2.5.0           # Set specific version

# Service management
./mcp.sh start                # Start services
./mcp.sh stop                 # Stop services
./mcp.sh restart              # Restart services
./mcp.sh status               # Show status
./mcp.sh logs                 # Show all logs
./mcp.sh logs mcp-gateway     # Show specific logs

# Maintenance
./mcp.sh test                 # Run health tests
./mcp.sh backup               # Backup data
./mcp.sh clean                # Remove all resources
./mcp.sh prune                # Remove unused images
```

## Configuration

Copy `.env.template` to `.env` and customize:

```bash
cp .env.template .env
```

Key settings:
- `GITHUB_TOKEN` - GitHub API token for higher rate limits
- `MAX_EXECUTION_TIME` - Python execution timeout
- `ALLOW_WRITE_OPS` - Enable/disable database writes
- `ENABLE_METRICS` - Toggle metrics endpoint

## Gateway Features

- **Circuit Breaker**: Prevents cascading failures
- **Request Metrics**: Track latency, errors, success rates
- **Response Caching**: Optional caching for repeated requests
- **Batch Operations**: Execute multiple tools in parallel
- **Health Monitoring**: Automatic health checks every 60s
- **Automatic Retries**: Retry failed requests up to 3 times

## Available Tools by Server

### filesystem
- `read_file` - Read file contents
- `write_file` - Write content to file
- `list_files` - List directory contents
- `delete_file` - Delete a file

### websearch
- `search` - Web search via DuckDuckGo
- `search_news` - News search

### github
- `search_repos` - Search repositories
- `get_repo` - Get repository details
- `list_issues` - List repository issues

### python
- `execute_python` - Execute Python code (sandboxed)
- `validate_syntax` - Validate Python syntax

### database
- `query` - Execute SELECT queries
- `execute` - Execute INSERT/UPDATE/DELETE
- `list_tables` - List database tables
- `describe_table` - Get table schema
- `create_table` - Create new table

### memory
- `set` - Store a value
- `get` - Retrieve a value
- `delete` - Delete a value
- `list_keys` - List keys in namespace
- `batch_set` - Store multiple values
- `batch_get` - Retrieve multiple values

## Directory Structure

```
docker/
├── mcp.sh                 # Management script
├── docker-compose.yml     # Service definitions
├── .env.template          # Environment template
├── .env                   # Local configuration
├── .mcp-version           # Version tracking
├── mcp-gateway/           # Gateway service
├── mcp-servers/           # MCP server implementations
│   ├── filesystem/
│   ├── web-search/
│   ├── github/
│   ├── python-exec/
│   ├── database/
│   └── memory/
├── shared-workspace/      # Filesystem service workspace
├── data/                  # Database files
└── backups/               # Backup directory
```

## Troubleshooting

**Services not starting:**
```bash
./mcp.sh logs              # Check logs
docker ps -a               # Check container status
```

**Gateway not connecting to services:**
```bash
curl http://localhost:9000/health   # Check gateway health
curl http://localhost:9000/servers  # Check service registration
```

**Reset everything:**
```bash
./mcp.sh clean             # Remove all containers/images
./mcp.sh start             # Fresh start
```
