/**
 * ListView - List-based workflow visualization (alternative to DAG)
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Wrench,
  ChevronDown,
  ChevronRight,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';
import { STATUS_CONFIG, getColorClasses, formatDuration, DEFAULT_ROLE_CONFIG } from './constants';

// Tool Call Item
function ToolCallItem({ tool, index }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-700/30 transition-colors"
      >
        <Wrench className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-xs font-medium text-gray-300 flex-1 text-left truncate">
          {tool.name || tool.tool}
        </span>
        <ChevronDown className={clsx(
          'w-3.5 h-3.5 text-gray-500 transition-transform',
          expanded && 'rotate-180'
        )} />
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-700/50"
          >
            <div className="p-3 space-y-2">
              {tool.args && (
                <div>
                  <span className="text-xs text-gray-500">Arguments:</span>
                  <pre className="mt-1 text-xs text-gray-400 bg-gray-900/50 rounded p-2 overflow-x-auto max-h-24">
                    {typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args, null, 2)}
                  </pre>
                </div>
              )}
              {tool.result && (
                <div>
                  <span className="text-xs text-gray-500">Result:</span>
                  <pre className="mt-1 text-xs text-gray-400 bg-gray-900/50 rounded p-2 overflow-x-auto max-h-32">
                    {typeof tool.result === 'string' 
                      ? (tool.result.length > 500 ? tool.result.slice(0, 500) + '...' : tool.result)
                      : JSON.stringify(tool.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Agent Step Component
function AgentStep({ agent, isExpanded, onToggle, layerIndex, stepIndex, getRole }) {
  const roleConfig = getRole ? getRole(agent.role) : DEFAULT_ROLE_CONFIG.default;
  const statusConfig = STATUS_CONFIG[agent.status] || STATUS_CONFIG.pending;
  const Icon = roleConfig.icon;
  const StatusIcon = statusConfig.icon;
  
  const duration = agent.endTime && agent.startTime 
    ? agent.endTime - agent.startTime 
    : agent.startTime ? Date.now() - agent.startTime : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: stepIndex * 0.1 }}
      className={clsx(
        'rounded-lg border overflow-hidden transition-all duration-300',
        agent.status === 'running' && 'ring-2 ring-offset-2 ring-offset-gray-900',
        agent.status === 'running' && getColorClasses(statusConfig.color, 'ring'),
        getColorClasses(statusConfig.color, 'border'),
        'border-opacity-50 bg-gray-900/80'
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800/50 transition-colors"
      >
        {/* Status indicator */}
        <div className={clsx(
          'relative flex items-center justify-center w-8 h-8 rounded-full',
          getColorClasses(statusConfig.color, 'bg'),
          'bg-opacity-20'
        )}>
          <StatusIcon className={clsx(
            'w-4 h-4',
            getColorClasses(statusConfig.color, 'text'),
            statusConfig.animate && 'animate-spin'
          )} />
          {agent.status === 'running' && (
            <motion.div
              className={clsx(
                'absolute inset-0 rounded-full',
                getColorClasses(statusConfig.color, 'border'),
                'border-2 border-opacity-50'
              )}
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>

        {/* Agent info */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-purple-400" />
            <span className="font-medium text-white text-sm">{agent.agent_id}</span>
            <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-300">
              {roleConfig.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{agent.task}</p>
        </div>

        {/* Duration & expand */}
        <div className="flex items-center gap-3">
          {duration !== null && (
            <span className="text-xs text-gray-500 font-mono">
              {formatDuration(duration)}
            </span>
          )}
          <ChevronRight className={clsx(
            'w-4 h-4 text-gray-500 transition-transform',
            isExpanded && 'rotate-90'
          )} />
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-700/50"
          >
            <div className="p-4 space-y-4">
              {/* Tool calls */}
              {agent.tool_calls && agent.tool_calls.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5" />
                    Tool Calls ({agent.tool_calls.length})
                  </h4>
                  <div className="space-y-2">
                    {agent.tool_calls.map((tool, idx) => (
                      <ToolCallItem key={idx} tool={tool} index={idx} />
                    ))}
                  </div>
                </div>
              )}

              {/* Output preview */}
              {agent.output && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    Output
                  </h4>
                  <div className="bg-gray-800/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <p className="text-xs text-gray-300 whitespace-pre-wrap">
                      {agent.output.length > 500 ? agent.output.slice(0, 500) + '...' : agent.output}
                    </p>
                  </div>
                </div>
              )}

              {/* Token usage */}
              {agent.token_usage && (
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Input: {agent.token_usage.input_tokens?.toLocaleString() || 0}</span>
                  <span>Output: {agent.token_usage.output_tokens?.toLocaleString() || 0}</span>
                  {agent.token_usage.cost && (
                    <span className="text-green-400">${agent.token_usage.cost.toFixed(4)}</span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Execution Layer Component
function ExecutionLayer({ layer, agents, expandedAgents, toggleAgent, getRole }) {
  const completedCount = agents.filter(a => a.status === 'completed' || a.status === 'complete').length;
  const runningCount = agents.filter(a => a.status === 'running').length;
  const allComplete = completedCount === agents.length;
  const hasRunning = runningCount > 0;
  const isCoordinationLayer = layer === 0;

  return (
    <div className="relative">
      {/* Layer connector line */}
      {layer > 0 && (
        <div className="absolute -top-6 left-8 w-0.5 h-6 bg-gray-700" />
      )}
      
      {/* Layer header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={clsx(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
          allComplete ? 'bg-green-500/20 text-green-400' : 
          hasRunning ? 'bg-blue-500/20 text-blue-400' : 
          'bg-gray-700 text-gray-400'
        )}>
          {isCoordinationLayer ? '✦' : layer}
        </div>
        <span className="text-sm text-gray-400">
          {isCoordinationLayer ? 'Coordination' : `Layer ${layer}`}
          <span className="text-gray-600 ml-2">
            ({completedCount}/{agents.length} complete)
          </span>
        </span>
        {hasRunning && (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="flex items-center gap-1 text-blue-400 text-xs"
          >
            <Activity className="w-3 h-3" />
            In Progress
          </motion.div>
        )}
      </div>

      {/* Agents in layer */}
      <div className="space-y-3 ml-9">
        {agents.map((agent, idx) => (
          <AgentStep
            key={agent.agent_id}
            agent={agent}
            isExpanded={expandedAgents.has(agent.agent_id)}
            onToggle={() => toggleAgent(agent.agent_id)}
            layerIndex={layer}
            stepIndex={idx}
            getRole={getRole}
          />
        ))}
      </div>
    </div>
  );
}

// Main ListView Component
export function ListView({ layers, expandedAgents, toggleAgent, getRole }) {
  return (
    <div className="space-y-6">
      {layers.map(({ layer, agents }) => (
        <ExecutionLayer
          key={layer}
          layer={layer}
          agents={agents}
          expandedAgents={expandedAgents}
          toggleAgent={toggleAgent}
          getRole={getRole}
        />
      ))}
    </div>
  );
}

export default ListView;
