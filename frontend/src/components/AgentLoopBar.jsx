/**
 * AgentLoopBar — Copilot-style vertical agent loop timeline.
 * A continuous bar line tracks progress through agent steps.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  Loader2,
  ChevronRight,
  Circle,
  StopCircle,
  Wrench,
} from 'lucide-react';

function statusOf(agent) {
  const s = agent?.status;
  if (s === 'complete' || s === 'completed') return 'complete';
  if (s === 'error' || s === 'failed') return 'error';
  if (s === 'stopped') return 'stopped';
  if (s === 'running') return 'running';
  return 'pending';
}

function NodeIcon({ status }) {
  if (status === 'complete') {
    return <Check className="w-3 h-3 text-white" strokeWidth={3} />;
  }
  if (status === 'error') {
    return <X className="w-3 h-3 text-white" strokeWidth={3} />;
  }
  if (status === 'stopped') {
    return <StopCircle className="w-3 h-3 text-white" strokeWidth={2.5} />;
  }
  if (status === 'running') {
    return <Loader2 className="w-3 h-3 text-white animate-spin" strokeWidth={2.5} />;
  }
  return <Circle className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" strokeWidth={2} />;
}

function nodeClasses(status) {
  switch (status) {
    case 'complete':
      return 'bg-teal-600 border-teal-600 shadow-teal-500/25';
    case 'error':
      return 'bg-rose-500 border-rose-500 shadow-rose-500/25';
    case 'stopped':
      return 'bg-amber-500 border-amber-500 shadow-amber-500/25';
    case 'running':
      return 'bg-sky-500 border-sky-500 shadow-sky-500/30 loop-node-pulse';
    default:
      return 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600';
  }
}

function recentLogs(agent, limit = 4) {
  const logs = agent?.logs || [];
  if (!logs.length) return [];
  return logs.slice(-limit);
}

function LoopStep({ agent, index, isLast, defaultOpen }) {
  const status = statusOf(agent);
  const [open, setOpen] = useState(defaultOpen || status === 'running');
  const logs = recentLogs(agent);
  const tools = agent?.tool_calls || [];
  const hasDetails = Boolean(agent?.output || logs.length || tools.length || agent?.task);

  // Keep running step expanded as it streams
  useEffect(() => {
    if (status === 'running') setOpen(true);
  }, [status]);

  return (
    <div className="relative flex gap-3">
      {/* Vertical rail segment */}
      <div className="relative flex flex-col items-center w-5 flex-shrink-0">
        <div
          className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-sm ${nodeClasses(status)}`}
        >
          <NodeIcon status={status} />
        </div>
        {!isLast && (
          <div className="absolute top-5 bottom-0 left-1/2 w-px -translate-x-1/2 bg-slate-200 dark:bg-slate-700" />
        )}
      </div>

      {/* Step body */}
      <div className={`flex-1 min-w-0 pb-4 ${isLast ? 'pb-0' : ''}`}>
        <button
          type="button"
          onClick={() => hasDetails && setOpen((v) => !v)}
          className={`group flex w-full items-start gap-2 text-left ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 tracking-tight">
                {agent.role || `Agent ${index + 1}`}
              </span>
              {status === 'running' && (
                <span className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                  working…
                </span>
              )}
              {status === 'complete' && (
                <span className="text-[11px] text-teal-700/80 dark:text-teal-400/80">done</span>
              )}
              {status === 'error' && (
                <span className="text-[11px] text-rose-600 dark:text-rose-400">failed</span>
              )}
            </div>
            {agent.task && (
              <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {agent.task}
              </p>
            )}
          </div>
          {hasDetails && (
            <ChevronRight
              className={`mt-0.5 h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                open ? 'rotate-90' : ''
              }`}
            />
          )}
        </button>

        <AnimatePresence initial={false}>
          {open && hasDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-900/40 px-3 py-2.5">
                {logs.map((log, i) => (
                  <div
                    key={`${log.timestamp || i}-${log.type}`}
                    className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-300 font-mono whitespace-pre-wrap break-words"
                  >
                    {log.type && log.type !== 'log' && (
                      <span className="mr-1.5 text-[10px] uppercase tracking-wide text-slate-400">
                        {log.type}
                      </span>
                    )}
                    {log.content || log.message || ''}
                  </div>
                ))}

                {tools.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {tools.map((tool, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[11px] text-slate-600 dark:text-slate-300"
                      >
                        <Wrench className="w-3 h-3 text-slate-400" />
                        {tool.name || tool}
                      </span>
                    ))}
                  </div>
                )}

                {agent.output && (
                  <div className="pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
                    <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-6 whitespace-pre-wrap">
                      {agent.output}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {object} props.execution - current or historical execution state
 * @param {boolean} [props.compact]
 */
export default function AgentLoopBar({ execution, compact = false }) {
  const agents = useMemo(() => {
    const list = execution?.agents || execution?.plan?.agents || [];
    return Array.isArray(list) ? list : [];
  }, [execution?.agents, execution?.plan?.agents]);

  const progress = useMemo(() => {
    if (!agents.length) return 0;
    const done = agents.filter((a) => {
      const s = statusOf(a);
      return s === 'complete' || s === 'error' || s === 'stopped';
    }).length;
    const running = agents.some((a) => statusOf(a) === 'running') ? 0.35 : 0;
    return Math.min(1, (done + running) / agents.length);
  }, [agents]);

  const isLive =
    execution?.stage &&
    execution.stage !== 'complete' &&
    execution.stage !== 'stopped' &&
    execution.stage !== 'error';

  if (!agents.length) {
    if (!isLive && !execution?.isLoading) return null;
    return (
      <div className={`${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
        <div className="relative flex gap-3">
          <div className="relative flex flex-col items-center w-5 flex-shrink-0">
            <div className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-sky-500 border-sky-500 shadow-sky-500/30 loop-node-pulse">
              <Loader2 className="w-3 h-3 text-white animate-spin" />
            </div>
            <div className="mt-1 h-8 w-px bg-gradient-to-b from-sky-400/60 to-transparent" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
              Planning
            </p>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              {execution?.stageMessage || 'Analyzing query and building agent loop…'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      {/* Progress track (Copilot-style loop bar) */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 via-teal-500 to-teal-400"
            initial={false}
            animate={{ width: `${Math.max(progress * 100, isLive ? 8 : 0)}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
          {isLive && (
            <motion.div
              className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              animate={{ left: ['-20%', '120%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </div>
        <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {agents.filter((a) => statusOf(a) === 'complete').length}/{agents.length}
        </span>
      </div>

      {/* Vertical loop timeline */}
      <div className="relative">
        {agents.map((agent, index) => (
          <LoopStep
            key={agent.agent_id || `${agent.role}-${index}`}
            agent={agent}
            index={index}
            isLast={index === agents.length - 1}
            defaultOpen={statusOf(agent) === 'running'}
          />
        ))}
      </div>
    </div>
  );
}
