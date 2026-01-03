/**
 * ExecutionStatusHeader - Shared status header for executions
 * Used by ExecutionView (main page) - shows status, tokens, cost, expand/collapse
 */
import React from 'react';
import { 
  CheckCircle, 
  Brain, 
  Zap, 
  ChevronUp, 
  ChevronDown, 
  Coins, 
  DollarSign, 
  StopCircle 
} from 'lucide-react';
import { motion } from 'framer-motion';

export function ExecutionStatusHeader({
  execution,
  isComplete,
  isStopped,
  hasWorkflowData,
  showFlow,
  onToggleFlow,
  isCompact = false,
  theme,
}) {
  // Token usage
  const tokenUsage = execution?.token_usage;
  const hasTokens = tokenUsage?.total?.total_tokens > 0;
  const costFormatted = tokenUsage?.total?.cost_formatted || '$0.00';

  // Agent counts
  const totalAgents = execution?.plan?.total_agents || execution?.agents?.length || 1;
  const completedAgents = execution?.agents?.filter(a => a.status === 'complete' || a.status === 'completed').length || 0;
  const stoppedAgents = execution?.agents?.filter(a => a.status === 'stopped').length || 0;
  const pendingAgents = execution?.agents?.filter(a => a.status === 'pending').length || 0;
  const runningAgents = execution?.agents?.filter(a => a.status === 'running').length || 0;
  const totalLayers = execution?.plan?.total_layers || 1;

  return (
    <button
      onClick={() => hasWorkflowData && onToggleFlow?.()}
      className={`w-full ${isCompact ? 'p-3' : 'p-4'} flex items-center justify-between ${hasWorkflowData ? theme?.hoverBg || 'hover:bg-slate-50/50 dark:hover:bg-gray-700/30' : ''} transition-colors ${hasWorkflowData ? 'cursor-pointer' : ''}`}
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
          <h3 className={`font-semibold ${theme?.title || 'text-slate-700 dark:text-gray-200'} flex items-center gap-2`}>
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

        {/* Expand/collapse chevron - only show if we have workflow data */}
        {hasWorkflowData && (
          <div className="p-1 rounded-full bg-slate-100 dark:bg-gray-700/50">
            {showFlow ? (
              <ChevronUp className="w-4 h-4 text-slate-500 dark:text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500 dark:text-gray-400" />
            )}
          </div>
        )}
      </div>
    </button>
  );
}

export default ExecutionStatusHeader;
