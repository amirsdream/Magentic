/**
 * AgentActionFlow — inside a selected workflow step: action timeline
 * (thoughts, tools, observations, output).
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  MessageSquare,
  Eye,
  Brain,
  FileOutput,
  CircleDot,
} from 'lucide-react';

function actionIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('tool')) return Wrench;
  if (t.includes('thought') || t.includes('thinking')) return Brain;
  if (t.includes('observ')) return Eye;
  if (t.includes('output') || t.includes('result')) return FileOutput;
  return MessageSquare;
}

function buildActions(step) {
  if (!step) return [];
  const actions = [];
  const logs = step.logs || [];
  logs.forEach((log, i) => {
    actions.push({
      id: `log-${i}`,
      type: log.type || 'log',
      content: log.content || log.message || '',
      kind: 'log',
    });
  });
  (step.tool_calls || []).forEach((tool, i) => {
    actions.push({
      id: `tool-${i}`,
      type: 'tool',
      content: tool.name || tool || 'tool',
      kind: 'tool',
    });
  });
  if (step.output) {
    actions.push({
      id: 'output',
      type: 'output',
      content: step.output,
      kind: 'output',
    });
  }
  return actions;
}

export default function AgentActionFlow({ step, workflowName, className = '' }) {
  const actions = useMemo(() => buildActions(step), [step]);

  if (!step) {
    return (
      <div className={`flex h-full min-h-0 flex-col ${className}`}>
        <div className="border-b border-slate-200/70 dark:border-slate-800 px-4 py-3">
          <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
            Actions
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Select a step on the canvas
          </p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <CircleDot className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="font-display text-xl text-slate-800 dark:text-slate-100 mb-1">
            Agent actions
          </p>
          <p className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            Click a step in the workflow to inspect thoughts, tools, and outputs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div className="border-b border-slate-200/70 dark:border-slate-800 px-4 py-3">
        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">
          {step.role || 'Step'}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {workflowName ? `${workflowName} · ` : ''}
          {step.status || 'pending'}
          {step.task ? ` · ${step.task}` : ''}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-on-hover px-3 py-3">
        {actions.length === 0 ? (
          <p className="px-1 py-6 text-center text-[12px] text-slate-500 dark:text-slate-400">
            No actions yet for this step.
          </p>
        ) : (
          <ul className="relative space-y-0">
            <div
              aria-hidden
              className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700"
            />
            <AnimatePresence initial={false}>
              {actions.map((action, index) => {
                const Icon = actionIcon(action.type);
                return (
                  <motion.li
                    key={action.id}
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.2 }}
                    className="relative flex gap-3 pb-4 last:pb-0"
                  >
                    <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        {action.type}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-slate-700 dark:text-slate-300 font-mono">
                        {action.content}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
