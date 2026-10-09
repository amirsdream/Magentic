/**
 * WorkflowYamlPanel — live YAML view of the Ropex workflow plan.
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileCode2, Copy, Check } from 'lucide-react';
import { workflowYamlFromExecution } from '../../utils/workflowYaml';

export default function WorkflowYamlPanel({ execution, prompt, className = '' }) {
  const [copied, setCopied] = useState(false);

  const yaml = useMemo(
    () => workflowYamlFromExecution(execution, prompt),
    [execution, prompt]
  );

  const isAwaiting =
    execution?.stage === 'awaiting_approval' || Boolean(execution?.approval?.pipeline_id);
  const hasPlan = Boolean(
    (execution?.agents && execution.agents.length) ||
      (execution?.plan?.agents && execution.plan.agents.length) ||
      execution?.workflowYaml
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard may be denied */
    }
  };

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode2 className="h-4 w-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 tracking-tight">
              Workflow
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {isAwaiting
                ? 'Waiting for approval'
                : hasPlan
                  ? 'Live YAML from Ropex plan'
                  : 'YAML appears after planning'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!hasPlan}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 disabled:opacity-40"
          title="Copy YAML"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="relative flex-1 min-h-0 overflow-auto studio-yaml-scroll">
        <motion.pre
          key={hasPlan ? 'plan' : 'empty'}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="m-0 px-4 py-3 text-[12px] leading-relaxed font-mono text-slate-700 dark:text-slate-300 whitespace-pre"
        >
          <code>{yaml}</code>
        </motion.pre>
        {isAwaiting && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent studio-yaml-scan"
          />
        )}
      </div>
    </div>
  );
}
