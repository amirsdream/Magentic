/**
 * Sidebar component - conversation history and navigation
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquarePlus,
  MessageSquare,
  Trash2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Moon,
  Sun,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { useChatStore, useUIStore } from '../store';
import { useAuth } from '../contexts/AuthContext';

function Sidebar({ onOpenSettings }) {
  const { user } = useAuth();
  const { conversations, activeConversationId, setActiveConversation, deleteConversation, createConversation } = useChatStore();
  const { sidebarOpen, toggleSidebar, theme, setTheme } = useUIStore();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [hoveredId, setHoveredId] = React.useState(null);
  
  const username = user?.username || 'guest';

  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group conversations by date
  const groupedConversations = React.useMemo(() => {
    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    filteredConversations.forEach((conv) => {
      const convDate = new Date(conv.updatedAt);
      if (convDate >= today) {
        groups.today.push(conv);
      } else if (convDate >= yesterday) {
        groups.yesterday.push(conv);
      } else if (convDate >= weekAgo) {
        groups.thisWeek.push(conv);
      } else {
        groups.older.push(conv);
      }
    });

    return groups;
  }, [filteredConversations]);

  const renderConversationGroup = (title, conversations) => {
    if (conversations.length === 0) return null;
    
    return (
      <div className="mb-4">
        <h3 className="px-3 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
          {title}
        </h3>
        <div className="space-y-1">
          {conversations.map((conv) => (
            <motion.button
              key={conv.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onClick={() => setActiveConversation(conv.id)}
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group',
                activeConversationId === conv.id
                  ? 'bg-purple-500/20 text-gray-900 dark:text-white border border-purple-500/30'
                  : 'hover:bg-gray-100/50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm truncate">{conv.title}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                </p>
              </div>
              <AnimatePresence>
                {hoveredId === conv.id && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id, username);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        deleteConversation(conv.id, username);
                      }
                    }}
                    className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="h-full bg-white/90 dark:bg-gray-900/95 backdrop-blur-xl border-r border-slate-200/80 dark:border-purple-500/20 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-200/80 dark:border-purple-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <Sparkles className="w-8 h-8 text-violet-600 dark:text-purple-400" />
                  <div className="absolute inset-0 blur-xl bg-violet-500/20 dark:bg-purple-500/30 rounded-full" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                    Magentic
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-gray-500">v3.0</p>
                </div>
              </div>

              {/* New Chat Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => createConversation(username)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-purple-600 dark:to-pink-600 hover:from-violet-500 hover:to-fuchsia-500 dark:hover:from-purple-500 dark:hover:to-pink-500 text-white font-medium shadow-lg shadow-violet-500/20 dark:shadow-purple-500/25 transition-all duration-200"
              >
                <MessageSquarePlus className="w-5 h-5" />
                New Chat
              </motion.button>
            </div>

            {/* Search */}
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100/70 dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-violet-500/50 dark:focus:border-purple-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hide">
              {renderConversationGroup('Today', groupedConversations.today)}
              {renderConversationGroup('Yesterday', groupedConversations.yesterday)}
              {renderConversationGroup('This Week', groupedConversations.thisWeek)}
              {renderConversationGroup('Older', groupedConversations.older)}

              {filteredConversations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs mt-1">Start a new chat to begin</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-200/80 dark:border-purple-500/20">
              <div className="flex items-center gap-2">
                {/* Theme Toggle */}
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-100/70 dark:bg-gray-800/50 hover:bg-slate-200/70 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-4 h-4" />
                      <span className="text-xs">Light Mode</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4" />
                      <span className="text-xs">Dark Mode</span>
                    </>
                  )}
                </button>

                {/* Settings */}
                <button
                  onClick={onOpenSettings}
                  className="flex items-center justify-center p-2 rounded-lg bg-slate-100/70 dark:bg-gray-800/50 hover:bg-slate-200/70 dark:hover:bg-gray-800 text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        initial={false}
        animate={{ left: sidebarOpen ? 268 : 0 }}
        onClick={toggleSidebar}
        className="absolute top-20 z-50 p-1.5 rounded-r-lg bg-white dark:bg-gray-800 border border-l-0 border-slate-200/80 dark:border-purple-500/20 text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-white transition-colors"
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </motion.button>
    </>
  );
}

export default Sidebar;
