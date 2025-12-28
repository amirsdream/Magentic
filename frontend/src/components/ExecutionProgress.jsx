/**
 * ExecutionProgress component - shows current execution progress with workflow visualization
 */

import React, { useState } from 'react';
import { CheckCircle, Sparkles, Brain, Zap, ChevronDown, ChevronUp, Coins, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WorkflowVisualization from './WorkflowVisualization';

function ExecutionProgress({ execution }) {
  const [showFlow, setShowFlow] = useState(true); // Show flow by default during execution
  
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
  
  // Get token usage
  const tokenUsage = execution.token_usage;
  const hasTokens = tokenUsage?.total?.total_tokens > 0;
  const costFormatted = tokenUsage?.total?.cost_formatted || '$0.00';

  // Count completed agents
  const completedAgents = execution.agents?.filter(a => a.status === 'complete' || a.status === 'completed').length || 0;
  const totalAgents = execution.plan?.total_agents || 0;
  const runningAgents = execution.agents?.filter(a => a.status === 'running').length || 0;

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
      <div className="flex-1 bg-white/70 dark:bg-gray-800/50 border border-slate-200/80 dark:border-purple-500/30 rounded-2xl rounded-tl-sm overflow-hidden max-w-4xl shadow-sm">
        {/* Header - Clickable to toggle flow */}
        <button
          onClick={() => setShowFlow(!showFlow)}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-gray-700/30 transition-colors"
        >
          <div className="flex items-center gap-3">
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
            <div className="text-left">
              <h3 className={`font-semibold ${allComplete ? 'text-emerald-600 dark:text-green-400' : 'text-violet-600 dark:text-purple-300'} flex items-center gap-2`}>
                <span>{allComplete ? 'Execution Complete' : isInitializing ? 'Processing Query' : 'Executing Agents'}</span>
                {!allComplete && (
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-violet-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-violet-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-violet-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
              </h3>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                {isInitializing 
                  ? (execution.stageMessage || 'Analyzing and planning execution...')
                  : execution.plan 
                    ? `${completedAgents}/${totalAgents} agents${runningAgents > 0 ? ` • ${runningAgents} running` : ''} • ${execution.plan.total_layers} layers`
                    : execution.stageMessage
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Token/cost badges when available */}
            {hasTokens && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    {tokenUsage.total.total_tokens.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
                  <DollarSign className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    {costFormatted}
                  </span>
                </div>
              </div>
            )}
            
            {/* Plan info badge */}
            {execution.plan && !hasTokens && (
              <div className="text-xs text-slate-500 dark:text-gray-500 flex items-center gap-2">
                <Zap className="w-3 h-3 text-amber-500 dark:text-yellow-400" />
                {execution.plan.total_agents} agents
              </div>
            )}
            
            {/* Expand/collapse chevron */}
            <div className="p-1 rounded-full bg-slate-100 dark:bg-gray-700/50">
              {showFlow ? (
                <ChevronUp className="w-4 h-4 text-slate-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500 dark:text-gray-400" />
              )}
            </div>
          </div>
        </button>

        {/* Token breakdown when complete */}
        {allComplete && hasTokens && (
          <div className="mx-4 mb-3 p-2 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
            <div className="grid grid-cols-4 gap-4 text-center text-xs">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Planning</p>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  {tokenUsage.planning?.total_tokens?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Input</p>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  {tokenUsage.total.prompt_tokens?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Output</p>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  {tokenUsage.total.completion_tokens?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Cost</p>
                <p className="font-medium text-green-600 dark:text-green-400">
                  {costFormatted}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Expandable Workflow Visualization */}
        <AnimatePresence>
          {showFlow && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-slate-200/50 dark:border-purple-500/20"
            >
              <div className="h-[350px]">
                <WorkflowVisualization
                  execution={execution}
                  isPanel={true}
                  isLive={!allComplete}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default ExecutionProgress;
