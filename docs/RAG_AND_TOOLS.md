# RAG & Tools

## RAG (Retrieval-Augmented Generation)

Magentic supports two RAG modes:

| Mode | Description |
|------|-------------|
| **Active** | Automatic context injection before planning |
| **Passive** | Agent tool calls during execution |

### Active RAG

Automatically searches knowledge base and enriches queries:

```
Query → RAG Search → Enriched Query → MetaCoordinator → Better Plan
```

**Benefits:**
- Coordinator makes informed agent decisions
- Context available from the start
- No explicit tool call needed

### Setup

```bash
# Install dependencies
pip install qdrant-client chromadb sentence-transformers

# Optional: Start Qdrant server
docker run -p 6333:6333 qdrant/qdrant
```

### Configuration

```bash
ENABLE_RAG=true
RAG_VECTOR_STORE=qdrant          # or "chroma"
RAG_EMBEDDING_MODEL=all-MiniLM-L6-v2
QDRANT_URL=http://localhost:6333  # for Qdrant
CHROMA_PATH=./data/chroma         # for ChromaDB
```

### Adding Documents

```python
from src.services import RAGService

rag = RAGService()
rag.add_documents([
    {"content": "Your text here", "metadata": {"source": "doc1"}},
])
```

### Passive RAG

Agents call `search_knowledge_base` tool:

```python
# Agent can invoke:
search_knowledge_base(query="specific topic")
```

---

## MCP (Model Context Protocol)

Extensible tool integration via Docker.

### Setup

```bash
# Start MCP Gateway
./magentic.sh mcp

# Or manually
cd docker && docker compose up -d mcp-gateway
```

### Configuration

```bash
MCP_ENABLED=true
MCP_GATEWAY_URL=http://localhost:3100
```

### Available Services

| Service | Tools |
|---------|-------|
| `filesystem` | read_file, write_file, list_directory |
| `fetch` | fetch_url |
| `memory` | store, retrieve |
| `github` | GitHub API operations |
| `web-search` | Web search |

### Adding Custom Servers

Edit `docker/mcp-gateway/config.json`:

```json
{
  "servers": {
    "my-server": {
      "command": "node",
      "args": ["path/to/server.js"]
    }
  }
}
```

---

## Tool Manager

Tools initialized in `ToolManager`:

```python
# Built-in tools
- DuckDuckGoSearchRun      # Web search
- search_knowledge_base    # RAG (if enabled)
- MCP tools                # Dynamic (if enabled)
```

Agents receive tools based on their role.

---

## Vector Stores

| Store | Use Case |
|-------|----------|
| **Qdrant** | Production (memory or server mode) |
| **ChromaDB** | Local development |

### Embeddings

| Provider | Model |
|----------|-------|
| Ollama | `nomic-embed-text` (local) |
| OpenAI | `text-embedding-3-small` |
| Voyage | `voyage-3` |
