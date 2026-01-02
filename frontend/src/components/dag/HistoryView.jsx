/**
 * HistoryView - Execution history list component
 */
import React from 'react';
import { motion } from 'framer-motion';
import { History, CheckCircle, X, Activity, Users, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { formatTimeAgo } from './constants';

export function HistoryView({ executionHistory, onSelectExecution, onCloseHistory }) {
  if (executionHistory.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
          <History className="w-8 h-8 text-slate-300 dark:text-gray-600" />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-gray-400">No execution history yet</p>
        <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Your flow executions will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {executionHistory.map((exec, idx) => {
        const execTime = exec.startTime || exec.timestamp;
        const timeAgo = execTime ? formatTimeAgo(execTime) : null;
        const agentCount = exec.agents?.length || exec.plan?.total_agents || 0;
        const layerCount = exec.plan?.total_layers || 1;
        const isComplete = exec.status === 'completed' || exec.status === 'complete';
        const isFailed = exec.status === 'error' || exec.status === 'failed';
        
        return (
          <motion.button
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => {
              onSelectExecution?.(exec);
              onCloseHistory();
            }}
            className={clsx(
              'w-full p-4 rounded-xl border transition-all text-left group',
              'bg-white dark:bg-gray-800/50',
              'border-slate-200 dark:border-gray-700/50',
              'hover:border-purple-400 dark:hover:border-purple-500/50',
              'hover:shadow-md hover:shadow-purple-500/5'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Status icon */}
              <div className={clsx(
                'p-2 rounded-lg flex-shrink-0',
                isComplete && 'bg-emerald-100 dark:bg-emerald-500/20',
                isFailed && 'bg-red-100 dark:bg-red-500/20',
                !isComplete && !isFailed && 'bg-blue-100 dark:bg-blue-500/20'
              )}>
                {isComplete && <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                {isFailed && <X className="w-4 h-4 text-red-600 dark:text-red-400" />}
                {!isComplete && !isFailed && <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-white line-clamp-2">
                  {exec.query || `Execution #${executionHistory.length - idx}`}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {agentCount} agent{agentCount !== 1 ? 's' : ''}
                  </span>
                  <span>•</span>
                  <span>{layerCount} layer{layerCount !== 1 ? 's' : ''}</span>
                  {timeAgo && (
                    <>
                      <span>•</span>
                      <span>{timeAgo}</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Arrow */}
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-gray-600 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors flex-shrink-0 mt-1" />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

export default HistoryView;
