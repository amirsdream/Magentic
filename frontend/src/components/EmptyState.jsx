/**
 * EmptyState component - displayed when no messages
 */

import React from 'react';
import { Sparkles } from 'lucide-react';

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Sparkles className="w-16 h-16 text-violet-400/50 dark:text-purple-400/50 mb-4" />
      <h2 className="text-xl font-semibold text-slate-600 dark:text-gray-300 mb-2">Welcome to Magentic</h2>
      <p className="text-slate-500 dark:text-gray-500 max-w-md">
        Ask me anything. I'll create a dynamic network of AI agents to solve your query.
      </p>
    </div>
  );
}

export default EmptyState;
