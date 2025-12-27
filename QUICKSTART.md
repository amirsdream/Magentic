# Quick Start Guide

Get Magentic running in 5 minutes! 🚀

## For Complete Beginners

If you've never used a terminal or Python before, follow these steps:

### 1. Install Prerequisites

**Python 3.10+**
- **Mac**: Download from [python.org](https://www.python.org/downloads/)
- **Linux**: `sudo apt install python3 python3-venv` (Ubuntu/Debian)
- **Windows**: Download from [python.org](https://www.python.org/downloads/)

**Git** (to clone the repository)
- **Mac**: Install Xcode Command Line Tools: `xcode-select --install`
- **Linux**: `sudo apt install git`
- **Windows**: Download from [git-scm.com](https://git-scm.com/)

**Docker** (optional, for MCP services)
- Download from [docker.com](https://www.docker.com/products/docker-desktop/)

### 2. Clone the Repository

Open your terminal and run:

```bash
git clone <your-repository-url>
cd test_langchain
```

### 3. Run the Automated Setup

```bash
chmod +x magentic.sh
./magentic.sh setup
```

The script will ask you a few questions:

1. **LLM Provider**: Choose option `1` for Ollama (free, local, no API key needed)
2. **Recreate virtual environment?**: Type `N` if this is your first time
3. **Install Ollama?**: Type `y` to install automatically (Mac/Linux only)

The setup will:
- Create a Python virtual environment
- Install all required packages
- Download AI models (~2-5 GB)
- Configure your `.env` file

This may take 5-15 minutes depending on your internet speed.

### 4. Start Everything

```bash
# Start all services (MCP, API, Frontend)
./magentic.sh start
```

Or for interactive CLI mode:

```bash
./magentic.sh cli
```

You should see:
```
╭─────────────────────────────────────────────────────────╮
│ Magentic - Magnetic Agent Networks                      │
│ Dynamic meta-agent system with LangGraph infrastructure │
╰─────────────────────────────────────────────────────────╯

✓ System ready! LangGraph infrastructure enabled.

❓ Your question:
> 
```

### 5. Try It Out!

Type a question:
```
> What is machine learning?
```

Press Enter and watch Magentic:
1. 📋 Create an execution plan
2. 🤖 Spawn specialized agents
3. ⚡ Execute agents in parallel
4. ✅ Synthesize the final answer

## Usage Examples

**Simple queries** (1 agent):
```
> What is Python?
> Explain quantum computing
> How do I make tea?
```

**Complex queries** (multiple agents in parallel):
```
> Research AI trends in 2025 and write a summary
> Create a plan for learning machine learning
> Compare Python and JavaScript, then write code examples
```

**With web search**:
```
> What are the latest developments in AI?
> Search for current weather in Tokyo
> Find recent news about SpaceX
```

## Commands

While chatting:
- `quit` or `exit` - Exit the application
- `memory` - Show conversation history summary
- `clear` - Clear conversation memory
- `show-memory` - Display detailed conversation table
- `help` - Show help message

## Management Commands

```bash
# Full stack
./magentic.sh start       # Start all services
./magentic.sh stop        # Stop all services
./magentic.sh status      # Show status
./magentic.sh restart     # Restart all

# Individual
./magentic.sh cli         # Interactive CLI
./magentic.sh api         # API server only
./magentic.sh mcp         # MCP Docker services
./magentic.sh frontend    # Frontend dev server

# Cleanup
./magentic.sh remove      # Remove all resources
./magentic.sh db-reset    # Reset database
```

## Troubleshooting

### "Ollama service is not running"

Start Ollama in a new terminal:
```bash
ollama serve
```

Then restart the app.

### "No module named 'langchain'"

Activate the virtual environment:
```bash
source .venv/bin/activate  # Mac/Linux
.venv\Scripts\activate     # Windows
```

### "Permission denied: ./magentic.sh"

Make it executable:
```bash
chmod +x magentic.sh
```

### "Docker not available"

MCP services require Docker. The system works without it but has fewer capabilities:
```bash
# Check if Docker is running
docker info

# Start Docker, then
./magentic.sh mcp
```

### Out of memory / Models too large

Edit `.env` and change to a smaller model:
```bash
OLLAMA_MODEL=llama3.2:1b  # Smallest, ~1.3GB
# or
OLLAMA_MODEL=phi3:mini    # ~2.3GB
```

Then pull the new model:
```bash
ollama pull llama3.2:1b
```

## Next Steps

Once you're comfortable with the basics:

1. **Try different models**: Edit `.env` to change `OLLAMA_MODEL`
2. **Add your own documents**: Use the RAG system to search your knowledge base
3. **Enable MCP**: Start Docker and run `./magentic.sh mcp` for advanced tool capabilities
4. **Enable observability**: Set `ENABLE_OBSERVABILITY=true` in `.env`
5. **Try other LLM providers**: Configure OpenAI or Claude in `.env`

## Getting Help

- **Detailed docs**: See [INSTALL.md](INSTALL.md) for manual installation
- **Architecture**: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Issues**: Open an issue on GitHub
- **Examples**: Check `execution_graphs/` for visual execution logs

## Summary

**One-line setup:**
```bash
./magentic.sh setup && ./magentic.sh start
```

That's it! You're now running an advanced multi-agent AI system locally. 🎉
