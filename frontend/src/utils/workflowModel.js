/**
 * Workflow model for Magentic studio — Ropex pipeline YAML aware.
 *
 * Ropex definition shape (exported by Magentic):
 *   pipeline:
 *     id, description, prompt, stage_count
 *     stages:
 *       - id, layer
 *         agents: [{ id, role, task, status }]
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

/** Flatten stages → steps for canvas / actions. */
export function stepsFromStages(stages = []) {
  const steps = [];
  stages.forEach((stage) => {
    const layer = stage.layer ?? 0;
    (stage.agents || []).forEach((agent, index) => {
      steps.push({
        id: agent.id || agent.agent_id || `${stage.id || 'stage'}:${index}`,
        role: agent.role || `agent_${index + 1}`,
        task: agent.task || '',
        layer,
        stageId: stage.id || `stage_${layer}`,
        status: statusOf(agent),
        output: agent.output || '',
        logs: Array.isArray(agent.logs) ? agent.logs : [],
        tool_calls: Array.isArray(agent.tool_calls) ? agent.tool_calls : [],
      });
    });
  });
  return steps;
}

/** Group flat steps back into Ropex stages by layer. */
export function stagesFromSteps(steps = []) {
  const byLayer = new Map();
  steps.forEach((step) => {
    const layer = step.layer ?? 0;
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer).push(step);
  });
  return Array.from(byLayer.keys())
    .sort((a, b) => a - b)
    .map((layer) => ({
      id: `stage_${layer}`,
      layer,
      status: stageStatus(byLayer.get(layer)),
      agents: byLayer.get(layer).map((s) => ({
        id: s.id,
        role: s.role,
        task: s.task,
        status: s.status,
        output: s.output,
        logs: s.logs,
        tool_calls: s.tool_calls,
      })),
    }));
}

function stageStatus(agents = []) {
  if (!agents.length) return 'pending';
  if (agents.some((a) => statusOf(a) === 'running')) return 'running';
  if (agents.every((a) => statusOf(a) === 'complete')) return 'complete';
  if (agents.some((a) => statusOf(a) === 'error')) return 'error';
  if (agents.some((a) => statusOf(a) === 'stopped')) return 'stopped';
  if (agents.some((a) => statusOf(a) === 'complete')) return 'partial';
  return 'pending';
}

/**
 * Parse Ropex-style pipeline YAML (or legacy workflow.steps YAML) into a document.
 * Minimal parser — handles the shapes Magentic emits.
 */
export function parseRopexWorkflowYaml(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    // Prefer structured JSON if somehow passed
    if (text.trim().startsWith('{')) {
      const json = JSON.parse(text);
      return normalizePipelineDoc(json.pipeline || json.workflow || json);
    }
  } catch {
    /* fall through to line parser */
  }

  const lines = text.split(/\r?\n/);
  const doc = {
    id: '',
    description: '',
    prompt: '',
    stage_count: 0,
    stages: [],
  };
  let currentStage = null;
  let currentAgent = null;
  let mode = null; // 'pipeline' | 'stage' | 'agent'

  const unquote = (v) => {
    const s = String(v ?? '').trim();
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))
    ) {
      try {
        return JSON.parse(s.startsWith("'") ? `"${s.slice(1, -1)}"` : s);
      } catch {
        return s.slice(1, -1);
      }
    }
    return s;
  };

  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.match(/^\s*/)[0].length;
    const line = raw.trim();

    if (line === 'pipeline:' || line === 'workflow:') {
      mode = 'pipeline';
      continue;
    }
    if (line === 'stages:' || line === 'steps:') {
      mode = 'stages';
      continue;
    }
    if (line.startsWith('- id:') || line.startsWith('-id:')) {
      const id = unquote(line.replace(/^-?\s*id:\s*/, ''));
      // Shallow list items are stages; deeper list items are agents
      const isStageItem = indent <= 4;
      if (isStageItem) {
        currentStage = { id, layer: doc.stages.length, agents: [] };
        doc.stages.push(currentStage);
        currentAgent = null;
        mode = 'stage';
      } else {
        currentAgent = {
          id,
          role: '',
          task: '',
          status: 'pending',
        };
        if (!currentStage) {
          currentStage = {
            id: `stage_${doc.stages.length}`,
            layer: doc.stages.length,
            agents: [],
          };
          doc.stages.push(currentStage);
        }
        currentStage.agents.push(currentAgent);
        mode = 'agent';
      }
      continue;
    }
    if (line === 'agents:') {
      mode = 'agents';
      continue;
    }

    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    const val = unquote(value);

    if (mode === 'pipeline' || (indent <= 2 && !currentStage)) {
      if (key === 'id') doc.id = val;
      if (key === 'description') doc.description = val;
      if (key === 'prompt') doc.prompt = val;
      if (key === 'stage_count' || key === 'stages') {
        if (key === 'stage_count' || (!Number.isNaN(Number(val)) && value !== '')) {
          doc.stage_count = Number(val) || doc.stage_count;
        }
      }
      continue;
    }
    if (mode === 'stage' && currentStage) {
      if (key === 'layer') currentStage.layer = Number(val) || 0;
      if (key === 'id') currentStage.id = val;
      continue;
    }
    if ((mode === 'agent' || mode === 'agents') && currentAgent) {
      if (key === 'role') currentAgent.role = val;
      if (key === 'task') currentAgent.task = val;
      if (key === 'status') currentAgent.status = val;
      if (key === 'layer' && currentStage) currentStage.layer = Number(val) || currentStage.layer;
    }
  }

  // Legacy: steps at root without stages — treat each as its own stage
  if (!doc.stages.length) return null;
  if (!doc.stage_count) doc.stage_count = doc.stages.length;
  return doc;
}

