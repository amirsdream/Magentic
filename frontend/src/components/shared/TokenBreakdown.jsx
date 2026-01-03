/**
 * TokenBreakdown - Token usage breakdown display
 * Shows planning, input, output tokens and cost in a glass-style container
 */
import React from 'react';

export function TokenBreakdown({ tokenUsage, costFormatted }) {
  if (!tokenUsage?.total?.total_tokens) return null;

  return (
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
  );
}

export default TokenBreakdown;
