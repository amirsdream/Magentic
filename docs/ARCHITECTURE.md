# Magentic Architecture

## Overview

Magentic is a dynamic meta-agent system that uses AI to generate unique agent topologies for each query.

## Flow

```
User Query
    ↓
Meta-Coordinator (AI analyzes complexity)
    ↓
Dynamic Agent Plan (unique per query)
    ↓
LangGraph Execution (state + checkpointing)
    ↓
Layer-Based Parallel Execution
    ↓
Final Output
```

## Core Components

### 1. Meta-Coordinator
- **Purpose**: AI-driven planning engine
- **Input**: User query + conversation context
- **Output**: ExecutionPlan with dynamic agent topology
- **Temperature**: 0.3 (for consistent JSON)

### 2. ExecutionPlan
- **Agents**: List of {role, task, depends_on}
- **Roles**: researcher, analyzer, planner, writer, coder, critic, synthesizer, coordinator
- **Dependencies**: Agent indices for execution order
- **Layers**: Topological sort for parallel execution

### 3. LangGraph Executor
- **State Management**: MagenticState (query, agent_outputs, trace, etc.)
- **Checkpointing**: MemorySaver for crash recovery
- **Graph Building**: Dynamic nodes/edges from AI plan
- **Execution**: Async with proper dependency resolution

### 4. Meta-Agent System
- **Agent Execution**: LLM + role-based system prompts
- **Tools**: DuckDuckGo search for researchers
- **Memory**: Conversation history (last 4 messages)
- **Observability**: Phoenix tracing per agent

## Execution Example

**Query**: "Compare Python and Rust"

**AI Plan**:
```json
{
  "agents": [
    {"role": "researcher", "task": "Python info", "depends_on": []},
    {"role": "researcher", "task": "Rust info", "depends_on": []},
    {"role": "analyzer", "task": "Compare", "depends_on": [0, 1]},
    {"role": "synthesizer", "task": "Report", "depends_on": [2]}
  ]
}
```

**Graph**:
```
START → [researcher_0, researcher_1] (parallel)
researcher_0 → analyzer_2
researcher_1 → analyzer_2
analyzer_2 → synthesizer_3
synthesizer_3 → END
```

**Execution**: 3 layers, 4 agents, parallel researchers

## Key Features

- **Dynamic**: Each query gets unique topology
- **Parallel**: Independent agents run concurrently
- **Stateful**: LangGraph preserves state across agents
- **Resumable**: Checkpoints enable crash recovery
- **Observable**: Phoenix dashboard for tracing
- **Validated**: Auto-fixes illogical dependencies

## State Schema

```python
class MagenticState(TypedDict):
    query: str                    # User query
    agent_outputs: Dict[str, Any] # Agent results
    execution_trace: List[Dict]   # Event timeline
    current_layer: int            # Execution progress
    total_layers: int             # Total layers
    messages: List[BaseMessage]   # Inter-agent msgs
    session_id: str               # Unique session
    start_time: str               # Timestamp
    final_output: Optional[str]   # Final result
```

## Complexity Scaling

| Score | Complexity | Agents | Depth |
|-------|------------|--------|-------|
| < 1   | Very Simple | 1-2   | 1     |
| 1-2   | Simple     | 2-4   | 2     |
| 3-4   | Moderate   | 4-6   | 3     |
| 5-7   | Complex    | 6-8   | 4     |
| 8+    | Very Complex| 8-12+ | 5     |
