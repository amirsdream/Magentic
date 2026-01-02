/**
 * CollapsedView - Minimized workflow panel showing status summary
 */
import React from 'react';
import { motion } from 'framer-motion';
import { History, Maximize2 } from 'lucide-react';
import clsx from 'clsx';

export function CollapsedView({ 
  headerIcon, 
  headerIconBg, 
  hasExecution, 
  isLive, 
  progress, 
  displayAgents,
  executionHistory,
  onExpand,
  onShowHistory 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col bg-slate-50 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80">
        <div className="flex items-center gap-2">
          <div className={clsx('p-1.5 rounded-lg', headerIconBg)}>
            {React.cloneElement(headerIcon, { className: 'w-4 h-4' })}
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-white">Workflow</h3>
            {hasExecution && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
                {isLive && <span className="text-emerald-500">●</span>}
                <span>{progress}%</span>
                <div className="w-12 h-1 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {executionHistory.length > 0 && (
            <button
              onClick={onShowHistory}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 hover:text-purple-500 transition-colors"
              title="Flow History"
            >
              <History className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onExpand}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            title="Expand panel"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Mini agent status indicators */}
      {hasExecution && displayAgents.length > 0 && (
        <div className="flex-1 p-3 overflow-auto">
          <div className="flex flex-wrap gap-1.5">
            {displayAgents.map((agent, idx) => {
              const status = agent.status || 'pending';
              const isRunning = status === 'running';
              const isComplete = status === 'completed' || status === 'complete';
              const isError = status === 'error';
              
              return (
                <div
                  key={agent.agent_id || idx}
                  className={clsx(
                    'w-6 h-6 rounded-md flex items-center justify-center text-xs font-medium transition-all',
                    isComplete && 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                    isRunning && 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 animate-pulse',
                    isError && 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
                    !isComplete && !isRunning && !isError && 'bg-slate-100 dark:bg-gray-700 text-slate-400 dark:text-gray-500',
                  )}
                  title={`${agent.role || 'Agent'} - ${status}`}
                >
                  {isComplete && '✓'}
                  {isRunning && '●'}
                  {isError && '!'}
                  {!isComplete && !isRunning && !isError && (idx + 1)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default CollapsedView;
