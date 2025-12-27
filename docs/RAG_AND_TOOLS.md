# RAG & Tools Guide

## RAG (Retrieval-Augmented Generation)

### Setup

```bash
# Install dependencies
pip install qdrant-client chromadb sentence-transformers

# Start Qdrant (optional, uses in-memory by default)
docker run -p 6333:6333 qdrant/qdrant
```

### Configuration

```bash
# .env
RAG_ENABLED=true
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

### Usage

RAG is automatically available to agents via the `search_knowledge_base` tool.

---

## MCP (Model Context Protocol)

### Setup

```bash
# Start MCP Gateway
cd docker && docker-compose up -d mcp-gateway
```

### Configuration

```bash
# .env
MCP_ENABLED=true
MCP_GATEWAY_URL=http://localhost:3100
```

### Available MCP Services

| Service | Tools |
|---------|-------|
| filesystem | read_file, write_file, list_directory |
| fetch | fetch_url |
| memory | store, retrieve |

### Adding Custom MCP Servers

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

Tools are initialized in `ToolManager`:

```python
# Built-in tools
- DuckDuckGoSearchRun    # Web search
- search_knowledge_base  # RAG retrieval (if enabled)
- MCP tools              # Dynamic from MCP gateway (if enabled)
```

Agents automatically receive appropriate tools based on their role.
