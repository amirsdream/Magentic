/**
 * Build a human-readable workflow YAML document from execution / plan agents.
 * Kept dependency-free (no js-yaml) for the studio panel.
 */

function escapeYamlScalar(value) {
  if (value == null) return '""';
  const str = String(value);
  if (str === '') return '""';
  if (/[:#{}[\],&*?|>!%@`'"\\\n\r\t]/.test(str) || /^\s|\s$/.test(str)) {
    return JSON.stringify(str);
  }
  return str;
}

/**
 * @param {object} options
 * @param {string} [options.pipelineId]
 * @param {string} [options.description]
 * @param {string} [options.prompt]
 * @param {Array} [options.agents]
 * @param {number|string} [options.stages]
 * @returns {string}
 */
export function buildWorkflowYaml({
  pipelineId,
  description,
  prompt,
  agents = [],
  stages,
} = {}) {
  const list = Array.isArray(agents) ? agents : [];
  const lines = ['workflow:'];
  lines.push(`  id: ${escapeYamlScalar(pipelineId || 'pending')}`);
  lines.push(
    `  description: ${escapeYamlScalar(description || 'Awaiting Ropex plan…')}`
  );
  if (prompt) {
    lines.push(`  prompt: ${escapeYamlScalar(prompt)}`);
  }
  lines.push(`  stages: ${stages != null ? stages : list.length || 0}`);
  lines.push('  steps:');

  if (!list.length) {
    lines.push('    []');
    return lines.join('\n') + '\n';
  }

  list.forEach((agent, index) => {
    lines.push(`    - id: ${escapeYamlScalar(agent.agent_id || `step_${index + 1}`)}`);
    lines.push(`      role: ${escapeYamlScalar(agent.role || `agent_${index + 1}`)}`);
    if (agent.task) {
      lines.push(`      task: ${escapeYamlScalar(agent.task)}`);
    }
    if (agent.layer != null) {
      lines.push(`      layer: ${agent.layer}`);
    }
    lines.push(`      status: ${escapeYamlScalar(agent.status || 'pending')}`);
  });

  return lines.join('\n') + '\n';
}

/**
 * Prefer server-provided YAML; otherwise derive from execution state.
 */
export function workflowYamlFromExecution(execution, fallbackPrompt) {
  if (execution?.workflowYaml) return execution.workflowYaml;
  if (execution?.approval?.workflow_yaml) return execution.approval.workflow_yaml;

  const agents = execution?.agents || execution?.plan?.agents || [];
  return buildWorkflowYaml({
    pipelineId: execution?.pipelineId || execution?.session_id || execution?.plan?.pipeline_id,
    description: execution?.plan?.description || execution?.plan?.message || execution?.stageMessage,
    prompt: fallbackPrompt || execution?.prompt,
    agents,
    stages: execution?.plan?.stages || execution?.plan?.total_agents || agents.length,
  });
}
