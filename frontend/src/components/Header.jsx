/**
 * Header component - app header with user info and controls
 */

import React, { memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Eye, EyeOff, Menu, PanelLeftClose, GitBranch, Database, Loader2, CheckCircle, X, FileText, Trash2 } from 'lucide-react';
import { useKnowledgeBaseStore } from '../store';
import clsx from 'clsx';

// Memoized user button to prevent unnecessary re-renders
const UserButton = memo(function UserButton({ user, isGuest, onClick }) {
  const avatarEmoji = user?.avatar_emoji || '👤';
  
  return (
    <button
      onClick={onClick}
      className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 dark:from-purple-500 dark:to-violet-600 hover:from-violet-600 hover:to-purple-700 dark:hover:from-purple-600 dark:hover:to-violet-700 text-xl shadow-lg hover:shadow-violet-500/25 transition-all duration-200 hover:scale-105 active:scale-95"
      title="Open profile"
    >
      <span className="drop-shadow-sm">{avatarEmoji}</span>
      {/* Guest indicator dot */}
      {isGuest && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-amber-500 border-2 border-white dark:border-gray-900 rounded-full" title="Guest" />
      )}
    </button>
  );
});

// Memoized connection status
const ConnectionStatus = memo(function ConnectionStatus({ isConnected }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-gray-800/50 border border-slate-200/50 dark:border-gray-700/50">
      <div className="relative">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            isConnected ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        />
        {isConnected && (
          <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
        )}
      </div>
      <span className="text-xs font-medium text-slate-500 dark:text-gray-400 hidden sm:inline">
        {isConnected ? 'Connected' : 'Offline'}
      </span>
    </div>
  );
});

