/**
 * Settings Panel - Configuration and preferences
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog } from '@headlessui/react';
import {
  X,
  Moon,
  Sun,
  Monitor,
  Eye,
  EyeOff,
  Zap,
  Layout,
  Bell,
  Shield,
  Trash2,
  Download,
  Upload,
  Github,
  ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';
import { useUIStore, useChatStore } from '../store';

function SettingsPanel({ isOpen, onClose }) {
  const { 
    theme, 
    setTheme, 
    showExecutionDetails, 
    toggleExecutionDetails,
    compactMode,
    toggleCompactMode 
  } = useUIStore();
  const { conversations, clearAll } = useChatStore();

  const handleExportData = () => {
    const data = {
      conversations,
      exportedAt: new Date().toISOString(),
      version: '3.0.0',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `magentic-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to delete all conversations? This cannot be undone.')) {
      clearAll();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          static
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          open={isOpen}
          onClose={onClose}
          className="relative z-50"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel
              as={motion.div}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-purple-500/30 shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-purple-500/20">
                <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                  Settings
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Appearance */}
                <section>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Appearance
                  </h3>
                  
                  {/* Theme */}
                  <div className="space-y-3">
                    <label className="text-sm text-gray-900 dark:text-white">Theme</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTheme('dark')}
                        className={clsx(
                          'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors',
                          theme === 'dark'
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-600 dark:text-purple-400'
                            : 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-purple-500/30'
                        )}
                      >
                        <Moon className="w-4 h-4" />
                        <span className="text-sm">Dark</span>
                      </button>
                      <button
                        onClick={() => setTheme('light')}
                        className={clsx(
                          'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors',
                          theme === 'light'
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-600 dark:text-purple-400'
                            : 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-purple-500/30'
                        )}
                      >
                        <Sun className="w-4 h-4" />
                        <span className="text-sm">Light</span>
                      </button>
                    </div>
                  </div>
                </section>

                {/* Display */}
                <section>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Display
                  </h3>
                  
                  <div className="space-y-3">
                    {/* Show Execution Details */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                          {showExecutionDetails ? (
                            <Eye className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-gray-900 dark:text-white">Show Agent Details</p>
                          <p className="text-xs text-gray-500">Display agent execution steps in chat</p>
                        </div>
                      </div>
                      <button
                        onClick={toggleExecutionDetails}
                        className={clsx(
                          'w-12 h-6 rounded-full transition-colors relative',
                          showExecutionDetails ? 'bg-purple-500' : 'bg-gray-400 dark:bg-gray-600'
                        )}
                      >
                        <motion.div
                          animate={{ x: showExecutionDetails ? 24 : 2 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                        />
                      </button>
                    </div>

                    {/* Compact Mode */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-500/20">
                          <Layout className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-900 dark:text-white">Compact Mode</p>
                          <p className="text-xs text-gray-500">Reduce spacing and padding</p>
                        </div>
                      </div>
                      <button
                        onClick={toggleCompactMode}
                        className={clsx(
                          'w-12 h-6 rounded-full transition-colors relative',
                          compactMode ? 'bg-purple-500' : 'bg-gray-400 dark:bg-gray-600'
                        )}
                      >
                        <motion.div
                          animate={{ x: compactMode ? 24 : 2 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                        />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Data */}
                <section>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Data & Privacy
                  </h3>
                  
                  <div className="space-y-3">
                    {/* Export */}
                    <button
                      onClick={handleExportData}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-100/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors text-left"
                    >
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Download className="w-4 h-4 text-green-500 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">Export Conversations</p>
                        <p className="text-xs text-gray-500">{conversations.length} conversations</p>
                      </div>
                    </button>

                    {/* Clear Data */}
                    <button
                      onClick={handleClearData}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors text-left"
                    >
                      <div className="p-2 rounded-lg bg-red-500/20">
                        <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm text-red-600 dark:text-red-400">Clear All Data</p>
                        <p className="text-xs text-gray-500">Delete all conversations and reset</p>
                      </div>
                    </button>
                  </div>
                </section>

                {/* About */}
                <section>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    About
                  </h3>
                  
                  <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <Zap className="w-6 h-6 text-purple-500 dark:text-purple-400" />
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">Magentic</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Version 3.0.0</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Magnetic Agent Networks - Dynamic multi-agent system with LangGraph infrastructure.
                    </p>
                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300"
                    >
                      <Github className="w-4 h-4" />
                      View on GitHub
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-purple-500/20 bg-gray-50 dark:bg-gray-900/50">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-600 dark:text-purple-400 font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}

export default SettingsPanel;
