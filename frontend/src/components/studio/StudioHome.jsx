/**
 * StudioHome — chat-first landing to create workflows,
 * with recent pipelines listed underneath.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Workflow, ChevronRight, Sparkles } from 'lucide-react';
import EnhancedChatInput from '../EnhancedChatInput';
import { statusOf } from '../../utils/workflowModel';

function RecentRow({ item, onOpen }) {
  const steps = item.steps || [];
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group flex w-full items-center gap-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 px-3.5 py-3 text-left hover:border-sky-400/45 transition-colors"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
        <Workflow className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
          {item.name || 'Untitled'}
        </p>
        <p className="truncate text-[11px] text-slate-500">
          {steps.length} agents
          {item.stage ? ` · ${String(item.stage).replace(/_/g, ' ')}` : ''}
          {steps.length
            ? ` · ${steps.filter((s) => statusOf(s) === 'complete').length}/${steps.length}`
            : ''}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-sky-500" />
    </button>
  );
}

export default function StudioHome({
  workflows = [],
  onOpen,
  onCreate,
  onSend,
  onStop,
  isConnected,
  isProcessing,
  disabled,
  disabledMessage,
}) {
  const recent = workflows.slice(0, 8);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 55% at 50% 0%, rgba(14,165,233,0.14), transparent 58%), radial-gradient(ellipse 45% 40% at 85% 70%, rgba(20,184,166,0.09), transparent 50%)',
        }}
      />

      <div className="relative flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col px-6 pt-12 pb-6 sm:pt-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8 text-center"
          >
            <p className="font-display text-5xl sm:text-6xl tracking-tight text-slate-900 dark:text-white">
              Magentic
            </p>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
              Describe what you need. Magentic plans a Ropex pipeline — then open
              it to inspect stages, agents, and execution.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 shadow-[0_8px_40px_-20px_rgba(14,165,233,0.35)] overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-2.5">
              <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <p className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
                Create a workflow
              </p>
            </div>
            <EnhancedChatInput
              onSend={onSend}
              onStop={onStop}
              isConnected={isConnected}
              disabled={disabled}
              isProcessing={isProcessing}
              showSuggestions={false}
              disabledMessage={disabledMessage}
            />
          </motion.div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">
              Recent pipelines
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-1 text-[12px] text-sky-600 dark:text-sky-400 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Blank draft
            </button>
          </div>

          <div className="mt-3 space-y-2 pb-10">
            {recent.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-[13px] text-slate-500">
                No pipelines yet — send a message above to plan one with Ropex.
              </p>
            ) : (
              recent.map((item) => (
                <RecentRow
                  key={`${item._bucket || item.source}-${item.id}`}
                  item={item}
                  onOpen={onOpen}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
