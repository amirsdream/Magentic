# Installation Guide

## 🚀 Automated Setup (Recommended)

**The easiest way to get started:**

```bash
./magentic.sh setup
```

The setup script will guide you through:
1. ✅ Creating a Python virtual environment
2. ✅ Installing all dependencies
3. ✅ Choosing your LLM provider (Ollama/OpenAI/Claude)
4. ✅ Configuring your `.env` file
5. ✅ Installing and pulling AI models (if using Ollama)
6. ✅ Creating necessary directories
7. ✅ Validating the installation

After setup completes:
```bash
./magentic.sh start        # Start all services
# or
./magentic.sh cli          # Interactive CLI mode
```

---

## Manual Installation

If you prefer manual installation or need to customize the setup:

### Quick Start

#### Minimal Installation (Core Only)
```bash
pip install langchain langchain-core langchain-community python-dotenv
```

#### Full Installation (All Features)
```bash
pip install -r requirements.txt
```

## Provider-Specific Installation

### 1. Using Ollama (Local, Free)
```bash
# Core
pip install langchain langchain-core langchain-ollama python-dotenv

# For RAG
pip install qdrant-client langchain-qdrant

# For tools
pip install duckduckgo-search

# For multi-agent
pip install langgraph langgraph-checkpoint

# For UI
pip install gradio fastapi uvicorn
```

**Additional Setup:**
- Install Ollama: https://ollama.ai
- Pull models: `ollama pull llama3.1` and `ollama pull nomic-embed-text`

### 2. Using OpenAI
```bash
# Core
pip install langchain langchain-core langchain-openai tiktoken python-dotenv

# For RAG
pip install qdrant-client langchain-qdrant

# For tools
pip install duckduckgo-search

# For multi-agent
pip install langgraph langgraph-checkpoint

# For UI
pip install gradio fastapi uvicorn
```

**Additional Setup:**
- Set API key: `export OPENAI_API_KEY=sk-...`

### 3. Using Claude (Anthropic)
```bash
# Core
pip install langchain langchain-core langchain-anthropic python-dotenv

# For RAG with Voyage AI (Anthropic recommended)
# Note: Voyage AI has version conflicts - install separately:
pip install langchain-voyageai
# This will downgrade langchain-core to 0.3.x for compatibility

# Or use Ollama for local embeddings (no version conflicts, no API cost)
pip install langchain-ollama

# Vector store
pip install qdrant-client langchain-qdrant

# For tools
pip install duckduckgo-search

# For multi-agent
pip install langgraph langgraph-checkpoint

# For UI
pip install gradio fastapi uvicorn
```

**Additional Setup:**
- Set Anthropic API key: `export ANTHROPIC_API_KEY=sk-ant-...`
- **For Voyage AI**: `export VOYAGE_API_KEY=voy-...` (get from voyageai.com)
  - **Warning**: Installing langchain-voyageai will downgrade langchain-core to 0.3.x
- **Recommended**: Use Ollama for free local embeddings (no version conflicts)

## Optional Components

### Vector Stores
```bash
# Qdrant (recommended)
pip install qdrant-client langchain-qdrant

# ChromaDB (alternative)
pip install chromadb langchain-chroma
```

### Embeddings
```bash
# Voyage AI (best for Claude - WARNING: has version conflicts)
# Installing this will downgrade langchain-core to 0.3.x
pip install langchain-voyageai

# OpenAI embeddings (already installed with langchain-openai)

# Ollama embeddings (already installed with langchain-ollama)
# Recommended: Use Ollama for Claude to avoid version conflicts
```

### Observability
```bash
pip install arize-phoenix openinference-instrumentation-langchain
pip install opentelemetry-api opentelemetry-sdk
pip install opentelemetry-exporter-otlp opentelemetry-exporter-otlp-proto-http
```

### Visualization
```bash
pip install pyvis rich
```

### Database & Auth
```bash
pip install sqlalchemy alembic passlib bcrypt
```

### Development Tools
```bash
pip install pytest pytest-cov black flake8 mypy
```

## Installation by Feature

### Feature: Basic Chat
```bash
pip install langchain langchain-core python-dotenv
# + your LLM provider (langchain-ollama/openai/anthropic)
```

### Feature: RAG (Document Retrieval)
```bash
# Vector store
pip install qdrant-client langchain-qdrant

# Embeddings (choose one)
pip install langchain-voyageai  # For Claude (recommended)
# OR use langchain-openai for OpenAI embeddings
# OR use langchain-ollama for local embeddings
```

### Feature: Multi-Agent System
```bash
pip install langgraph langgraph-checkpoint langsmith
```

### Feature: Web Search
```bash
pip install duckduckgo-search
```

### Feature: Web UI
```bash
pip install gradio
```

### Feature: REST API
```bash
pip install fastapi uvicorn websockets httpx
```

## Verification

Check your installation:
```bash
# Verify core packages
python -c "import langchain; print(f'LangChain: {langchain.__version__}')"

# Verify LLM provider (example for Ollama)
python -c "from langchain_ollama import ChatOllama; print('Ollama: OK')"

# Verify RAG components
python -c "from qdrant_client import QdrantClient; print('Qdrant: OK')"

# Verify multi-agent
python -c "import langgraph; print('LangGraph: OK')"

# Verify UI
python -c "import gradio; print(f'Gradio: {gradio.__version__}')"
```

## Troubleshooting

### ImportError: No module named 'langchain_text_splitters'
```bash
pip install langchain-text-splitters
```

### ImportError: No module named 'dotenv'
```bash
pip install python-dotenv
```

### ModuleNotFoundError for specific provider
```bash
# For Ollama
pip install langchain-ollama

# For OpenAI
pip install langchain-openai

# For Claude
pip install langchain-anthropic

# For Voyage AI
pip install langchain-voyageai
```

## Recommended Setup

### For Development (Local, Free)
```bash
# Install Ollama first: https://ollama.ai
ollama pull llama3.1
ollama pull nomic-embed-text

# Then install Python packages
pip install langchain langchain-core langchain-ollama \
    qdrant-client langchain-qdrant \
    duckduckgo-search \
    langgraph langgraph-checkpoint \
    gradio fastapi uvicorn \
    python-dotenv rich
```

### For Production (Cloud, API-based)
```bash

# Install packages (use Ollama for embeddings to avoid conflicts)
pip install langchain langchain-core langchain-anthropic langchain-ollama \
    qdrant-client langchain-qdrant \
    duckduckgo-search \
    langgraph langgraph-checkpoint \
    gradio fastapi uvicorn \
    python-dotenv rich \
    arize-phoenix openinference-instrumentation-langchain

# Optional: Install Voyage AI (will downgrade langchain-core to 0.3.x)
# export VOYAGE_API_KEY=voy-...
# pip install langchain-voyageai
    python-dotenv rich \
    arize-phoenix openinference-instrumentation-langchain
```

## Minimal vs Full Install Size

- **Minimal** (core only): ~200MB
- **With Ollama support**: ~300MB
- **With OpenAI support**: ~250MB
- **With Claude + Voyage AI**: ~280MB
- **Full installation**: ~500MB

Note: torch/sentence-transformers NOT required (we use API-based or Ollama embeddings)
