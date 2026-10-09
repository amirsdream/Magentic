/**
 * PipelineStrip — horizontal Ropex execution pipeline (stages).
 */

import React from 'react';
import { Check, Loader2, Circle } from 'lucide-react';
import clsx from 'clsx';
import { stagesFromSteps, statusOf } from '../../utils/workflowModel';

function stageTone(status) {
  if (status === 'complete') return 'border-teal-500 bg-teal-500 text-white';
  if (status === 'running' || status === 'partial') {
    return 'border-sky-500 bg-sky-500 text-white';
  }
  if (status === 'error') return 'border-rose-500 bg-rose-500 text-white';
  return 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-500';
}

function StageIcon({ status }) {
  if (status === 'complete') return <Check className="h-3 w-3" strokeWidth={3} />;
  if (status === 'running' || status === 'partial') {
    return <Loader2 className="h-3 w-3 animate-spin" />;
  }
  return <Circle className="h-2.5 w-2.5" />;
}

export default function PipelineStrip({ workflow, selectedStepId, onSelectStage }) {
  const stages =
    workflow?.stages?.length > 0
      ? workflow.stages
      : stagesFromSteps(workflow?.steps || []);

  if (!stages.length) {
    return (
      <div className="px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400">
        Pipeline appears after Ropex plans stages
      </div>
    );
  }

  const selectedLayer = workflow?.steps?.find((s) => s.id === selectedStepId)?.layer;

  return (
    <div className="border-b border-slate-200/70 dark:border-slate-800 px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Execution pipeline
        </p>
        <p className="text-[11px] tabular-nums text-slate-400">
          {stages.filter((s) => s.status === 'complete').length}/{stages.length} stages
        </p>
      </div>
      <div className="flex items-center gap-0 overflow-x-auto pb-0.5">
        {stages.map((stage, index) => {
          const agents = stage.agents || [];
          const status =
            stage.status ||
            (agents.some((a) => statusOf(a) === 'running')
              ? 'running'
              : agents.every((a) => statusOf(a) === 'complete')
                ? 'complete'
                : 'pending');
          const active = selectedLayer === (stage.layer ?? index);
          return (
            <React.Fragment key={stage.id || index}>
              {index > 0 && (
                <div
                  className={clsx(
                    'mx-1 h-px w-6 flex-shrink-0',
                    status === 'complete' || stages[index - 1]?.status === 'complete'
                      ? 'bg-teal-500/70'
                      : 'bg-slate-300 dark:bg-slate-600'
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => onSelectStage?.(stage)}
                className={clsx(
                  'flex flex-shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors',
                  active
                    ? 'border-sky-400/60 bg-sky-500/10'
                    : 'border-slate-200/80 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 hover:border-sky-400/40'
                )}
              >
                <span
                  className={clsx(
                    'flex h-6 w-6 items-center justify-center rounded-full border',
                    stageTone(status)
                  )}
                >
                  <StageIcon status={status} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium text-slate-800 dark:text-slate-100">
                    Stage {(stage.layer ?? index) + 1}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500 max-w-[120px]">
                    {agents.map((a) => a.role).filter(Boolean).join(' · ') || 'empty'}
                  </span>
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