function normalizePipelineDoc(raw) {
  if (!raw) return null;
  if (Array.isArray(raw.stages)) {
    return {
      id: raw.id || '',
      description: raw.description || '',
      prompt: raw.prompt || '',
      stage_count: raw.stage_count || raw.stages.length,
      stages: raw.stages,
    };
  }
  if (Array.isArray(raw.steps)) {
    const steps = raw.steps.map((s, i) => ({
      id: s.id || s.agent_id || `step_${i}`,
      role: s.role,
      task: s.task,
      status: s.status || 'pending',
      layer: s.layer ?? i,
      logs: s.logs || [],
      tool_calls: s.tool_calls || [],
      output: s.output || '',
    }));
    return {
      id: raw.id || '',
      description: raw.description || '',
      prompt: raw.prompt || '',
      stage_count: raw.stages || steps.length,
      stages: stagesFromSteps(steps),
    };
  }
  return null;
}

export function workflowFromPipelineDoc(doc, extras = {}) {
  if (!doc) return null;
  const stages = (doc.stages || []).map((stage, idx) => ({
    id: stage.id || `stage_${stage.layer ?? idx}`,
    layer: stage.layer ?? idx,
    status: stageStatus(stage.agents || []),
    agents: (stage.agents || []).map((a, i) => ({
      id: a.id || a.agent_id || `agent_${i}`,
      role: a.role || `agent_${i + 1}`,
      task: a.task || '',
      status: statusOf(a),
      output: a.output || '',
      logs: a.logs || [],
      tool_calls: a.tool_calls || [],
    })),
  }));
  const steps = stepsFromStages(stages);
  return {
    id: String(doc.id || extras.id || `wf_${Date.now()}`),
    name: extras.name || doc.description || doc.prompt || 'Untitled pipeline',
    description: doc.description || '',
    prompt: doc.prompt || extras.prompt || '',
    source: extras.source || 'ropex',
    stage: extras.stage || 'idle',
    updatedAt: new Date().toISOString(),
    stage_count: doc.stage_count || stages.length,
    stages,
    steps,
    definitionYaml: extras.definitionYaml || '',
  };
}

/** Build workflow from live / historical execution (+ optional Ropex YAML). */
export function workflowFromExecution(execution, { id, name, source } = {}) {
  if (!execution) return null;

  const yamlText =
    execution.workflowYaml ||
    execution.approval?.workflow_yaml ||
    '';
  if (yamlText) {
    const parsed = parseRopexWorkflowYaml(yamlText);
    if (parsed) {
      const base = workflowFromPipelineDoc(parsed, {
        id:
          execution.pipelineId ||
          execution.session_id ||
          parsed.id ||
          id,
        name:
          name ||
          execution.plan?.description ||
          parsed.description ||
          execution.query,
        source: source || 'live',
        stage: execution.stage || 'idle',
        prompt: execution.query || execution.prompt || parsed.prompt,
        definitionYaml: yamlText,
      });
      return mergeLiveIntoWorkflow(base, execution);
    }
  }

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
    stageId: `stage_${agent.layer ?? index}`,
    status: statusOf(agent),
    output: agent.output || '',
    logs: Array.isArray(agent.logs) ? agent.logs : [],
    tool_calls: Array.isArray(agent.tool_calls) ? agent.tool_calls : [],
  }));
  const stages = stagesFromSteps(steps);

  return {
    id: String(pipelineId),
    name:
      name ||
      execution.plan?.description ||
      execution.stageMessage ||
      execution.query ||
      'Untitled pipeline',
    description: execution.plan?.description || execution.plan?.message || '',
    prompt: execution.query || execution.prompt || execution.approval?.prompt || '',
    source: source || (execution.stage === 'awaiting_approval' ? 'live' : 'execution'),
    stage: execution.stage || 'idle',
    updatedAt: new Date().toISOString(),
    stage_count: execution.plan?.stages || stages.length,
    stages,
    steps,
    definitionYaml: yamlText || '',
  };
}

