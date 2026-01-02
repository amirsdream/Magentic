/**
 * ExecutionView - Unified component for showing execution progress and completion
 * Adapts its appearance based on whether execution is live, completed, or stopped
 * Shows a compact inline view - for full workflow visualization, use the side panel
 */

import React, { useState } from 'react';
import { CheckCircle, Sparkles, Brain, Zap, ChevronDown, ChevronUp, Coins, DollarSign, StopCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WorkflowVisualization from './WorkflowVisualization';

function ExecutionView({ 
  execution, 
  variant = 'auto', // 'auto' | 'live' | 'summary' | 'compact'
  defaultExpanded = null, // null means auto-detect
  showAvatar = null, // null means auto-detect
  messageId = 'current',
  onRetry = null // callback to retry execution with same query
}) {
  // Determine execution state
  const isStopped = execution?.stage === 'stopped';
  
  const isComplete =
    execution?.stage === 'complete' ||
    (execution?.plan &&
      execution?.agents &&
      execution?.plan?.agents?.length > 0 &&
      execution?.agents?.length === execution?.plan?.agents?.length &&
      execution?.agents?.every((a) => a.status === 'complete' || a.status === 'completed'));

  // Auto-detect settings based on variant and completion state
  const isLive = variant === 'live' || (variant === 'auto' && !isComplete && !isStopped);
  const isSummary = variant === 'summary' || variant === 'compact' || (variant === 'auto' && (isComplete || isStopped));
  const isCompact = variant === 'compact';
  
  // Default expansion: always expanded (user preference)
  const [showFlow, setShowFlow] = useState(
    defaultExpanded !== null ? defaultExpanded : true
  );

  // Determine if we should show avatar (only for live view in chat)
  const shouldShowAvatar = showAvatar !== null ? showAvatar : isLive;

  // Get token usage
  const tokenUsage = execution?.token_usage;
  const hasTokens = tokenUsage?.total?.total_tokens > 0;
  const hasCost = tokenUsage?.total?.total_cost > 0;
  const costFormatted = tokenUsage?.total?.cost_formatted || '$0.00';

  // Count agents (default to 1 for coordinator if no agents yet)
  const agentCount = execution?.agents?.length || 1;
  const completedAgents = execution?.agents?.filter(a => a.status === 'complete' || a.status === 'completed').length || 0;
  const stoppedAgents = execution?.agents?.filter(a => a.status === 'stopped').length || 0;
  const pendingAgents = execution?.agents?.filter(a => a.status === 'pending').length || 0;
  const totalAgents = execution?.plan?.total_agents || agentCount;
  const runningAgents = execution?.agents?.filter(a => a.status === 'running').length || 0;
  const totalLayers = execution?.plan?.total_layers || 1;

  // No execution data at all
  if (!execution) {
    return null;
  }

  // Theme colors based on state - stopped (orange), complete (green), or running (purple)
  const theme = isStopped
    ? {
        border: 'border-orange-500/30',
        bg: isCompact ? 'bg-white/30 dark:bg-gray-800/30' : 'bg-white/70 dark:bg-gray-800/50',
        icon: 'text-orange-500 dark:text-orange-400',
        title: 'text-orange-600 dark:text-orange-400',
        accent: 'bg-orange-500/20',
        hoverBg: 'hover:bg-orange-500/5'
      }
    : isComplete 
      ? {
          border: 'border-green-500/30',
          bg: isCompact ? 'bg-white/30 dark:bg-gray-800/30' : 'bg-white/70 dark:bg-gray-800/50',
          icon: 'text-green-500 dark:text-green-400',
          title: 'text-green-600 dark:text-green-400',
          accent: 'bg-green-500/20',
          hoverBg: 'hover:bg-green-500/5'
        }
      : {
          border: 'border-slate-200/80 dark:border-purple-500/30',
          bg: 'bg-white/70 dark:bg-gray-800/50',
          icon: 'text-violet-600 dark:text-purple-300',
          title: 'text-violet-600 dark:text-purple-300',
          accent: 'bg-violet-500/20 dark:bg-purple-500/20',
          hoverBg: 'hover:bg-slate-50/50 dark:hover:bg-gray-700/30'
        };

  const content = (
    <div className={`${theme.bg} border ${theme.border} ${isCompact ? 'rounded-lg' : 'rounded-2xl rounded-tl-sm'} overflow-hidden ${isCompact ? '' : 'max-w-4xl'} shadow-sm`}>
      {/* Header - Clickable to toggle flow */}
      <button
        onClick={() => setShowFlow(!showFlow)}
        className={`w-full ${isCompact ? 'p-3' : 'p-4'} flex items-center justify-between ${theme.hoverBg} transition-colors`}
      >
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="relative">
            {isStopped ? (
              <>
                <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <StopCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="absolute inset-0 bg-orange-400/20 dark:bg-orange-400/20 rounded-full blur-md" />
              </>
            ) : isComplete ? (
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

          {/* Title and status */}
          <div className="text-left">
            <h3 className={`font-semibold ${theme.title} flex items-center gap-2`}>
              <span>
                {isStopped
                  ? 'Execution Stopped'
                  : isComplete 
                    ? 'Execution Complete' 
                    : 'Executing Workflow'}
              </span>
              {!isComplete && !isStopped && (
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-violet-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-violet-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-violet-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400">
              {isStopped
                ? `${completedAgents} completed${stoppedAgents > 0 ? ` • ${stoppedAgents} stopped` : ''}${pendingAgents > 0 ? ` • ${pendingAgents} skipped` : ''}`
                : `${completedAgents}/${totalAgents} agents${runningAgents > 0 ? ` • ${runningAgents} running` : ''} • ${totalLayers} layer${totalLayers !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Token and cost badges */}
          {hasTokens && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-full shadow-sm">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                  {tokenUsage.total.total_tokens.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-full shadow-sm">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {costFormatted}
                </span>
              </div>
            </div>
          )}

          {/* Plan info badge (when no tokens yet) */}
          {execution?.plan && !hasTokens && (
            <div className="text-xs text-slate-500 dark:text-gray-500 flex items-center gap-2">
              <Zap className="w-3 h-3 text-amber-500 dark:text-yellow-400" />
              {totalAgents} agents
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

      {/* Token breakdown - only show when complete and has tokens */}
      {isComplete && hasTokens && (
        <div className="relative mx-4 mb-4">
          {/* Glow effects underneath */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute left-[12%] top-1/2 -translate-y-1/2 w-14 h-10 bg-violet-500/15 dark:bg-violet-500/25 rounded-full blur-2xl"></div>
            <div className="absolute left-[37%] top-1/2 -translate-y-1/2 w-14 h-10 bg-blue-500/15 dark:bg-blue-500/25 rounded-full blur-2xl"></div>
            <div className="absolute left-[62%] top-1/2 -translate-y-1/2 w-14 h-10 bg-emerald-500/15 dark:bg-emerald-500/25 rounded-full blur-2xl"></div>
            <div className="absolute right-[8%] top-1/2 -translate-y-1/2 w-14 h-10 bg-amber-500/15 dark:bg-amber-500/25 rounded-full blur-2xl"></div>
          </div>
          
          {/* Glass container */}
          <div className="relative px-5 py-3.5 backdrop-blur-sm bg-white/50 dark:bg-gray-900/50 rounded-xl border border-white/60 dark:border-gray-700/40 shadow-sm">
            <div className="flex items-center justify-around">
              {/* Planning */}
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-2 h-2 rounded-full bg-violet-400 shadow-sm shadow-violet-400/50 flex-shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 font-medium leading-none mb-1">Planning</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 leading-none tabular-nums">
                    {tokenUsage.planning?.total_tokens?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
              
              <div className="h-10 w-px bg-gradient-to-b from-transparent via-slate-200/60 dark:via-gray-600/40 to-transparent flex-shrink-0"></div>
              
              {/* Input */}
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50 flex-shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 font-medium leading-none mb-1">Input</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 leading-none tabular-nums">
                    {tokenUsage.total.prompt_tokens?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
              
              <div className="h-10 w-px bg-gradient-to-b from-transparent via-slate-200/60 dark:via-gray-600/40 to-transparent flex-shrink-0"></div>
              
              {/* Output */}
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 flex-shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 font-medium leading-none mb-1">Output</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 leading-none tabular-nums">
                    {tokenUsage.total.completion_tokens?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
              
              <div className="h-10 w-px bg-gradient-to-b from-transparent via-slate-200/60 dark:via-gray-600/40 to-transparent flex-shrink-0"></div>
              
              {/* Cost */}
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 flex-shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 font-medium leading-none mb-1">Cost</p>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 leading-none tabular-nums">
                    {costFormatted}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NOTE: Streaming response preview removed - users prefer to see the workflow 
          without the response preview on top. The final response appears as a 
          normal chat bubble when execution completes. */}

      {/* Expandable Workflow Visualization */}
      <AnimatePresence>
        {showFlow && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`border-t ${isStopped ? 'border-orange-500/20' : isComplete ? 'border-green-500/20' : 'border-slate-200/50 dark:border-purple-500/20'}`}
          >
            {/* Auto height - content determines size, with max constraint */}
            <div className="max-h-[500px] overflow-y-auto">
              <WorkflowVisualization
                execution={execution}
                isPanel={true}
                isLive={!isComplete && !isStopped}
                onRetry={onRetry}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Wrap with avatar for live view
  if (shouldShowAvatar) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-3"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div className="absolute inset-0 bg-violet-500/20 dark:bg-purple-500/30 rounded-full blur-lg animate-pulse" />
        </div>

        {/* Content */}
        <div className="flex-1">
          {content}
        </div>
      </motion.div>
    );
  }

  return content;
}

export default ExecutionView;
