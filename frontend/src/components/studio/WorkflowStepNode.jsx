/**
 * ReactFlow node for one workflow step (orchestrator-style).
 */

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Check, Loader2, X, Circle, StopCircle } from 'lucide-react';
import clsx from 'clsx';

function StatusIcon({ status }) {
  if (status === 'complete') return <Check className="h-3 w-3 text-white" strokeWidth={3} />;
  if (status === 'error') return <X className="h-3 w-3 text-white" strokeWidth={3} />;
  if (status === 'stopped') return <StopCircle className="h-3 w-3 text-white" strokeWidth={2.5} />;
  if (status === 'running') return <Loader2 className="h-3 w-3 text-white animate-spin" />;
  return <Circle className="h-2.5 w-2.5 text-slate-400" strokeWidth={2} />;
}

function statusRing(status) {
  switch (status) {
    case 'complete':
      return 'border-teal-500/70 bg-teal-500/10';
    case 'error':
      return 'border-rose-500/70 bg-rose-500/10';
    case 'stopped':
      return 'border-amber-500/70 bg-amber-500/10';
    case 'running':
      return 'border-sky-500 bg-sky-500/10 shadow-[0_0_0_3px_rgba(14,165,233,0.15)]';
    default:
      return 'border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/90';
  }
}

function badgeClass(status) {
  switch (status) {
    case 'complete':
      return 'bg-teal-600';
    case 'error':
      return 'bg-rose-500';
    case 'stopped':
      return 'bg-amber-500';
    case 'running':
      return 'bg-sky-500';
    default:
      return 'bg-slate-400 dark:bg-slate-600';
  }
}

function WorkflowStepNode({ data, selected }) {
  const status = data.status || 'pending';
  return (
    <div
      className={clsx(
        'min-w-[180px] max-w-[210px] rounded-xl border-2 px-3 py-2.5 shadow-sm transition-shadow',
        statusRing(status),
        selected && 'ring-2 ring-sky-400/60 ring-offset-2 ring-offset-transparent'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-sky-500"
      />
      <div className="flex items-start gap-2">
        <div
          className={clsx(
            'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full',
            badgeClass(status)
          )}
        >
          <StatusIcon status={status} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
            {data.role || 'agent'}
          </p>
          {data.task ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              {data.task}
            </p>
          ) : null}
          <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
            {data.stageLabel || `Stage ${(data.layer ?? 0) + 1}`}
            {status === 'running' ? ' · working' : ''}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-teal-500"
      />
    </div>
  );
}

export default memo(WorkflowStepNode);
