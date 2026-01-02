/**
 * StatusLegend - Footer with status indicators legend
 */
import React from 'react';
import clsx from 'clsx';
import { STATUS_CONFIG, getColorClasses } from './constants';

export function StatusLegend({ viewMode, hasSelectedAgent }) {
  const statusLegend = [
    { status: 'pending', ...STATUS_CONFIG.pending },
    { status: 'running', ...STATUS_CONFIG.running },
    { status: 'completed', ...STATUS_CONFIG.completed },
    { status: 'stopped', ...STATUS_CONFIG.stopped },
    { status: 'error', ...STATUS_CONFIG.error },
  ];

  return (
    <div className="flex-shrink-0 px-5 py-3 border-t border-slate-200 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          {statusLegend.map(({ status, color, label }) => (
            <div key={status} className="flex items-center gap-1">
              <div className={clsx(
                'w-2 h-2 rounded-full',
                getColorClasses(color, 'bg')
              )} />
              <span className="text-[10px] text-slate-500 dark:text-gray-500">{label}</span>
            </div>
          ))}
        </div>
        {viewMode === 'dag' && hasSelectedAgent && (
          <span className="text-[10px] text-slate-400 dark:text-gray-500">
            Click node for details
          </span>
        )}
      </div>
    </div>
  );
}

export default StatusLegend;
