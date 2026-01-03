/**
 * ExecutionHistoryBar - Compact horizontal list of executions with popup DAG view
 * Shows: chronological execution history, click to view DAG in modal
 */
import React, { useState, memo } from 'react';
import { 
  CheckCircle, 
  Brain, 
  StopCircle, 
  X, 
  Coins, 
  DollarSign,
  ChevronRight,
  Zap,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WorkflowVisualization from './WorkflowVisualization';

// Execution item in the history bar
const ExecutionItem = memo(function ExecutionItem({ 
  execution, 
  index, 
  isLast, 
  isActive,
  onClick 
}) {
  const isStopped = execution?.stage === 'stopped';
  const isComplete = execution?.stage === 'complete' || 
    (execution?.agents?.every(a => a.status === 'complete' || a.status === 'completed'));
  const isRunning = !isComplete && !isStopped;
  
  const agentCount = execution?.agents?.length || 0;
  const completedCount = execution?.agents?.filter(a => 
    a.status === 'complete' || a.status === 'completed'
  ).length || 0;
  
  const tokenUsage = execution?.token_usage;
  const hasCost = tokenUsage?.total?.total_cost > 0;
  const costFormatted = tokenUsage?.total?.cost_formatted || '$0.00';
  
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 group
        ${isActive 
          ? 'bg-violet-100 dark:bg-purple-500/20 ring-2 ring-violet-500/50 dark:ring-purple-500/50' 
          : 'bg-slate-100/80 dark:bg-gray-800/60 hover:bg-slate-200/80 dark:hover:bg-gray-700/60'
        }
        ${isRunning ? 'animate-pulse' : ''}
      `}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {isStopped ? (
          <StopCircle className="w-3.5 h-3.5 text-orange-500" />
        ) : isComplete ? (
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Brain className="w-3.5 h-3.5 text-violet-500 dark:text-purple-400 animate-pulse" />
        )}
      </div>
      
      {/* Execution info */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-xs font-medium text-slate-600 dark:text-gray-300">
          #{index + 1}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-gray-500">
          {agentCount > 0 ? `${completedCount}/${agentCount}` : '...'}
        </span>
        {hasCost && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {costFormatted}
          </span>
        )}
      </div>
      
      {/* Running indicator */}
      {isRunning && (
        <div className="flex gap-0.5">
          <span className="w-1 h-1 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
      
      {/* Hover indicator for clicking */}
      <ChevronRight className="w-3 h-3 text-slate-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
});

// DAG Modal Popup
const DAGModal = memo(function DAGModal({ execution, onClose, index }) {
  const isStopped = execution?.stage === 'stopped';
  const isComplete = execution?.stage === 'complete' || 
    (execution?.agents?.every(a => a.status === 'complete' || a.status === 'completed'));
  
  const tokenUsage = execution?.token_usage;
  const hasTokens = tokenUsage?.total?.total_tokens > 0;
  const costFormatted = tokenUsage?.total?.cost_formatted || '$0.00';
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-4xl max-h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${
          isStopped 
            ? 'border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/10' 
            : isComplete 
              ? 'border-green-500/30 bg-green-50/50 dark:bg-green-500/10' 
              : 'border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isStopped ? (
                <StopCircle className="w-5 h-5 text-orange-500" />
              ) : isComplete ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <Brain className="w-5 h-5 text-violet-500 dark:text-purple-400 animate-pulse" />
              )}
              <span className="font-semibold text-slate-700 dark:text-gray-200">
                Execution #{index + 1}
              </span>
            </div>
            
            {/* Stats badges */}
            {hasTokens && (
              <div className="flex items-center gap-2 ml-3">
                <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 rounded-full">
                  <Coins className="w-3 h-3 text-amber-500" />
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    {tokenUsage.total.total_tokens.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-full">
                  <DollarSign className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {costFormatted}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-gray-400" />
          </button>
        </div>
        
        {/* DAG Content */}
        <div className="overflow-auto max-h-[calc(80vh-60px)]">
          <WorkflowVisualization
            execution={execution}
            isPanel={true}
            isLive={!isComplete && !isStopped}
          />
        </div>
      </motion.div>
    </motion.div>
  );
});

// Main ExecutionHistoryBar component
function ExecutionHistoryBar({ 
  executions = [], // Array of all executions in the session
  currentExecution = null, // Currently running execution
  onRetry = null 
}) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  
  // Combine historical executions with current
  const allExecutions = [...executions];
  if (currentExecution && !executions.includes(currentExecution)) {
    allExecutions.push(currentExecution);
  }
  
  if (allExecutions.length === 0) return null;
  
  const selectedExecution = selectedIndex !== null ? allExecutions[selectedIndex] : null;
  
  // Get the last/current execution for quick stats
  const lastExecution = allExecutions[allExecutions.length - 1];
  const isLastRunning = lastExecution && 
    lastExecution.stage !== 'complete' && 
    lastExecution.stage !== 'stopped';
  
  return (
    <>
      {/* Compact history bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm border-b border-slate-200/60 dark:border-gray-700/60">
        {/* Label */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 flex-shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-medium">Executions</span>
        </div>
        
        {/* Divider */}
        <div className="w-px h-4 bg-slate-200 dark:bg-gray-700" />
        
        {/* Execution list - horizontal scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1">
          {allExecutions.map((exec, idx) => (
            <ExecutionItem
              key={exec.id || `exec-${idx}`}
              execution={exec}
              index={idx}
              isLast={idx === allExecutions.length - 1}
              isActive={selectedIndex === idx}
              onClick={() => setSelectedIndex(idx)}
            />
          ))}
        </div>
        
        {/* Current status summary */}
        {isLastRunning && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-violet-100/80 dark:bg-purple-500/20 rounded-full flex-shrink-0">
            <Zap className="w-3 h-3 text-violet-500 dark:text-purple-400" />
            <span className="text-xs font-medium text-violet-600 dark:text-purple-300">
              Running
            </span>
          </div>
        )}
      </div>
      
      {/* DAG Modal */}
      <AnimatePresence>
        {selectedExecution && (
          <DAGModal
            execution={selectedExecution}
            index={selectedIndex}
            onClose={() => setSelectedIndex(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default memo(ExecutionHistoryBar);
