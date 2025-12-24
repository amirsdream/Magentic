# Execution Visualization

The system now includes powerful visualization capabilities for tracking agent execution flow.

## Features

### 1. **Terminal-Based Tree Visualization** (Rich)
- Displays execution plan as an interactive tree before execution
- Shows agent sequence and tasks in a clear hierarchy
- Real-time progress updates during execution

### 2. **Interactive HTML Graph** (PyVis)
- Generates interactive network graph of execution flow
- Color-coded agents by role type
- Hover over nodes to see details (task, status, output)
- Hierarchical layout showing execution sequence
- Auto-opens in browser

### 3. **Memory Visualization**
- Table view of conversation history
- Shows user/assistant exchanges
- Helps track conversation context

## Available Commands

- **`memory`** - View conversation history summary
- **`show-memory`** - Display detailed conversation table
- **`clear`** - Clear conversation memory
- **Graph generation** - Prompted after each query execution

## Visualization Components

### Terminal Output (during execution):
```
📋 Execution Plan: Current info research
├── 🤖 Step 1: RESEARCHER
│   └── Task: Search for current weather in Tokyo
└── 🤖 Step 2: SYNTHESIZER
    └── Task: Format weather information
```

### Progress Display:
```
┌────────────────────────────────────────┐
│ Progress  │ 1/2                        │
│ Agent     │ 🔄 RESEARCHER              │
│ Task      │ Search for current weather │
└────────────────────────────────────────┘
```

### Interactive Graph:
- **START** (green) → **Agent 1** (blue) → **Agent 2** (purple) → **END** (green)
- Each agent node shows:
  - Role name and step number
  - Task description
  - Execution status
  - Output preview (on hover)

## Agent Color Coding

- 🔵 **Researcher** - Blue (#2196F3)
- 🟣 **Analyzer** - Purple (#9C27B0)
- 🟠 **Planner** - Orange (#FF9800)
- 🔴 **Writer** - Pink (#E91E63)
- 🔵 **Coder** - Cyan (#00BCD4)
- 🔴 **Critic** - Red (#F44336)
- 🟢 **Synthesizer** - Green (#4CAF50)

## Graph Files

Execution graphs are saved to:
```
execution_graphs/
  execution_20251224_143022.html
  execution_20251224_143145.html
  ...
```

## Usage Example

```python
# In interactive mode:
❓ Your question: What is machine learning?

# System displays:
# - Execution plan tree
# - Progress updates for each agent
# - Summary panel
# - Final answer
# - Prompt to generate graph

📊 Generate execution graph? (yes/no): yes
💾 Execution graph saved to: execution_graphs/execution_20251224_143022.html
🌐 Opened graph in browser
```

## Programmatic Usage

```python
from src.meta_agent_system import MetaAgentSystem

system = MetaAgentSystem(config, tools)

# Process query
result = system.process_query("Explain quantum computing")

# Generate and view graph
graph_path = system.generate_execution_graph(result, auto_open=True)

# View memory visualization
system.show_memory_visualization()
```

## Benefits

1. **Debugging** - See exactly which agents executed and in what order
2. **Understanding** - Visualize the decision-making process
3. **Optimization** - Identify bottlenecks or unnecessary agents
4. **Presentation** - Share execution flows with stakeholders
5. **Monitoring** - Track conversation state and memory usage
