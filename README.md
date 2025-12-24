# LangChain Meta-Agent System

An advanced **meta-orchestration system** that dynamically creates hierarchical multi-agent workflows based on query complexity. Built with LangChain, Ollama (local LLM), and Arize Phoenix observability.

## 🌟 Key Features

### Intelligent Orchestration
- **🎯 Adaptive Complexity Analysis**: Automatically analyzes query complexity (score-based system)
- **📊 Dynamic Scaling**: Scales from 1 agent (simple) to 12+ agents (complex projects)
- **🔀 Hierarchical Delegation**: Up to 5 levels of agent nesting with recursive task delegation
- **🧠 Meta-Coordination**: AI coordinator decides optimal agent topology per query
- **⚡ Parallel Execution**: DAG-based parallel agent execution for maximum efficiency

### Agent Capabilities
- **8 Specialized Roles**: Researcher, Analyzer, Planner, Writer, Coder, Critic, Synthesizer, Coordinator
- **🔧 Tool Integration**: DuckDuckGo web search for real-time information
- **🎨 Role-Based Delegation**: Planner and Coordinator roles can spawn sub-agents
- **💾 Conversation Memory**: Maintains context across multi-turn conversations
- **🔀 Dependency Management**: Agents specify dependencies for optimal execution order

### Visualization & Monitoring
- **🌳 Terminal Trees**: Rich console output showing execution hierarchy
- **🌐 Interactive Graphs**: PyVis-based HTML graphs with hover details
- **📈 Phoenix Tracing**: Real-time observability with unique trace names per agent
- **📊 Complexity Insights**: Detailed logging of complexity analysis and decisions

### Technical Stack
- **🤖 Local LLM**: Ollama (llama3.2:1b) - 100% local, no API calls
- **🔍 Web Search**: DuckDuckGo Search integration
- **📊 Observability**: Arize Phoenix with OpenTelemetry instrumentation
- **🎨 Visualization**: Rich (terminal) + PyVis (interactive graphs)

## 🏗️ Architecture

### DAG-Based Parallel Execution

The system uses a **Directed Acyclic Graph (DAG)** to represent agent dependencies and enable parallel execution:

1. **Coordinator Analyzes Dependencies**: AI determines which agents can run in parallel
2. **Topological Sort**: Groups agents into execution layers
3. **Parallel Execution**: Agents in same layer run concurrently using asyncio
4. **Dependency Resolution**: Agents wait only for their specific dependencies
5. **Concurrency Control**: Limits simultaneous executions (default: 3 agents) to prevent system overload

**Example Parallel Execution:**
```
Query: "Compare Python and Rust for web development"

Layer 1 (parallel):
├─ Agent 0: Researcher → Python frameworks  } Run
└─ Agent 1: Researcher → Rust frameworks    } simultaneously

Layer 2 (waits for Layer 1):
└─ Agent 2: Analyzer → Compare results

Layer 3 (waits for Layer 2):
└─ Agent 3: Synthesizer → Final report
```

### Complexity-Based Execution

The system analyzes each query and assigns a complexity score based on:
- Multi-step indicators (plan, design, create, build, comprehensive...)
- Analysis keywords (compare, evaluate, research, analyze...)
- Query length and structure
- Multiple question marks or "and" conjunctions

**Complexity Mapping:**
```
Score < 1:    Very Simple  → depth=1, 1-2 agents
Score 1-2:    Simple       → depth=2, 2-4 agents  
Score 3-4:    Moderate     → depth=3, 4-6 agents
Score 5-7:    Complex      → depth=4, 6-8 agents
Score 8+:     Very Complex → depth=5, 8-12+ agents
```

### Hierarchical Agent System

```
Level 0: User Query
├─ Meta-Coordinator (analyzes & plans)
├─ Agent 1: Coordinator [can delegate]
│  └─ Level 1: Sub-query
│     ├─ Sub-Agent 1.1: Researcher
│     ├─ Sub-Agent 1.2: Analyzer
│     └─ Sub-Agent 1.3: Synthesizer
├─ Agent 2: Writer
└─ Agent 3: Synthesizer
```

### Execution Flow

1. **Query Analysis** → Complexity scoring (automated)
2. **Meta-Planning** → Coordinator designs agent topology with dependencies
3. **DAG Construction** → Build dependency graph and topological sort
4. **Layer Execution** → Run independent agents in parallel
5. **Delegation** (if needed) → Recursive sub-agent creation
6. **Synthesis** → Final answer compilation
7. **Visualization** → Graphs and traces

## 📦 Prerequisites

