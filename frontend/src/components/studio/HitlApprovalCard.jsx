/**
 * HitlApprovalCard — human-in-the-loop gate before Ropex drain.
 * Interaction container (approve / reject); not decorative chrome.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Play, Ban } from 'lucide-react';

export default function HitlApprovalCard({
  approval,
  onApprove,
  onReject,
  disabled = false,
}) {
  if (!approval?.pipeline_id) return null;

  const stepCount = Array.isArray(approval.agents) ? approval.agents.length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="mx-4 mb-3 overflow-hidden rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-50/95 via-white to-sky-50/80 dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 shadow-[0_8px_32px_-12px_rgba(245,158,11,0.35)]"
      role="alertdialog"
      aria-labelledby="hitl-title"
      aria-describedby="hitl-desc"
    >
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <ShieldCheck className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            id="hitl-title"
            className="font-display text-xl tracking-tight text-slate-900 dark:text-white"
          >
            Approve workflow
          </p>
          <p
            id="hitl-desc"
            className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300"
          >
            {approval.message ||
              'Review the YAML and steps, then approve to drain the Ropex pipeline.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              {approval.pipeline_id}
            </span>
            {stepCount > 0 && (
              <span>
                {stepCount} step{stepCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-amber-200/60 dark:border-amber-800/40 bg-white/40 dark:bg-black/20 px-4 py-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onApprove?.(approval.pipeline_id)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-teal-500 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          <Play className="h-3.5 w-3.5" fill="currentColor" />
          Approve & run
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onReject?.(approval.pipeline_id)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white/80 dark:bg-slate-900/60 px-3.5 py-2 text-[13px] font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <Ban className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>
    </motion.div>
  );
}
