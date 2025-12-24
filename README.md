# Magentic

**Magnetic Agent Networks** - AI-powered meta-agent system with dynamic topology generation and parallel execution.

## Features

- 🎯 **Dynamic Planning**: AI generates unique agent topologies per query
- ⚡ **Parallel Execution**: DAG-based layer execution with LangGraph
- �� **State Management**: Checkpointing and crash recovery
- 🔍 **Web Search**: DuckDuckGo integration for research agents
- 📊 **Observability**: Phoenix dashboard for real-time tracing
- 🎨 **8 Agent Roles**: Researcher, Analyzer, Planner, Writer, Coder, Critic, Synthesizer, Coordinator

## Quick Start

### 1. Install Dependencies

```bash
# Install Ollama from https://ollama.com
ollama pull llama3.2:1b

# Install Python packages
pip install -r requirements.txt
```

### 2. Run

```bash
python app.py
```

### 3. Phoenix Dashboard (Optional)

Open http://localhost:6006 for real-time LLM tracing

## Usage

```
❓ Your question: Compare Python and Rust for web development

Building dynamic graph with 4 agents in 3 layers
  Layer 0: [researcher_0, researcher_1] (parallel)
  Layer 1: [analyzer_2]
  Layer 2: [synthesizer_3]
  
✓ Execution Complete!
```

## Commands

- `help` - Show commands
- `memory` - View conversation history
- `clear` - Clear memory
- `quit` - Exit

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## Configuration

Edit `.env` or use defaults:
- Model: `llama3.2:1b`
- Temperature: `0.7`
- Max parallel agents: `3`

## Tech Stack

- **LangChain** - Agent orchestration
- **LangGraph** - State management & checkpointing
- **Ollama** - Local LLM (100% local, no API calls)
- **Phoenix** - Observability
- **Rich** - Terminal UI

## License

MIT License - see [LICENSE](LICENSE)
