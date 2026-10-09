/**
 * Sync barrier between Ropex pipeline stages.
 */

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import clsx from 'clsx';

function PipelineBarrierNode({ data }) {
  const status = data?.status || 'pending';
  return (
    <div
      className={clsx(
        'flex h-10 w-10 items-center justify-center rounded-full border-2 text-[10px] font-semibold',
        status === 'complete'
          ? 'border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300'
          : status === 'running'
            ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
            : 'border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/80 text-slate-500'
      )}
      title="Stage barrier"
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate-400" />
      {data?.label || '∥'}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-slate-400" />
    </div>
  );
}

export default memo(PipelineBarrierNode);