// Knowledge Base Button with panel
const KnowledgeBaseButton = memo(function KnowledgeBaseButton() {
  const {
    sources,
    isLoading,
    uploadProgress,
    showPanel,
    togglePanel,
    fetchSources,
    deleteSource,
  } = useKnowledgeBaseStore();

  // Fetch sources on initial mount to show the count badge
  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleToggle = () => {
    if (!showPanel) {
      fetchSources();
    }
    togglePanel();
  };

  const isUploading = uploadProgress?.status === 'uploading';
  const isSuccess = uploadProgress?.status === 'success';

  return (
    <div className="relative">
      {/* Upload Status Tooltip - appears below button */}
      <AnimatePresence>
        {(isUploading || isSuccess) && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            className={clsx(
              'absolute top-full right-0 mt-2 px-3 py-2 rounded-lg shadow-lg text-xs font-medium whitespace-nowrap z-50',
              isUploading 
                ? 'bg-violet-600 text-white' 
                : 'bg-emerald-500 text-white'
            )}
          >
            {/* Tooltip arrow pointing up */}
            <div className={clsx(
              'absolute bottom-full right-4 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent',
              isUploading ? 'border-b-violet-600' : 'border-b-emerald-500'
            )} />
            <div className="flex items-center gap-2">
              {isUploading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{uploadProgress?.message || 'Uploading...'}</span>
                  <span className="text-white/70">{uploadProgress?.progress || 0}%</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3" />
                  <span>Added to Knowledge Base</span>
                </>
              )}
            </div>
            {/* Progress bar - only during upload */}
            {isUploading && (
              <div className="mt-2 w-full h-1 bg-white/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${uploadProgress?.progress || 0}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* KB Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleToggle}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200',
          showPanel || isUploading
            ? 'bg-violet-500/20 dark:bg-purple-500/30 border-violet-500/50 dark:border-purple-500/50'
            : 'bg-slate-100/80 dark:bg-gray-800/50 border-slate-200/50 dark:border-gray-700/50 hover:bg-violet-500/10 dark:hover:bg-purple-500/20 hover:border-violet-500/30 dark:hover:border-purple-500/30'
        )}
        title="Knowledge Base"
      >
        <Database className={clsx(
          'w-4 h-4',
          showPanel || isUploading ? 'text-violet-600 dark:text-purple-400' : 'text-slate-400 dark:text-gray-500'
        )} />
        <span className="text-xs font-medium text-slate-500 dark:text-gray-400 hidden sm:inline">
          Knowledge
        </span>
        {sources.length > 0 && (
          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-violet-100 dark:bg-purple-900/50 text-[10px] font-semibold text-violet-600 dark:text-purple-400">
            {sources.length}
          </span>
        )}
      </motion.button>

      {/* KB Panel Dropdown */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-violet-500" />
                Knowledge Base
              </h3>
              <button
                onClick={togglePanel}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
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
                  <p className="text-xs mt-1 text-gray-400">Use the paperclip in chat to upload</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-gray-800">
                  {sources.map((source, idx) => (
                    <li key={idx} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50">
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

            {/* Footer */}
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
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-purple-500/20 px-4 py-3 transition-colors duration-200">
      <div className="flex items-center justify-between gap-4">
        {/* Left section - Logo and sidebar toggle */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Sidebar Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-violet-500/10 dark:hover:bg-purple-500/20 transition-colors text-slate-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-purple-400"
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </motion.button>

          {/* Logo */}
          <div className="relative">
            <Sparkles className="w-7 h-7 text-violet-600 dark:text-purple-400" />
            <div className="absolute inset-0 blur-xl bg-violet-500/20 dark:bg-purple-500/30 rounded-full" />
          </div>

          {/* Title */}
          <div className="hidden sm:block">
            <h1 className="text-xl font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              Magentic
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-gray-500">Magnetic Agent Networks</p>
          </div>
        </div>

        {/* Right section - Controls with stable layout */}
        <div className="flex items-center gap-3">
          {/* Toggle Workflow View */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onToggleWorkflow}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 ${
              showWorkflow
                ? 'bg-violet-500/20 dark:bg-purple-500/30 border-violet-500/50 dark:border-purple-500/50'
                : 'bg-slate-100/80 dark:bg-gray-800/50 border-slate-200/50 dark:border-gray-700/50 hover:bg-violet-500/10 dark:hover:bg-purple-500/20 hover:border-violet-500/30 dark:hover:border-purple-500/30'
            }`}
            title={showWorkflow ? 'Hide workflow' : 'Show workflow'}
          >
            <GitBranch className={`w-4 h-4 ${
              showWorkflow 
                ? 'text-violet-600 dark:text-purple-400' 
                : hasActiveExecution 
                  ? 'text-emerald-500 dark:text-emerald-400' 
                  : 'text-slate-400 dark:text-gray-500'
            }`} />
            <span className="text-xs font-medium text-slate-500 dark:text-gray-400 hidden sm:inline">
              Flow
            </span>
            {hasActiveExecution && !showWorkflow && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </motion.button>

          {/* Knowledge Base Button */}
          <KnowledgeBaseButton />

          {/* Toggle Execution Details */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onToggleExecutionDetails}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-gray-800/50 hover:bg-violet-500/10 dark:hover:bg-purple-500/20 border border-slate-200/50 dark:border-gray-700/50 hover:border-violet-500/30 dark:hover:border-purple-500/30 transition-all duration-200"
            title={showExecutionDetails ? 'Hide agent details' : 'Show agent details'}
          >
            {showExecutionDetails ? (
              <Eye className="w-4 h-4 text-violet-600 dark:text-purple-400" />
            ) : (
              <EyeOff className="w-4 h-4 text-slate-400 dark:text-gray-500" />
            )}
            <span className="text-xs font-medium text-slate-500 dark:text-gray-400 hidden sm:inline">
              {showExecutionDetails ? 'Details On' : 'Details Off'}
            </span>
          </motion.button>

          {/* Connection Status */}
          <ConnectionStatus isConnected={isConnected} />

          {/* User Profile Button - circular avatar */}
          <UserButton 
            user={user} 
            isGuest={isGuest} 
            onClick={onShowProfile} 
          />
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
