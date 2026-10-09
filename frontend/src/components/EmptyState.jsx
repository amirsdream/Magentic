/**
 * EmptyState — clean first-viewport welcome for Magentic chat.
 */

import React from 'react';
import { motion } from 'framer-motion';

function EmptyState() {
  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-6 overflow-hidden">
      {/* Soft atmosphere — not a flat fill */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% 35%, rgba(14,165,233,0.12), transparent 60%), radial-gradient(ellipse 60% 40% at 70% 70%, rgba(20,184,166,0.08), transparent 55%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="max-w-lg"
      >
        <p className="font-display text-4xl sm:text-5xl tracking-tight text-slate-900 dark:text-white mb-3">
          Magentic
        </p>
        <p className="text-[15px] leading-relaxed text-slate-500 dark:text-slate-400 mb-8">
          Ask a question. Watch specialized agents run in a live loop — plan, act, and
          synthesize — with a clear progress bar for every step.
        </p>

        {/* Mini loop preview (decorative) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mx-auto w-full max-w-xs text-left"
        >
          <div className="h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden mb-4">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400"
              animate={{ width: ['18%', '72%', '42%', '88%'] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <div className="space-y-3">
            {['Plan', 'Research', 'Synthesize'].map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    i === 0
                      ? 'bg-teal-500'
                      : i === 1
                        ? 'bg-sky-500 loop-node-pulse'
                        : 'border border-slate-300 dark:border-slate-600 bg-transparent'
                  }`}
                />
                <span className="text-[13px] text-slate-500 dark:text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default EmptyState;
