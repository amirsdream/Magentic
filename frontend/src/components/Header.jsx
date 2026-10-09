/**
 * Header — Magentic studio chrome
 */

import React, { memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Menu,
  PanelLeftClose,
  GitBranch,
  Database,
  Loader2,
  X,
  FileText,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { useKnowledgeBaseStore } from '../store';
import clsx from 'clsx';

const UserButton = memo(function UserButton({ user, isGuest, onClick }) {
  const avatarEmoji = user?.avatar_emoji || '👤';

  return (
    <button
      onClick={onClick}
      className="relative w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-teal-600 hover:from-sky-400 hover:to-teal-500 text-lg shadow-md hover:shadow-sky-500/20 transition-all duration-200 hover:scale-105 active:scale-95"
      title="Open profile"
    >
      <span className="drop-shadow-sm">{avatarEmoji}</span>
      {isGuest && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-500 border-2 border-white dark:border-gray-900 rounded-full"
          title="Guest"
        />
      )}
    </button>
  );
});

const ConnectionStatus = memo(function ConnectionStatus({ isConnected }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100/80 dark:bg-gray-800/50 border border-slate-200/50 dark:border-gray-700/50">
      <div className="relative">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-teal-500' : 'bg-rose-500'
          }`}
        />
        {isConnected && (
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-teal-500 animate-ping opacity-75" />
        )}
      </div>
      <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400 hidden sm:inline">
        {isConnected ? 'Live' : 'Offline'}
      </span>
    </div>
  );
});

const EngineBadge = memo(function EngineBadge({ engine, ropexStatus, requireApproval }) {
  if (!engine) return null;
  const isRopex = engine === 'ropex';
  const healthy = !isRopex || ropexStatus === 'healthy' || ropexStatus == null;
  return (
    <div
      className={clsx(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium',
        isRopex
          ? healthy
            ? 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
          : 'bg-slate-100/80 dark:bg-gray-800/50 border-slate-200/50 dark:border-gray-700/50 text-slate-500 dark:text-gray-400'
      )}
      title={
        isRopex
          ? healthy
            ? `Ropex engine${requireApproval ? ' · HITL approval on' : ''}`
            : 'Ropex configured but unreachable'
          : 'Execution engine: LangGraph'
      }
    >
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full',
          isRopex ? (healthy ? 'bg-teal-500' : 'bg-amber-500') : 'bg-slate-400'
        )}
      />
      <span className="hidden sm:inline">{isRopex ? 'Ropex' : 'LangGraph'}</span>
      {isRopex && requireApproval && (
        <ShieldCheck className="w-3 h-3 text-amber-600 dark:text-amber-400 hidden md:inline" />
      )}
    </div>
  );
});

const KnowledgeBaseButton = memo(function KnowledgeBaseButton() {
  const {
    sources,
    isLoading,
    showPanel,
    togglePanel,
    fetchSources,
    deleteSource,
  } = useKnowledgeBaseStore();

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={togglePanel}
        className={clsx(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-200',
          showPanel
            ? 'bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300'
            : 'bg-slate-100/80 dark:bg-gray-800/50 border-slate-200/50 dark:border-gray-700/50 text-slate-500 dark:text-gray-400 hover:border-sky-500/30'
        )}
        title="Knowledge base"
      >
        <Database className="w-4 h-4" />
        <span className="text-[11px] font-medium hidden sm:inline">KB</span>
        {sources.length > 0 && (
          <span className="text-[10px] tabular-nums px-1 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300">
            {sources.length}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-500" />
                Knowledge Base
              </h3>
              <button
                onClick={togglePanel}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                  <FileText className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No documents yet</p>
                  <p className="text-xs mt-1 text-gray-400">
                    Use the paperclip in chat to upload
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-gray-800">
                  {sources.map((source, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="truncate">{source}</span>
                      </span>
                      <button
                        onClick={() => deleteSource(source)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-2 flex-shrink-0"
                        title="Remove from knowledge base"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {sources.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                {sources.length} document{sources.length !== 1 ? 's' : ''} indexed
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

function Header({
  user,
  isGuest,
  isConnected,
  showExecutionDetails,
  onToggleExecutionDetails,
  onShowProfile,
  onToggleSidebar,
  sidebarOpen,
  onToggleWorkflow,
  showWorkflow,
  hasActiveExecution,
  executionEngine,
  ropexStatus,
  requireApproval,
  awaitingApproval,
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/75 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800 px-4 py-2.5 transition-colors duration-200">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0 min-w-0">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-sky-500/10 transition-colors text-slate-500 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400"
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </motion.button>

          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-[1.65rem] leading-none tracking-tight text-slate-900 dark:text-white">
              Magentic
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 tracking-wide">
              Studio
              {awaitingApproval && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">· awaiting approval</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onToggleWorkflow}
            className={`hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${
              showWorkflow
                ? 'bg-sky-500/15 border-sky-500/40'
                : 'bg-slate-100/80 dark:bg-gray-800/50 border-slate-200/50 dark:border-gray-700/50 hover:border-sky-500/30'
            }`}
            title={showWorkflow ? 'Hide history flow' : 'Show history flow'}
          >
            <GitBranch
              className={`w-4 h-4 ${
                showWorkflow
                  ? 'text-sky-600 dark:text-sky-400'
                  : hasActiveExecution
                    ? 'text-teal-500'
                    : 'text-slate-400 dark:text-gray-500'
              }`}
            />
            <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400">
              History
            </span>
          </motion.button>

          <KnowledgeBaseButton />

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onToggleExecutionDetails}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100/80 dark:bg-gray-800/50 border border-slate-200/50 dark:border-gray-700/50 hover:border-sky-500/30 transition-all duration-200"
            title={showExecutionDetails ? 'Hide agent details' : 'Show agent details'}
          >
            {showExecutionDetails ? (
              <Eye className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            ) : (
              <EyeOff className="w-4 h-4 text-slate-400 dark:text-gray-500" />
            )}
            <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400 hidden sm:inline">
              {showExecutionDetails ? 'Details' : 'Compact'}
            </span>
          </motion.button>

          <EngineBadge
            engine={executionEngine}
            ropexStatus={ropexStatus}
            requireApproval={requireApproval}
          />

          <ConnectionStatus isConnected={isConnected} />

          <UserButton user={user} isGuest={isGuest} onClick={onShowProfile} />
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
