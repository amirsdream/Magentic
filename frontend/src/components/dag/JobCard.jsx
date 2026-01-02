/**
 * JobCard - Individual agent/job card in the DAG view
 * Displays agent info, status, tokens, cost, and allows selection
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Loader2, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Square,
  Coins,
  Hash
} from 'lucide-react';
import clsx from 'clsx';

function JobCard({ agent, isSelected, onClick, roleConfig, index = 0 }) {
  const status = agent.status || 'pending';
  const Icon = roleConfig?.icon || Clock;
  
  const isRunning = status === 'running';
  const isComplete = status === 'completed' || status === 'complete';
  const isPending = status === 'pending' || !status;
  const isError = status === 'error';
  const isStopped = status === 'stopped';

  // Real-time duration counter for running agents
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning]);

  // Parse timestamp - handle multiple formats
  const parseTime = (time) => {
    if (!time) return null;
    if (typeof time === 'number') return time;
    if (time instanceof Date) return time.getTime();
    const parsed = new Date(time).getTime();
    return isNaN(parsed) ? null : parsed;
  };

  const startTime = parseTime(agent.startTime || agent.started_at || agent.start_time);
  const endTime = parseTime(agent.endTime || agent.ended_at || agent.end_time);

  // Calculate duration
  let duration = null;
  if (startTime) {
    if (endTime) {
      duration = endTime - startTime;
    } else if (isRunning) {
      duration = now - startTime;
    } else if (isComplete || isStopped) {
      duration = Date.now() - startTime;
    }
  }

  // Extract token usage - handle multiple field name formats
  const tokenUsage = agent.token_usage || agent.tokenUsage || agent.tokens || {};
  const inputTokens = tokenUsage.prompt_tokens || tokenUsage.input_tokens || tokenUsage.input || tokenUsage.promptTokens || 0;
  const outputTokens = tokenUsage.completion_tokens || tokenUsage.output_tokens || tokenUsage.output || tokenUsage.completionTokens || 0;
  const totalTokens = tokenUsage.total_tokens || tokenUsage.totalTokens || (inputTokens + outputTokens);
  const cost = tokenUsage.total_cost || tokenUsage.totalCost || agent.cost || tokenUsage.cost || 0;

  const formatDuration = (ms) => {
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      onClick={onClick}
      className={clsx(
        'w-full text-left rounded-xl border transition-all duration-200 overflow-hidden',
        'hover:shadow-md',
        // Light mode base
        'bg-white border-slate-200',
        // Dark mode base
        'dark:bg-gray-800/50 dark:border-gray-700/50',
        // Selected state
        isSelected && 'ring-2 ring-purple-500/50 border-purple-400 dark:border-purple-500/50',
        // Status-based styling
        isComplete && 'border-emerald-300 dark:border-emerald-500/40 bg-gradient-to-br from-white to-emerald-50/50 dark:from-gray-800/80 dark:to-emerald-900/10',
        isRunning && 'border-blue-300 dark:border-blue-500/50 bg-gradient-to-br from-white to-blue-50/50 dark:from-gray-800/80 dark:to-blue-900/10 shadow-lg shadow-blue-500/10',
        isError && 'border-red-300 dark:border-red-500/40 bg-gradient-to-br from-white to-red-50/50 dark:from-gray-800/80 dark:to-red-900/10',
        isStopped && 'border-orange-300 dark:border-orange-500/40 bg-gradient-to-br from-white to-orange-50/50 dark:from-gray-800/80 dark:to-orange-900/10'
      )}
    >
      {/* Status accent bar */}
      <div className={clsx(
        'h-1 w-full',
        isComplete && 'bg-emerald-500',
        isRunning && 'bg-blue-500',
        isPending && 'bg-slate-300 dark:bg-gray-600',
        isError && 'bg-red-500',
        isStopped && 'bg-orange-500'
      )}>
        {isRunning && (
          <motion.div
            className="h-full bg-blue-400"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ width: '30%' }}
          />
        )}
      </div>

      <div className="p-3">
        {/* Header row */}
        <div className="flex items-center gap-2">
          {/* Status icon */}
          <div className={clsx(
            'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
            isComplete && 'bg-emerald-100 dark:bg-emerald-500/20',
            isRunning && 'bg-blue-100 dark:bg-blue-500/20',
            isPending && 'bg-slate-100 dark:bg-gray-700',
            isError && 'bg-red-100 dark:bg-red-500/20',
            isStopped && 'bg-orange-100 dark:bg-orange-500/20'
          )}>
            {isComplete && <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            {isRunning && <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />}
            {isPending && <Clock className="w-4 h-4 text-slate-500 dark:text-gray-400" />}
            {isError && <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />}
            {isStopped && <Square className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
          </div>
          
          {/* Role name */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Icon className="w-3.5 h-3.5 flex-shrink-0 text-purple-500 dark:text-purple-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-gray-200 truncate">
              {roleConfig?.label || agent.role || 'Agent'}
            </span>
          </div>
          
          {/* Duration badge */}
          {duration && (
            <span className={clsx(
              'text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0',
              isRunning ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'text-slate-500 dark:text-gray-400'
            )}>
              {formatDuration(duration)}
            </span>
          )}
        </div>
        
        {/* Task preview */}
        {agent.task && (
          <p className="text-xs text-slate-500 dark:text-gray-400 truncate mt-2 pl-9">
            {agent.task}
          </p>
        )}
        
        {/* Tokens & Cost row - show for completed/stopped agents */}
        {(isComplete || isStopped || isError) && (totalTokens > 0 || cost > 0) && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-gray-700/30 pl-9">
            {totalTokens > 0 && (
              <div className="flex items-center gap-1">
                <Hash className="w-3 h-3 text-slate-400 dark:text-gray-500" />
                <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                  {totalTokens.toLocaleString()}
                </span>
              </div>
            )}
            {cost > 0 && (
              <div className="flex items-center gap-1">
                <Coins className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                  ${cost.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Running indicator */}
        {isRunning && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-blue-100 dark:border-blue-500/20 pl-9">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
              Processing...
            </span>
          </div>
        )}
      </div>
    </motion.button>
  );
}

export default JobCard;
