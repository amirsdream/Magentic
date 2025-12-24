# Magentic

**Magnetic Agent Networks** - An advanced meta-orchestration system that dynamically creates hierarchical multi-agent workflows with intelligent parallel execution. Built with LangChain, Ollama (local LLM), and Arize Phoenix observability.

## 🌟 Key Features

### Intelligent Orchestration
- **🎯 Adaptive Complexity Analysis**: Automatically analyzes query complexity and scales agent topology
- **📊 Dynamic Agent Scaling**: From 1 agent (simple queries) to 12+ agents (complex projects)
- **🔀 Hierarchical Delegation**: Up to 5 levels of agent nesting with recursive task delegation
- **🧠 Meta-Coordination**: AI coordinator decides optimal agent topology per query
- **⚡ DAG-Based Parallel Execution**: Maximum efficiency through intelligent dependency resolution
- **🛡️ Logical Flow Validation**: Auto-corrects illogical dependencies (e.g., synthesizers running before data sources)

### Agent Capabilities
- **8 Specialized Roles**: Researcher, Analyzer, Planner, Writer, Coder, Critic, Synthesizer, Coordinator
- **🔧 Tool Integration**: DuckDuckGo web search with smart query extraction
- **🎨 Role-Based Delegation**: Planner and Coordinator roles spawn sub-agents for complex tasks
- **💾 Conversation Memory**: Maintains context across multi-turn conversations
- **🔀 Smart Dependency Management**: Agents specify dependencies; system validates logical flow
- **🔧 Auto-Fix Logic**: Automatically corrects common dependency errors

### Visualization & Monitoring
- **🌳 Rich Terminal Trees**: Beautiful console output showing execution hierarchy and layers
- **🌐 Interactive HTML Graphs**: PyVis-based graphs with dependency visualization
- **📈 Phoenix Tracing**: Real-time observability with unique trace names per agent
- **📊 Layer Execution**: See which agents run in parallel vs sequential

### Technical Stack
- **🤖 Local LLM**: Ollama (llama3.2:1b or any model) - 100% local, no API calls
- **🔍 Web Search**: DuckDuckGo Search with intelligent query handling
- **📊 Observability**: Arize Phoenix with OpenTelemetry instrumentation
- **🎨 Visualization**: Rich (terminal) + PyVis (interactive graphs)
- **⚡ Async Execution**: Concurrent agent execution with semaphore-based resource control

## 🏗️ Architecture

### Logical Data Flow

Magentic enforces **logical data dependencies** to prevent nonsensical parallel execution:

```
User Query
    ↓
Meta-Coordinator (analyzes & creates plan)
    ↓
┌─────────────────────────────────────────┐
│  Layer 0: Independent Content Producers │
│  ⚡ Run in PARALLEL                      │
│  - Researcher A (topic 1)                │
│  - Researcher B (topic 2)                │
│  - Researcher C (topic 3)                │
└─────────────────────────────────────────┘
    ↓ (all outputs available)
┌─────────────────────────────────────────┐
│  Layer 1: Analyzers/Processors          │
│  ⚡ Run in PARALLEL                      │
│  - Analyze topic A                       │
│  - Analyze topic B                       │
│  - Analyze topic C                       │
└─────────────────────────────────────────┘
    ↓ (all analyses complete)
┌─────────────────────────────────────────┐
│  Layer 2: Synthesizer (WAITS)           │
│  - Combines ALL previous outputs         │
│  - Creates final coherent answer         │
└─────────────────────────────────────────┘
    ↓
Final Output
```

### Key Architectural Features

**1. Dependency Validation**
- Synthesizers MUST wait for all content-producing agents
- Auto-correction of missing dependencies
- Prevention of circular and forward dependencies

**2. Parallel Execution Layers**
- Agents grouped into execution layers via topological sort
- Independent agents execute concurrently within layers
- Dependent agents wait for their required inputs

**3. Guardrails**
- Max agents: 10 at depth 0, 5 at deeper levels
- Max depth: 5 levels (prevents infinite recursion)
- Semaphore-based concurrency control (default: 3 concurrent agents)

**4. Complexity-Based Scaling**
```
Score < 1:    Very Simple  → 1-2 agents, depth=1
Score 1-2:    Simple       → 2-4 agents, depth=2  
Score 3-4:    Moderate     → 4-6 agents, depth=3
Score 5-7:    Complex      → 6-8 agents, depth=4
Score 8+:     Very Complex → 8-12+ agents, depth=5
```

## � Quick Start

### 1. Install Ollama & Model
```bash
# Install Ollama from https://ollama.com, then:
ollama pull llama3.2:1b
# Or use any other model:
# ollama pull llama3.1
# ollama pull mistral
```

### 2. Clone & Install
```bash
git clone https://github.com/yourusername/magentic.git
cd magentic
pip install -r requirements.txt
```

### 3. Run Magentic
```bash
python -m src.main
```

### 4. Access Phoenix Dashboard (Optional)
Open http://localhost:6006 to see real-time LLM traces and agent execution flows.

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
magentic/
├── src/
│   ├── main.py                    # Interactive CLI
│   ├── meta_agent_system.py       # Core orchestration engine
│   ├── meta_coordinator.py        # AI-based planning & validation
│   ├── role_library.py            # Agent role definitions
│   ├── tools.py                   # DuckDuckGo search integration
│   ├── visualization.py           # Rich + PyVis rendering
│   ├── observability.py           # Phoenix tracing setup
│   └── config.py                  # Configuration management
├── docs/                          # Documentation
│   ├── LOGICAL_FLOW.md            # Data flow & validation logic
│   ├── HIERARCHICAL_AGENTS.md     # Multi-level delegation
│   ├── PARALLEL_EXECUTION.md      # Parallelization details
│   └── VISUALIZATION.md           # Graphs & observability
├── execution_graphs/              # Generated HTML graphs
├── requirements.txt               # Python dependencies
├── LICENSE                        # AGPL-3.0 license
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

**Built with ❤️ for adaptive AI systems**

**Magentic** - Magnetic Agent Networks for Intelligent Task Execution ⚡🧲

