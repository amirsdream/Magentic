/**
 * WorkflowHeader - Header component for workflow panel
 */
import React from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  History,
  GitBranch,
  List,
  RotateCcw,
  Minimize2,
  X,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';

export function WorkflowHeader({
  // State
  showHistory,
  viewMode,
  progress,
  hasExecution,
  isLive,
  isPanel,
  canRetry,
  isStopped,
  executionHistory,
  execution,
  stageMessage,
  
  // Header content
  headerIcon,
  headerIconBg,
  headerTitle,
  headerSubtitle,
  
  // Callbacks
  onSetShowHistory,
  onSetViewMode,
  onRetry,
  onCollapse,
  onClose,
}) {
  return (
    <div className="flex-shrink-0 px-5 py-4 border-b border-slate-200 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
      <div className="flex items-center">
        <div className="flex items-center gap-3">
          {showHistory ? (
            <>
              <button
                onClick={() => onSetShowHistory(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-500/20">
                  <History className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-700 dark:text-white">Flow History</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    {executionHistory.length} past execution{executionHistory.length !== 1 ? 's' : ''} in this session
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={clsx('p-2 rounded-lg', headerIconBg)}>
                {headerIcon}
              </div>
              <div>
                <h2 className="font-semibold text-slate-700 dark:text-white truncate max-w-[200px]" title={execution?.query || ''}>
                  {headerTitle}
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  {isLive && <span className="text-emerald-500 mr-1">●</span>}
                  {headerSubtitle}
                </p>
              </div>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          {!showHistory && hasExecution && (
            <>
              {/* View mode toggle */}
              <div className="flex items-center bg-slate-100 dark:bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => onSetViewMode('dag')}
                  className={clsx(
                    'p-1.5 rounded-md transition-colors',
                    viewMode === 'dag' 
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                      : 'text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300'
                  )}
                  title="DAG View"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onSetViewMode('list')}
                  className={clsx(
                    'p-1.5 rounded-md transition-colors',
                    viewMode === 'list' 
                      ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                      : 'text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300'
                  )}
                  title="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress indicator */}
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1.5 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">{progress}%</span>
              </div>
              
              {/* Retry button */}
              {canRetry && (
                <button
                  onClick={() => onRetry(execution.query)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    isStopped 
                      ? 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                      : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                  )}
                  title={`Retry: ${execution.query}`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry
                </button>
              )}
            </>
          )}
          
          {/* History button */}
          {!showHistory && executionHistory.length > 0 && (
            <button
              onClick={() => onSetShowHistory(true)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                'bg-slate-100 dark:bg-gray-800 hover:bg-purple-100 dark:hover:bg-purple-500/20',
                'text-slate-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400',
                'border border-slate-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-500/50'
              )}
              title="View execution history"
            >
              <History className="w-3.5 h-3.5" />
              <span>Flow History</span>
              <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-semibold">
                {executionHistory.length}
              </span>
            </button>
          )}
          
          {/* Minimize button */}
          {isPanel && (
            <button
              onClick={onCollapse}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              title="Minimize panel"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          )}
          
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Stage message */}
      {!showHistory && isLive && stageMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs text-slate-500 dark:text-gray-400 flex items-center gap-2"
        >
          <Activity className="w-3 h-3 animate-pulse" />
          {stageMessage}
        </motion.div>
      )}
    </div>
  );
}

export default WorkflowHeader;
