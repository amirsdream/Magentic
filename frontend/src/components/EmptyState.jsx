/**
 * EmptyState — first-viewport welcome for Magentic studio.
 */

import React from 'react';
import { motion } from 'framer-motion';

function EmptyState({ studioMode = false }) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-6 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% 35%, rgba(14,165,233,0.14), transparent 60%), radial-gradient(ellipse 55% 40% at 75% 75%, rgba(20,184,166,0.10), transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 40%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-md"
      >
        <motion.p
          className="font-display text-5xl sm:text-6xl tracking-tight text-slate-900 dark:text-white mb-4"
          initial={{ opacity: 0, letterSpacing: '0.04em' }}
          animate={{ opacity: 1, letterSpacing: '-0.02em' }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
        >
          Magentic
        </motion.p>
        <p className="text-[15px] leading-relaxed text-slate-500 dark:text-slate-400 mb-9">
          {studioMode
            ? 'Chat to plan a workflow. Review the YAML, walk the steps, approve when you are ready.'
            : 'Ask a question. Watch specialized agents plan, act, and synthesize with a clear progress bar.'}
        </p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.55 }}
          className="mx-auto w-full max-w-xs text-left"
        >
          <div className="h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden mb-5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400"
              animate={{ width: ['14%', '68%', '38%', '86%'] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <div className="space-y-3.5">
            {(studioMode
              ? [
                  { label: 'Plan YAML', state: 'done' },
                  { label: 'Human approval', state: 'live' },
                  { label: 'Run steps', state: 'pending' },
                ]
              : [
                  { label: 'Plan', state: 'done' },
                  { label: 'Research', state: 'live' },
                  { label: 'Synthesize', state: 'pending' },
                ]
            ).map(({ label, state }, i) => (
              <motion.div
                key={label}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.28 + i * 0.1, duration: 0.35 }}
              >
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    state === 'done'
                      ? 'bg-teal-500'
                      : state === 'live'
                        ? 'bg-sky-500 loop-node-pulse'
                        : 'border border-slate-300 dark:border-slate-600 bg-transparent'
                  }`}
                />
                <span className="text-[13px] text-slate-500 dark:text-slate-400">{label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default EmptyState;
