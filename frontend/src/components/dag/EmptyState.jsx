/**
 * EmptyState - Shown when no execution is active
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Activity, History } from 'lucide-react';

export function EmptyState({ executionHistory, onShowHistory }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-center h-full min-h-[300px] p-8"
    >
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
          <Activity className="w-8 h-8 text-slate-300 dark:text-gray-600" />
        </div>
        <h3 className="text-lg font-medium text-slate-600 dark:text-gray-300 mb-2">
          No Active Execution
        </h3>
        <p className="text-sm text-slate-500 dark:text-gray-500 max-w-xs mb-4">
          Send a message to see the agent workflow here.
        </p>
        {executionHistory.length > 0 && (
          <button
            onClick={onShowHistory}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-sm font-medium transition-colors"
          >
            <History className="w-4 h-4" />
            View {executionHistory.length} past execution{executionHistory.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default EmptyState;