export function mergeLiveIntoWorkflow(workflow, execution) {
  if (!workflow) return null;
  if (!execution) return workflow;
  const liveAgents = execution.agents || [];
  const byId = new Map(liveAgents.map((a) => [a.agent_id, a]));

  const steps = (workflow.steps || []).map((step) => {
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
      layer: live.layer ?? step.layer,
    };
  });

  return {
    ...workflow,
    stage: execution.stage || workflow.stage,
    steps,
    stages: stagesFromSteps(steps),
  };
}

export function emptyWorkflow(name = 'New workflow') {
  const id = `draft_${Date.now()}`;
  const steps = [
    {
      id: `${id}:coordinator`,
      role: 'coordinator',
      task: 'Plan the approach',
      layer: 0,
      status: 'pending',
      output: '',
      logs: [],
      tool_calls: [],
    },
  ];
  return {
    id,
    name,
    description: '',
    prompt: '',
    source: 'draft',
    stage: 'draft',
    updatedAt: new Date().toISOString(),
    stage_count: 1,
    stages: stagesFromSteps(steps),
    steps,
    definitionYaml: '',
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

/** Export workflow back to Ropex pipeline YAML. */
export function toRopexPipelineYaml(workflow) {
  const stages = workflow.stages?.length
    ? workflow.stages
    : stagesFromSteps(workflow.steps || []);
  const lines = ['pipeline:'];
  lines.push(`  id: ${JSON.stringify(workflow.id || 'pending')}`);
  lines.push(`  description: ${JSON.stringify(workflow.description || workflow.name || '')}`);
  if (workflow.prompt) {
    lines.push(`  prompt: ${JSON.stringify(workflow.prompt)}`);
  }
  lines.push(`  stage_count: ${workflow.stage_count || stages.length}`);
  lines.push('  stages:');
  if (!stages.length) {
    lines.push('    []');
    return `${lines.join('\n')}\n`;
  }
  stages.forEach((stage) => {
    lines.push(`    - id: ${JSON.stringify(stage.id)}`);
    lines.push(`      layer: ${stage.layer ?? 0}`);
    lines.push('      agents:');
    (stage.agents || []).forEach((agent) => {
      lines.push(`        - id: ${JSON.stringify(agent.id)}`);
      lines.push(`          role: ${JSON.stringify(agent.role || '')}`);
      if (agent.task) lines.push(`          task: ${JSON.stringify(agent.task)}`);
      lines.push(`          status: ${JSON.stringify(agent.status || 'pending')}`);
    });
  });
  return `${lines.join('\n')}\n`;
}

/** Build ReactFlow nodes/edges — stage columns with barrier between stages. */
export function graphFromWorkflow(workflow) {
  const stages = workflow?.stages?.length
    ? workflow.stages
    : stagesFromSteps(workflow?.steps || []);
  if (!stages.length) return { nodes: [], edges: [] };

  const COL_W = 260;
  const ROW_H = 112;
  const BARRIER_W = 36;
  const nodes = [];
  const edges = [];

  stages.forEach((stage, stageIdx) => {
    const agents = stage.agents || [];
    const x = stageIdx * (COL_W + BARRIER_W);
    const yOffset = ((agents.length - 1) * ROW_H) / -2;

    agents.forEach((agent, rowIdx) => {
      const step = {
        id: agent.id,
        role: agent.role,
        task: agent.task,
        layer: stage.layer ?? stageIdx,
        stageId: stage.id,
        status: statusOf(agent),
        output: agent.output,
        logs: agent.logs,
        tool_calls: agent.tool_calls,
      };
      nodes.push({
        id: step.id,
        type: 'workflowStep',
        position: { x, y: yOffset + rowIdx * ROW_H },
        data: { ...step, stageLabel: `Stage ${stageIdx + 1}` },
        draggable: true,
      });
    });

    if (stageIdx < stages.length - 1) {
      const barrierId = `barrier_${stage.id}`;
      const st = stageStatus(agents);
      nodes.push({
        id: barrierId,
        type: 'pipelineBarrier',
        position: { x: x + COL_W - 20, y: -12 },
        data: { label: `S${stageIdx + 1}`, status: st },
        draggable: false,
        selectable: false,
      });

      agents.forEach((agent) => {
        edges.push({
          id: `${agent.id}->${barrierId}`,
          source: agent.id,
          target: barrierId,
          type: 'smoothstep',
          animated: statusOf(agent) === 'running',
          style: {
            stroke: statusOf(agent) === 'complete' ? '#14b8a6' : '#94a3b8',
            strokeWidth: 2,
          },
        });
      });

      const next = stages[stageIdx + 1].agents || [];
      next.forEach((agent) => {
        edges.push({
          id: `${barrierId}->${agent.id}`,
          source: barrierId,
          target: agent.id,
          type: 'smoothstep',
          animated: st === 'complete',
          style: {
            stroke: st === 'complete' ? '#0ea5e9' : '#94a3b8',
            strokeWidth: 2,
            strokeDasharray: st === 'complete' ? undefined : '4 4',
          },
        });
      });
    }
  });

  return { nodes, edges };
}
