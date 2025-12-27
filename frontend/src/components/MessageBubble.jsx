/**
 * Enhanced Message component with animations and modern design
 */
import React, { useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  User,
  Bot,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import ExecutionSummary from './ExecutionSummary';

const MessageBubble = forwardRef(function MessageBubble({ message, messageId, toggleStep, expandedSteps, showExecutionDetails, onRegenerate }, ref) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'up' | 'down' | null
  const [showDetails, setShowDetails] = useState(true);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // User message
  if (message.type === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex justify-end gap-3"
      >
        <div className="max-w-2xl">
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 dark:from-purple-600/20 dark:to-pink-600/20 rounded-2xl blur-xl opacity-50" />
            <div className="relative bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-purple-600 dark:to-pink-600 rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg">
              <p className="text-white whitespace-pre-wrap">{message.content}</p>
            </div>
          </motion.div>
          {message.timestamp && (
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-1 text-right flex items-center justify-end gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
            </p>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 dark:from-purple-500 dark:to-pink-500 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
      </motion.div>
    );
  }

  // Error message
  if (message.type === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex gap-3"
      >
        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-red-400" />
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl rounded-tl-sm px-4 py-3 max-w-2xl">
          <p className="text-red-400">{message.content}</p>
        </div>
      </motion.div>
    );
  }

  // Loading/thinking state - assistant is preparing response
  if (message.isLoading) {
    const stageText = message.loadingMessage || 'Analyzing your request...';
    const stageHint = message.loadingStage === 'planning' 
      ? 'Creating execution plan'
      : message.loadingStage === 'executing'
      ? 'Agents are working'
      : 'Coordinator is assembling the right agents';

    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex gap-3"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div className="absolute inset-0 bg-purple-500/30 rounded-full blur-lg animate-pulse" />
        </div>

        <div className="flex-1 max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-gray-200/50 dark:from-gray-800/50 to-purple-200/20 dark:to-purple-900/20 rounded-2xl blur-xl" />
            <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-4 border border-gray-200 dark:border-purple-500/20">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">{stageText}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <Sparkles className="w-3 h-3 text-purple-500 dark:text-purple-400 animate-spin" />
                <span>{stageHint}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // Assistant message
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex gap-3"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="absolute inset-0 bg-purple-500/30 rounded-full blur-lg animate-pulse" />
      </div>

      <div className="flex-1 max-w-4xl space-y-3">
        {/* Execution Summary */}
        {message.execution && showExecutionDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: showDetails ? 1 : 0.5, height: 'auto' }}
            transition={{ duration: 0.2 }}
          >
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 mb-2 transition-colors"
            >
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <Zap className="w-3 h-3 text-yellow-400" />
              {message.execution.plan?.total_agents || 0} agents • {message.execution.plan?.total_layers || 0} layers
            </button>
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <ExecutionSummary
                    execution={message.execution}
                    messageId={messageId}
                    toggleStep={toggleStep}
                    expandedSteps={expandedSteps}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Message Content */}
        <motion.div
          whileHover={{ scale: 1.005 }}
          className="relative group"
        >
          <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm border border-slate-200/80 dark:border-purple-500/20 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm dark:shadow-lg">
            <div className="markdown-content prose prose-slate dark:prose-invert prose-sm max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]} 
                rehypePlugins={[rehypeHighlight]}
                components={{
                  // Enhanced code blocks
                  pre: ({ children }) => (
                    <div className="relative group/code">
                      <pre className="!bg-slate-100 dark:!bg-gray-900/80 !border-slate-200 dark:!border-purple-500/20 overflow-x-auto">
                        {children}
                      </pre>
                      <button
                        onClick={handleCopy}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-200/70 dark:bg-gray-700/50 opacity-0 group-hover/code:opacity-100 transition-opacity"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-500 dark:text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        )}
                      </button>
                    </div>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                copied
                  ? 'bg-green-500/20 text-green-500 dark:text-green-400'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
              title="Copy message"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            
            <button
              onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                feedback === 'up'
                  ? 'bg-green-500/20 text-green-500 dark:text-green-400'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
              title="Good response"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                feedback === 'down'
                  ? 'bg-red-500/20 text-red-500 dark:text-red-400'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
              title="Poor response"
            >
              <ThumbsDown className="w-4 h-4" />
            </button>

            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Regenerate response"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Timestamp */}
        {message.timestamp && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
          </p>
        )}
      </div>
    </motion.div>
  );
});

export default MessageBubble;