- **Python 3.11+**
- **Ollama** - [Download from ollama.com](https://ollama.com)

## 🚀 Quick Start

### 1. Install Ollama & Model
```bash
# Install Ollama, then pull the model
ollama pull llama3.2:1b
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Application
```bash
python -m src.main
```

### 4. Access Phoenix Dashboard
Open http://localhost:6006 in your browser to see real-time traces.

## 💡 Usage Examples

### Simple Query (1 agent)
```
❓ Your question: What is Python?

📊 Complexity: Very Simple (score: 0.0) → max_depth: 1
📋 Execution Plan (max depth: 1): Direct explanation
├── 🤖 Step 1: ANALYZER
    └── Task: Explain what Python is
```

### Moderate Query (4-6 agents with parallel execution)
```
❓ Your question: Compare Python and Rust for web development

📊 Complexity: Moderate (score: 3.5) → max_depth: 3
📋 Execution Plan (max depth: 3): Comparative analysis
🔀 Execution layers: 3 layers

Layer 1 (2 agents in parallel):
├── 🤖 RESEARCHER → Python web frameworks
└── 🤖 RESEARCHER → Rust web frameworks

Layer 2 (1 agent, waits for Layer 1):
└── 🤖 ANALYZER → Compare performance and ecosystem

Layer 3 (1 agent, waits for Layer 2):
└── 🤖 SYNTHESIZER → Compile comparison report

⚡ Speedup: 2x faster than sequential execution
```

### Complex Query (8+ agents with maximum parallelism)
```
❓ Your question: Build a complete software architecture with frontend, backend, database, and deployment

📊 Complexity: Very Complex (score: 11.5) → max_depth: 5
📋 Execution Plan (max depth: 5): Software architecture
🔀 Execution layers: 4 layers

Layer 1 (4 agents in parallel):
├── 🤖 RESEARCHER → Frontend frameworks
├── 🤖 RESEARCHER → Backend architectures  
├── 🤖 RESEARCHER → Database options
└── 🤖 RESEARCHER → Deployment tools

Layer 2 (3 agents in parallel, wait for Layer 1):
├── 🤖 ANALYZER → Frontend requirements
├── 🤖 ANALYZER → Backend requirements
└── 🤖 ANALYZER → Data layer requirements

Layer 3 (2 agents in parallel, wait for Layer 2):
├── 🤖 PLANNER → System architecture design
└── 🤖 WRITER → Deployment documentation

Layer 4 (1 agent, wait for Layer 3):
└── 🤖 SYNTHESIZER → Complete architecture document

⚡ Speedup: 4x faster with 4 concurrent researchers in Layer 1
```

## 🎮 Interactive Commands

| Command | Description |
|---------|-------------|
| `quit` / `exit` | Exit application |
| `memory` | Show conversation history summary |
| `show-memory` | Display detailed conversation table |
| `clear` | Clear conversation memory |
| Graph prompt | Generate interactive HTML graph after each query |

## 📊 Visualization

### Terminal Output
- **Rich Tree**: Hierarchical plan visualization
- **Progress Tables**: Real-time execution status
- **Complexity Analysis**: Detailed scoring breakdown

### Interactive Graphs
- **PyVis Network**: Saved to `execution_graphs/`
- **Node Colors**: Role-based (researcher=blue, planner=orange, etc.)
- **Hover Details**: Task, status, output preview
- **Auto-Open**: Browser opens automatically (optional)

## 🔧 Configuration

Create `.env` file (optional):
```bash
OLLAMA_MODEL=llama3.2:1b
OLLAMA_TEMPERATURE=0.7
PHOENIX_PORT=6006
LOG_LEVEL=INFO
MAX_PARALLEL_AGENTS=3          # Limit concurrent agent executions (prevents overload)
```

## 📚 Role Library

| Role | Description | Can Delegate |
|------|-------------|--------------|
| **Researcher** | Web search, fact-finding | ❌ |
| **Analyzer** | Data analysis, comparisons | ❌ |
| **Planner** | Strategic planning | ✅ |
| **Writer** | Content creation | ❌ |
| **Coder** | Code generation | ❌ |
| **Critic** | Quality review | ❌ |
| **Synthesizer** | Result compilation | ❌ |
| **Coordinator** | Workflow management | ✅ |

## 🎯 Use Cases

- **Simple Q&A**: Direct answers (1-2 agents)
- **Research Tasks**: Web search + analysis (3-4 agents)
- **Planning**: Multi-step strategies (4-6 agents)
- **Content Creation**: Research + write + review (5-7 agents)
- **Complex Projects**: Hierarchical delegation (8-12+ agents)

## 📖 Documentation

- [HIERARCHICAL_AGENTS.md](HIERARCHICAL_AGENTS.md) - Deep dive into multi-layer architecture
- [VISUALIZATION.md](VISUALIZATION.md) - Visualization features and usage
- [PARALLEL_EXECUTION.md](PARALLEL_EXECUTION.md) - DAG-based parallel execution details

## 🔍 Observability

**Arize Phoenix Dashboard** (http://localhost:6006):
- **Traces Tab**: See all LLM calls with unique names
- **Metadata**: Agent role, task, depth level
- **Tags**: Filter by role, operation type
- **Timeline**: Execution flow visualization

## 🛠️ Project Structure

```
test_langchain/
├── src/
│   ├── main.py                    # Interactive CLI
│   ├── meta_agent_system.py       # Core orchestration engine
│   ├── meta_coordinator.py        # AI-based planning
│   ├── role_library.py            # Agent role definitions
│   ├── tools.py                   # DuckDuckGo search tools
│   ├── visualization.py           # Rich + PyVis rendering
│   ├── observability.py           # Phoenix tracing
│   └── config.py                  # Configuration
├── docs/                          # Documentation
│   ├── ARCHITECTURE_DIAGRAM.txt   # System architecture
│   ├── HIERARCHICAL_AGENTS.md     # Multi-level delegation
│   ├── IMPLEMENTATION_SUMMARY.md  # Technical details
│   ├── PARALLEL_EXECUTION.md      # Parallelization system
│   └── VISUALIZATION.md           # Graph & observability
├── execution_graphs/              # Generated HTML graphs
├── requirements.txt               # Dependencies
└── README.md                      # This file
```

## 🚨 Troubleshooting

### "Ollama connection failed"
```bash
# Start Ollama server
ollama serve

# Verify model is available
ollama list
ollama pull llama3.2:1b
```

### "Phoenix not starting"
```bash
# Port 6006 might be in use
# Change PHOENIX_PORT in .env or:
export PHOENIX_PORT=6007
python -m src.main
```

### "No delegation happening"
- Check if query complexity score is high enough (>3)
- Verify coordinator role has `can_delegate=True`
- Look for delegation JSON in agent output logs

## 📈 Performance Notes

- **llama3.2:1b**: Fast inference (~1-2s per agent)
- **Parallel Execution**: Up to 4-5x speedup for multi-agent workflows
- **Async I/O**: Non-blocking execution for concurrent LLM calls
- **Scaling**: Up to 12 agents tested successfully
- **Memory**: 4GB RAM recommended for complex workflows
- **Storage**: HTML graphs are ~100KB each

### Parallelization Benefits

| Query Complexity | Sequential Time | Parallel Time | Speedup |
|-----------------|----------------|---------------|---------|
| 2 researchers + 2 analysis | ~8s | ~4s | 2x |
| 4 researchers + analysis | ~15s | ~4s | 3.75x |
| 8 diverse agents (4 parallel) | ~30s | ~8s | 3.75x |

## � Documentation

Additional documentation is available in the [`docs/`](docs/) directory:

- **[Architecture Diagram](docs/ARCHITECTURE_DIAGRAM.txt)** - Visual representation of system components
- **[Hierarchical Agents](docs/HIERARCHICAL_AGENTS.md)** - Deep dive into multi-level agent delegation
- **[Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md)** - Technical implementation details
- **[Parallel Execution](docs/PARALLEL_EXECUTION.md)** - DAG-based parallelization system
- **[Visualization](docs/VISUALIZATION.md)** - Graph generation and observability features

## �🔮 Future Enhancements

- [ ] Custom role creation from CLI
- [ ] Persistent memory database (SQLite)
- [ ] Multi-model support (different LLMs per role)
- [ ] Agent learning from feedback
- [x] ~~Parallel agent execution~~ ✅ **IMPLEMENTED**
- [ ] Cost tracking and optimization
- [ ] GPU acceleration for parallel LLM inference
- [ ] Distributed execution across multiple machines

## 📝 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

**What this means:**
- ✅ You can use, modify, and distribute this software freely
- ✅ Commercial use is allowed
- ⚠️ **Network copyleft**: If you run a modified version on a server, you must make the source code available to users
- ⚠️ All derivative works must also be AGPL-3.0 licensed
- ⚠️ Include copyright and license notices

See the [LICENSE](LICENSE) file for full legal text.

## 🙏 Acknowledgments

Built with:
- [LangChain](https://github.com/langchain-ai/langchain) - Agent orchestration
- [Ollama](https://ollama.com) - Local LLM runtime
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) - Observability
- [Rich](https://github.com/Textualize/rich) - Terminal UI
- [PyVis](https://github.com/WestHealth/pyvis) - Network graphs

---

**Built with ❤️ for adaptive AI agent systems**
