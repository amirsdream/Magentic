/**
 * WorkflowList — primary studio entry: pick a workflow to open.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Workflow,
  Play,
  Clock,
  Pencil,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { statusOf } from '../../utils/workflowModel';

function stageTone(stage) {
  if (stage === 'awaiting_approval') return 'text-amber-600 dark:text-amber-400';
  if (stage === 'executing' || stage === 'running') return 'text-sky-600 dark:text-sky-400';
  if (stage === 'complete') return 'text-teal-600 dark:text-teal-400';
  if (stage === 'stopped' || stage === 'error') return 'text-rose-600 dark:text-rose-400';
  if (stage === 'draft') return 'text-slate-500';
  return 'text-slate-500 dark:text-slate-400';
}

function stepSummary(workflow) {
  const steps = workflow.steps || [];
  if (!steps.length) return 'No steps yet';
  const done = steps.filter((s) => statusOf(s) === 'complete').length;
  const running = steps.some((s) => statusOf(s) === 'running');
  if (running) return `${done}/${steps.length} · running`;
  if (workflow.stage === 'awaiting_approval') return `${steps.length} steps · needs approval`;
  if (workflow.stage === 'complete') return `${steps.length} steps · complete`;
  return `${steps.length} step${steps.length === 1 ? '' : 's'}`;
}

function bucketMeta(bucket) {
  if (bucket === 'live') return { label: 'Live', Icon: Play };
  if (bucket === 'history') return { label: 'History', Icon: Clock };
  if (bucket === 'saved' || bucket === 'draft') return { label: 'Saved', Icon: Pencil };
  return { label: 'Workflow', Icon: Workflow };
}

function WorkflowCard({ item, index, onOpen }) {
  const { label, Icon } = bucketMeta(item._bucket || item.source);
  const steps = item.steps || [];

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.24), duration: 0.28 }}
      onClick={() => onOpen(item)}
      className="group w-full text-left rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 hover:border-sky-400/50 hover:bg-white dark:hover:bg-slate-900/80 px-5 py-4 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="truncate text-[15px] font-medium text-slate-900 dark:text-white">
              {item.name || 'Untitled workflow'}
            </h3>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              {label}
            </span>
          </div>
          <p className={`mt-1 text-[12px] ${stageTone(item.stage)}`}>
            {stepSummary(item)}
            {item.stage ? ` · ${String(item.stage).replace(/_/g, ' ')}` : ''}
          </p>
          {item.prompt || item.description ? (
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
              {item.prompt || item.description}
            </p>
          ) : null}

          {steps.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
              {steps.slice(0, 6).map((step, i) => (
                <React.Fragment key={step.id}>
                  {i > 0 && (
                    <span className="h-px w-3 flex-shrink-0 bg-slate-200 dark:bg-slate-700" />
                  )}
                  <span
                    className={`flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                      statusOf(step) === 'complete'
                        ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
                        : statusOf(step) === 'running'
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {step.role}
                  </span>
                </React.Fragment>
              ))}
              {steps.length > 6 && (
                <span className="text-[10px] text-slate-400">+{steps.length - 6}</span>
              )}
            </div>
          )}
        </div>
        <ChevronRight className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500" />
      </div>
    </motion.button>
  );
}

export default function WorkflowList({
  workflows = [],
  onOpen,
  onCreate,
}) {
  const sorted = useMemo(() => {
    const rank = { live: 0, history: 1, saved: 2, draft: 2, execution: 1 };
    return [...workflows].sort((a, b) => {
      const ra = rank[a._bucket || a.source] ?? 3;
      const rb = rank[b._bucket || b.source] ?? 3;
      if (ra !== rb) return ra - rb;
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
  }, [workflows]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(14,165,233,0.12), transparent 55%), radial-gradient(ellipse 40% 35% at 80% 80%, rgba(20,184,166,0.08), transparent 50%)',
        }}
      />

      <div className="relative flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <p className="font-display text-5xl sm:text-6xl tracking-tight text-slate-900 dark:text-white">
              Magentic
            </p>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
              Choose a workflow to open. Chat, inspect the agent flow, and approve
              runs from inside.
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-teal-500"
            >
              <Plus className="h-4 w-4" />
              New workflow
            </button>
          </motion.div>

          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-6 py-12 text-center">
              <Layers className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-[14px] font-medium text-slate-700 dark:text-slate-200">
                No workflows yet
              </p>
              <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                Create one, or send a chat after opening a draft to plan with Ropex.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((item, index) => (
                <WorkflowCard
                  key={`${item._bucket || item.source}-${item.id}`}
                  item={item}
                  index={index}
                  onOpen={onOpen}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
