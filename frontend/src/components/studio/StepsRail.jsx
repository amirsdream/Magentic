/**
 * StepsRail — vertical step timeline for the studio right pane.
 * Wraps AgentLoopBar with studio chrome.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ListOrdered } from 'lucide-react';
import AgentLoopBar from '../AgentLoopBar';

function stageLabel(stage) {
  switch (stage) {
    case 'awaiting_approval':
      return 'Awaiting approval';
    case 'planned':
      return 'Plan ready';
    case 'executing':
    case 'running':
      return 'Running';
    case 'complete':
      return 'Complete';
    case 'stopped':
      return 'Stopped';
    case 'error':
      return 'Failed';
    case 'initializing':
    case 'thinking':
      return 'Planning';
    default:
      return stage ? String(stage).replace(/_/g, ' ') : 'Idle';
  }
}

export default function StepsRail({ execution, className = '' }) {
  const agents = useMemo(() => {
    const list = execution?.agents || execution?.plan?.agents || [];
    return Array.isArray(list) ? list : [];
  }, [execution?.agents, execution?.plan?.agents]);

  const done = agents.filter((a) => {
    const s = a?.status;
    return s === 'complete' || s === 'completed' || s === 'error' || s === 'failed' || s === 'stopped';
  }).length;

  const isLive =
    execution?.stage &&
    !['complete', 'stopped', 'error'].includes(execution.stage);

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <ListOrdered className="h-4 w-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 tracking-tight">
              Steps
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate capitalize">
              {stageLabel(execution?.stage)}
              {agents.length > 0 ? ` · ${done}/${agents.length}` : ''}
            </p>
          </div>
        </div>
        {isLive && (
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-sky-500"
            animate={{ opacity: [1, 0.35, 1], scale: [1, 1.2, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-on-hover">
        {execution ? (
          <AgentLoopBar execution={execution} compact />
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="font-display text-2xl text-slate-800 dark:text-slate-100 mb-2">
              Steps
            </p>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Agent steps appear here after Ropex plans the workflow.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
