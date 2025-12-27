/**
 * Header component - app header with user info and controls
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Eye, EyeOff, Menu, PanelLeftClose } from 'lucide-react';

function Header({
  user,
  isGuest,
  isConnected,
  showExecutionDetails,
  onToggleExecutionDetails,
  onShowProfile,
  onToggleSidebar,
  sidebarOpen,
}) {
  return (
    <header className="bg-white/70 dark:bg-gray-900/80 backdrop-blur-lg border-b border-slate-200/80 dark:border-purple-500/20 px-4 py-3 transition-colors duration-200">
      <div className="flex items-center gap-3">
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
        <div>
          <h1 className="text-xl font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
            Magentic
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-gray-500">Magnetic Agent Networks</p>
        </div>

        {/* Controls */}
        <div className="ml-auto flex items-center gap-2">
          {/* Profile Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onShowProfile}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 dark:bg-purple-500/10 hover:bg-violet-500/20 dark:hover:bg-purple-500/20 border border-violet-500/20 dark:border-purple-500/30 transition-colors"
            title="Profile"
          >
            <span className="text-lg">{user?.avatar_emoji || '👤'}</span>
            <div className="flex flex-col items-start">
              <span className="text-xs text-slate-600 dark:text-gray-300">
                {user?.display_name || user?.username}
              </span>
              {isGuest && <span className="text-xs text-amber-600 dark:text-yellow-400">Guest</span>}
            </div>
          </motion.button>

          {/* Toggle Execution Details */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onToggleExecutionDetails}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 dark:bg-purple-500/10 hover:bg-violet-500/20 dark:hover:bg-purple-500/20 border border-violet-500/20 dark:border-purple-500/30 transition-colors"
            title={showExecutionDetails ? 'Hide agent details' : 'Show agent details'}
          >
            {showExecutionDetails ? (
              <Eye className="w-4 h-4 text-violet-600 dark:text-purple-400" />
            ) : (
              <EyeOff className="w-4 h-4 text-slate-400 dark:text-gray-500" />
            )}
            <span className="text-xs text-slate-500 dark:text-gray-400 hidden sm:inline">Details</span>
          </motion.button>

          {/* Connection Status */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-100/80 dark:bg-gray-800/50">
            <motion.div
              animate={{
                scale: isConnected ? [1, 1.2, 1] : 1,
                opacity: isConnected ? 1 : 0.5,
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-slate-500 dark:text-gray-400 hidden sm:inline">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
