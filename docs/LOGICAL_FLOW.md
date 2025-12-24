# Logical Execution Flow

## Overview

The meta-agent system now enforces logical data flow to prevent nonsensical parallel execution (like a synthesizer running in parallel with researchers whose data it needs to synthesize).

## Execution Flow

```
User Query
    ↓
Meta-Coordinator (decides team composition & dependencies)
    ↓
┌─────────────────────────────────────────┐
│  Layer 0: Independent Content Producers │
│  ⚡ Run in PARALLEL                      │
│  - Researchers (different topics)        │
│  - Data gatherers                        │
└─────────────────────────────────────────┘
    ↓ (all outputs available)
┌─────────────────────────────────────────┐
│  Layer 1: Analyzers/Processors          │
│  ⚡ Run in PARALLEL                      │
│  - Analyze topic A (depends on R1)       │
│  - Analyze topic B (depends on R2)       │
│  - Analyze topic C (depends on R3)       │
└─────────────────────────────────────────┘
    ↓ (all analyses complete)
┌─────────────────────────────────────────┐
│  Layer 2: Critics (optional)            │
│  - Review & validate outputs             │
└─────────────────────────────────────────┘
    ↓ (review complete)
┌─────────────────────────────────────────┐
│  Layer 3: Synthesizer (FINAL)           │
│  - Combines ALL previous outputs         │
│  - Creates coherent final answer         │
└─────────────────────────────────────────┘
    ↓
Final Output to User
```

## Key Rules

### 1. **Logical Dependencies**
- **Synthesizers MUST wait for all content producers**
- A synthesizer cannot run in parallel with the data it needs to synthesize
- Auto-correction: If LLM creates synthesizer with no dependencies, system automatically fixes it

### 2. **Parallel Execution**
- Agents run in parallel ONLY if they are independent
- Example: 3 researchers on different topics → parallel
- Example: Synthesizer needs all researcher data → sequential (waits)

### 3. **Hierarchical Delegation**
- Each agent can create sub-agents (increases depth)
- Depth limit prevents infinite recursion
- Max depth: 5 levels (configurable)

### 4. **Guardrails**

#### Agent Count Limits:
- **Depth 0 (root)**: Max 10 agents
- **Depth > 0 (sub-tasks)**: Max 5 agents
- Simple queries: 1-2 agents only

#### Depth Limits:
- **Absolute max depth**: 5 levels
- Prevents infinite recursive delegation
- System stops and returns error if exceeded

#### Validation & Auto-Fix:
- **Synthesizer dependencies**: Auto-corrected if missing
- **Circular dependencies**: Detected and prevented
- **Forward dependencies**: Blocked (agent can't depend on future agent)

## Example Execution

### Query: "Analyze AI impact on society, economy, and politics"

**Plan Created:**
```json
{
  "agents": [
    {"role": "researcher", "task": "Research AI society impact", "depends_on": []},
    {"role": "researcher", "task": "Research AI economy impact", "depends_on": []},
    {"role": "researcher", "task": "Research AI politics impact", "depends_on": []},
    {"role": "analyzer", "task": "Analyze societal implications", "depends_on": [0]},
    {"role": "analyzer", "task": "Analyze economic implications", "depends_on": [1]},
    {"role": "analyzer", "task": "Analyze political implications", "depends_on": [2]},
    {"role": "synthesizer", "task": "Combine all analyses", "depends_on": [3, 4, 5]}
  ]
}
```

**Execution Layers:**
- **Layer 0**: Agents [0, 1, 2] - 3 researchers in PARALLEL ⚡
- **Layer 1**: Agents [3, 4, 5] - 3 analyzers in PARALLEL ⚡
- **Layer 2**: Agent [6] - 1 synthesizer (waits for all)

**Why This Works:**
- Researchers are independent → parallel execution
- Each analyzer depends on ONE researcher → parallel (different data sources)
- Synthesizer depends on ALL analyzers → waits for layer 1 to complete

## Anti-Patterns (Prevented)

### ❌ BAD: Synthesizer in Parallel with Data Sources
```json
{
  "agents": [
    {"role": "researcher", "depends_on": []},
    {"role": "synthesizer", "depends_on": []}  // ❌ WRONG!
  ]
}
```
**Auto-corrected to:**
```json
{
  "agents": [
    {"role": "researcher", "depends_on": []},
    {"role": "synthesizer", "depends_on": [0]}  // ✓ Fixed!
  ]
}
```

### ❌ BAD: Unnecessary Sequential Chain
```json
{
  "agents": [
    {"role": "researcher", "task": "Research Python", "depends_on": []},
    {"role": "researcher", "task": "Research Rust", "depends_on": [0]},  // ❌ Independent!
    {"role": "researcher", "task": "Research Go", "depends_on": [1]},    // ❌ Independent!
  ]
}
```
**Should be:**
```json
{
  "agents": [
    {"role": "researcher", "task": "Research Python", "depends_on": []},
    {"role": "researcher", "task": "Research Rust", "depends_on": []},   // ✓ Parallel!
    {"role": "researcher", "task": "Research Go", "depends_on": []},     // ✓ Parallel!
  ]
}
```

## Benefits

1. **Logical Correctness**: Synthesizers always have data to synthesize
2. **Maximum Parallelism**: Independent tasks run concurrently
3. **Safety**: Guardrails prevent runaway complexity
4. **Transparency**: Layer visualization shows execution order
5. **Auto-Correction**: System fixes common mistakes automatically

## Validation Checks

The system performs these validations:

1. **Synthesizer Check**: Synthesizers must have dependencies (auto-fixed)
2. **Self-Dependency Check**: Agent can't depend on itself
3. **Forward Dependency Check**: Agent can't depend on future agents
4. **Agent Count Check**: Enforces max agents per depth level
5. **Depth Check**: Prevents infinite recursion

## Future Enhancements

- [ ] Optimize parallel execution with resource pooling
- [ ] Add cost estimation before execution
- [ ] Implement dynamic parallelism based on system resources
- [ ] Add agent performance monitoring and caching
