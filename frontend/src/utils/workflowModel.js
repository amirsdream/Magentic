/**
 * Workflow model for the Magentic studio orchestrator.
 * Normalizes execution/plan agents into editable workflow documents
 * and persists a loadable library in localStorage.
 */

const LIBRARY_KEY = 'magentic-workflow-library';

export function statusOf(agent) {
  const s = agent?.status;
  if (s === 'complete' || s === 'completed') return 'complete';
  if (s === 'error' || s === 'failed') return 'error';
  if (s === 'stopped') return 'stopped';
  if (s === 'running') return 'running';
  return 'pending';
}

/**
 * Build a workflow document from a live or historical execution.
 */
export function workflowFromExecution(execution, { id, name, source } = {}) {
  if (!execution) return null;
  const agents = execution.agents || execution.plan?.agents || [];
  const list = Array.isArray(agents) ? agents : [];
  const pipelineId =
    execution.pipelineId ||
    execution.session_id ||
    execution.plan?.pipeline_id ||
    id ||
    `wf_${Date.now()}`;

  const steps = list.map((agent, index) => ({
    id: agent.agent_id || `step_${index + 1}`,
    role: agent.role || `agent_${index + 1}`,
    task: agent.task || '',
    layer: agent.layer ?? index,
    status: statusOf(agent),
    output: agent.output || '',
    logs: Array.isArray(agent.logs) ? agent.logs : [],
    tool_calls: Array.isArray(agent.tool_calls) ? agent.tool_calls : [],
  }));

  return {
    id: String(pipelineId),
    name:
      name ||
      execution.plan?.description ||
      execution.stageMessage ||
      execution.query ||
      'Untitled workflow',
    description: execution.plan?.description || execution.plan?.message || '',
    prompt: execution.query || execution.prompt || execution.approval?.prompt || '',
    source: source || (execution.stage === 'awaiting_approval' ? 'live' : 'execution'),
    stage: execution.stage || 'idle',
    updatedAt: new Date().toISOString(),
    steps,
  };
}

/**
 * Merge live agent runtime state into a workflow document (status/logs/tools).
 */
export function mergeLiveIntoWorkflow(workflow, execution) {
  if (!workflow) return null;
  if (!execution) return workflow;
  const liveAgents = execution.agents || [];
  const byId = new Map(liveAgents.map((a) => [a.agent_id, a]));

  return {
    ...workflow,
    stage: execution.stage || workflow.stage,
    steps: workflow.steps.map((step) => {
      const live = byId.get(step.id);
      if (!live) return step;
      return {
        ...step,
        status: statusOf(live),
        output: live.output || step.output,
        logs: Array.isArray(live.logs) ? live.logs : step.logs,
        tool_calls: Array.isArray(live.tool_calls) ? live.tool_calls : step.tool_calls,
        role: live.role || step.role,
        task: live.task || step.task,
      };
    }),
  };
}

export function emptyWorkflow(name = 'New workflow') {
  const id = `draft_${Date.now()}`;
  return {
    id,
    name,
    description: '',
    prompt: '',
    source: 'draft',
    stage: 'draft',
    updatedAt: new Date().toISOString(),
    steps: [
      {
        id: `${id}:step_1`,
        role: 'coordinator',
        task: 'Plan the approach',
        layer: 0,
        status: 'pending',
        output: '',
        logs: [],
        tool_calls: [],
      },
    ],
  };
}

export function loadWorkflowLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWorkflowToLibrary(workflow) {
  if (!workflow?.id) return loadWorkflowLibrary();
  const existing = loadWorkflowLibrary().filter((w) => w.id !== workflow.id);
  const next = [
    { ...workflow, updatedAt: new Date().toISOString(), source: workflow.source || 'saved' },
    ...existing,
  ].slice(0, 40);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
  return next;
}

export function removeWorkflowFromLibrary(id) {
  const next = loadWorkflowLibrary().filter((w) => w.id !== id);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
  return next;
}

export function createStep(workflowId, index = 0) {
  return {
    id: `${workflowId}:step_${Date.now()}`,
    role: 'researcher',
    task: 'Describe this step…',
    layer: index,
    status: 'pending',
    output: '',
    logs: [],
    tool_calls: [],
  };
}

/** Build ReactFlow nodes/edges from workflow steps (left-to-right by layer). */
export function graphFromWorkflow(workflow) {
  const steps = workflow?.steps || [];
  if (!steps.length) return { nodes: [], edges: [] };

  const byLayer = new Map();
  steps.forEach((step) => {
    const layer = step.layer ?? 0;
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer).push(step);
  });
  const layers = Array.from(byLayer.keys()).sort((a, b) => a - b);

  const COL_W = 240;
  const ROW_H = 110;
  const nodes = [];
  const edges = [];

  layers.forEach((layer, layerIdx) => {
    const column = byLayer.get(layer);
    column.forEach((step, rowIdx) => {
      const yOffset = ((column.length - 1) * ROW_H) / -2;
      nodes.push({
        id: step.id,
        type: 'workflowStep',
        position: { x: layerIdx * COL_W, y: yOffset + rowIdx * ROW_H },
        data: { ...step },
        draggable: true,
      });
    });
  });

  // Sequential edges between consecutive layers (all-to-all soft links for parallel)
  for (let i = 0; i < layers.length - 1; i += 1) {
    const from = byLayer.get(layers[i]);
    const to = byLayer.get(layers[i + 1]);
    from.forEach((src) => {
      to.forEach((dst) => {
        const srcStatus = statusOf(src);
        const animated = srcStatus === 'running' || statusOf(dst) === 'running';
        const done = srcStatus === 'complete';
        edges.push({
          id: `${src.id}->${dst.id}`,
          source: src.id,
          target: dst.id,
          type: 'smoothstep',
          animated,
          style: {
            stroke: done ? '#14b8a6' : animated ? '#0ea5e9' : '#94a3b8',
            strokeWidth: 2,
          },
        });
      });
    });
  }

  // If single layer / sequential without layers, chain by order
  if (layers.length <= 1 && steps.length > 1) {
    edges.length = 0;
    for (let i = 0; i < steps.length - 1; i += 1) {
      const src = steps[i];
      const dst = steps[i + 1];
      const srcStatus = statusOf(src);
      edges.push({
        id: `${src.id}->${dst.id}`,
        source: src.id,
        target: dst.id,
        type: 'smoothstep',
        animated: srcStatus === 'running' || statusOf(dst) === 'running',
        style: {
          stroke: srcStatus === 'complete' ? '#14b8a6' : '#94a3b8',
          strokeWidth: 2,
        },
      });
    }
    nodes.forEach((n, i) => {
      n.position = { x: i * COL_W, y: 0 };
    });
  }

  return { nodes, edges };
}
