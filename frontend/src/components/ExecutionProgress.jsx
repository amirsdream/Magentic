/**
 * ExecutionProgress component - shows current execution progress
 */

import React from 'react';
import { CheckCircle, Sparkles, Brain, Zap, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AgentStep from './AgentStep';

function ExecutionProgress({ execution, toggleStep, expandedSteps }) {
  // Check if all agents are complete
  const allComplete =
    execution.stage === 'complete' ||
    (execution.plan &&
      execution.agents &&
      execution.plan.agents.length > 0 &&
      execution.agents.length === execution.plan.agents.length &&
      execution.agents.every((a) => a.status === 'complete'));

  // Loading state - waiting for backend to respond with plan
  const isInitializing = execution.isLoading && !execution.plan;

  // Determine status text
  const getStatusInfo = () => {
    if (allComplete) {
      return { text: 'Execution Complete', subtext: 'All agents finished successfully', color: 'text-green-400' };
    }
    if (isInitializing) {
      return { text: 'Processing Query', subtext: execution.stageMessage || 'Analyzing and planning execution...', color: 'text-purple-300' };
    }
    return { text: 'Processing Query', subtext: execution.stageMessage, color: 'text-purple-300' };
  };

  const status = getStatusInfo();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      {/* Avatar - always visible on the left */}
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white animate-pulse" />
        </div>
        <div className="absolute inset-0 bg-violet-500/20 dark:bg-purple-500/30 rounded-full blur-lg animate-pulse" />
      </div>

      {/* Content Box */}
      <div className="flex-1 bg-white/70 dark:bg-gray-800/50 border border-slate-200/80 dark:border-purple-500/30 rounded-2xl rounded-tl-sm p-4 max-w-4xl shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            {allComplete ? (
              <>
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-green-400" />
                </div>
                <div className="absolute inset-0 bg-emerald-400/20 dark:bg-green-400/20 rounded-full blur-md" />
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-purple-600 dark:to-pink-600 flex items-center justify-center">
                  <Brain className="w-3 h-3 text-white animate-pulse" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-violet-400/50 dark:border-purple-400/50"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
              </>
            )}
          </div>
          <div className="flex-1">
            <h3 className={`font-semibold ${allComplete ? 'text-emerald-600 dark:text-green-400' : 'text-violet-600 dark:text-purple-300'} flex items-center gap-2`}>
              <span>{status.text}</span>
              {!allComplete && (
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-violet-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-violet-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-violet-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400">{status.subtext}</p>
          </div>
          {execution.plan && (
            <div className="text-xs text-slate-500 dark:text-gray-500 flex items-center gap-2">
              <Zap className="w-3 h-3 text-amber-500 dark:text-yellow-400" />
              {execution.plan.total_agents} agents • {execution.plan.total_layers} layers
            </div>
          )}
        </div>

        {/* Agent List or Loading Placeholder */}
        <div className="space-y-2">
          {isInitializing ? (
            // Loading placeholder agents
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-slate-100/70 dark:bg-gray-900/50 rounded-lg border border-slate-200/80 dark:border-gray-700/50"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-gray-700 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
                    <div className="h-2 bg-slate-100 dark:bg-gray-700/50 rounded w-2/3 animate-pulse" />
                  </div>
                  <Circle className="w-4 h-4 text-slate-300 dark:text-gray-600" />
                </motion.div>
              ))}
            </div>
          ) : execution.plan ? (
            // Actual agents
            <AnimatePresence>
              {execution.plan.agents.map((agent, idx) => {
                const agentStatus = execution.agents?.find(
                  (a) => a.agent_id === agent.agent_id
                );
                const stepKey = `current-${idx}`;

                return (
                  <motion.div
                    key={agent.agent_id || idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <AgentStep
                      agent={agent}
                      status={agentStatus}
                      index={idx}
                      expanded={expandedSteps.has(stepKey)}
                      onToggle={() => toggleStep(stepKey)}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

export default ExecutionProgress;
