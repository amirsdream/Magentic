# Hierarchical Multi-Layer Agent Architecture

The system now supports **hierarchical multi-layer agent execution** where agents can delegate work to specialized sub-agents, creating tree-like execution flows.

## Key Features

### 1. **Depth-Limited Recursion**
- Maximum depth: 3 levels (configurable)
- Prevents infinite delegation loops
- Each level is tracked and displayed

### 2. **Delegation-Capable Roles**
New roles that can create sub-agents:
- **Planner** - Can delegate complex planning to sub-agents
- **Coordinator** (NEW) - Specialized in managing multi-step workflows

### 3. **Dynamic Sub-Agent Creation**
Agents can:
- Analyze their task complexity
- Decide if delegation is beneficial
- Create appropriate sub-agent workflows
- Synthesize sub-results into final output

## Architecture

```
User Query (Level 0)
├── Meta-Coordinator creates plan
├── Agent 1: Coordinator [CAN DELEGATE]
│   └── Sub-Query (Level 1)
│       ├── Sub-Agent 1.1: Researcher
│       ├── Sub-Agent 1.2: Analyzer
│       └── Sub-Agent 1.3: Synthesizer
├── Agent 2: Writer
└── Agent 3: Synthesizer
```

## How It Works

### Step 1: Role Detection
```python
@dataclass
class AgentRole:
    name: str
    can_delegate: bool = False  # NEW: Delegation capability
```

### Step 2: Delegation Decision
When a `can_delegate=True` agent executes:
1. Agent receives special delegation prompt
2. Can respond with JSON to request delegation:
```json
{
  "needs_delegation": true,
  "subtasks": [
    {"role": "researcher", "task": "Find X"},
    {"role": "analyzer", "task": "Analyze Y"}
  ]
}
```
3. Or complete task directly (no delegation)

### Step 3: Recursive Execution
```python
def process_query(self, query: str, depth: int = 0):
    if depth >= max_depth:
        return "Max depth reached"
    
    # Create plan at current depth
    plan = coordinator.create_execution_plan(query, depth=depth)
    
    # Execute agents
    for agent in plan.agents:
        if agent.can_delegate:
            # Agent may create sub-query at depth+1
            result = self.process_query(subtask, depth=depth+1)
```

### Step 4: Result Synthesis
- Sub-agent results are collected
- Parent agent synthesizes into final output
- Results bubble up through layers

## Example Scenarios

### Scenario 1: Simple Query (No Delegation)
```
Query: "What is Python?"
Level 0: Analyzer → Direct answer
```

### Scenario 2: Complex Planning (With Delegation)
```
Query: "Create a complete business plan for a coffee shop"

Level 0: Coordinator [delegates]
  ├── Level 1: Researcher → Market research
  ├── Level 1: Planner [delegates]
  │   ├── Level 2: Analyzer → Financial projections
  │   ├── Level 2: Writer → Marketing strategy
  │   └── Level 2: Synthesizer → Combine plans
  └── Level 1: Synthesizer → Final business plan
```

### Scenario 3: Multi-Domain Task
```
Query: "Compare machine learning frameworks and create a selection guide"

Level 0: Coordinator [delegates]
  ├── Level 1: Researcher → Find framework info
  ├── Level 1: Analyzer [delegates]
  │   ├── Level 2: Analyzer → Technical comparison
  │   └── Level 2: Critic → Pros/cons analysis
  └── Level 1: Writer → Create guide
```

## Visualization Changes

### Terminal Output
```
📋 Execution Plan (depth 0): Business planning workflow
├── 🤖 Step 1: COORDINATOR 🔀
│   └── Task: Create comprehensive business plan
│   └── (Can delegate to sub-agents)
└── 🤖 Step 2: SYNTHESIZER
    └── Task: Format final output

  📋 Execution Plan (depth 1): Market and financial analysis
  ├── 🤖 Step 1: RESEARCHER
  │   └── Task: Market research
  └── 🤖 Step 2: ANALYZER
      └── Task: Financial projections
```

### Interactive Graph
- Hierarchical layout shows depth levels
- Sub-graphs for delegated work
- Color coding by depth
- Hover shows depth and parent task

## Configuration

```python
# In MetaAgentSystem.__init__
self.max_depth = 3  # Maximum nesting levels

# In process_query
result = system.process_query(query, depth=0)

# Depth is automatically tracked and incremented
```

## Benefits

1. **Scalability**: Handle arbitrarily complex tasks
2. **Modularity**: Each agent focused on specific sub-task
3. **Reusability**: Sub-agent patterns emerge naturally
4. **Clarity**: Hierarchical structure shows decision flow
5. **Control**: Depth limits prevent runaway recursion

## Depth Tracking

- **depth=0**: Root query (user-facing)
- **depth=1**: First layer of delegation
- **depth=2**: Second layer (sub-sub-agents)
- **depth=3**: Maximum depth (no further delegation)

## API Changes

### Before (Flat)
```python
result = system.process_query("complex question")
# Always single-layer execution
```

### After (Hierarchical)
```python
result = system.process_query("complex question", depth=0)
# Agents can create multi-layer execution trees
```

## Role Library Updates

```python
roles = {
    "planner": AgentRole(
        can_delegate=True  # NEW
    ),
    "coordinator": AgentRole(  # NEW ROLE
        name="coordinator",
        can_delegate=True,
        description="Manages complex workflows"
    ),
    "researcher": AgentRole(
        can_delegate=False  # Cannot delegate
    ),
    # ... other roles
}
```

## Monitoring & Debugging

- Each depth level logged with indent
- Phoenix traces show hierarchical structure
- Visualization graphs display tree layout
- Depth limits prevent infinite loops

## Future Enhancements

1. **Parallel Delegation**: Execute sub-agents concurrently
2. **Dynamic Depth Limits**: Adjust based on task complexity
3. **Cost Tracking**: Monitor LLM calls per depth level
4. **Smart Caching**: Reuse sub-agent results
5. **Cycle Detection**: Prevent circular delegation
