/**
 * Enhanced Message component with animations and modern design
 */
import React, { useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MarkdownRenderer from './MarkdownRenderer';
import {
  User,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Sparkles,
  Clock,
  FileText,
  Globe,
  ExternalLink,
  Download,
  FileCode,
  File,
  Eye,
  Bot,
} from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import ExecutionView from './ExecutionView';

// File icon based on language/type
const getFileIcon = (language) => {
  if (['python', 'javascript', 'typescript', 'html', 'css', 'sql', 'bash'].includes(language)) {
    return FileCode;
  }
  return File;
};

// Language badge colors
const getLanguageBadgeColor = (language) => {
  const colors = {
    python: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    javascript: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    typescript: 'bg-blue-400/10 text-blue-500 dark:text-blue-300',
    html: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    css: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    sql: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    json: 'bg-green-500/10 text-green-600 dark:text-green-400',
  };
  return colors[language] || 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
};

// Artifacts section - shows created files as clickable cards with compact design
const Artifacts = ({ artifacts, onPreview }) => {
  if (!artifacts || artifacts.length === 0) return null;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-3 pt-3 border-t border-slate-200/50 dark:border-gray-700/30"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <FileCode className="w-3 h-3 text-slate-400 dark:text-gray-500" />
        <span className="text-xs text-slate-500 dark:text-gray-400">
          Files
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400">
          {artifacts.length}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {artifacts.map((artifact, idx) => {
          const FileIcon = getFileIcon(artifact.language);
          const langColors = {
            python: 'text-blue-500',
            javascript: 'text-yellow-500',
            typescript: 'text-blue-400',
            html: 'text-orange-500',
            css: 'text-pink-500',
            json: 'text-green-500',
            sql: 'text-cyan-500',
            markdown: 'text-slate-500',
            bash: 'text-green-600',
            yaml: 'text-red-400',
          };
          const iconColor = langColors[artifact.language?.toLowerCase()] || 'text-violet-500';
          
          return (
            <motion.button
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * idx }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPreview(artifact)}
              className={clsx(
                'group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left',
                'bg-slate-50 dark:bg-gray-800/50',
                'border border-slate-200/60 dark:border-gray-700/40',
                'hover:border-slate-300 dark:hover:border-gray-600',
                'hover:bg-slate-100 dark:hover:bg-gray-800',
                'transition-all duration-200'
              )}
            >
              <FileIcon className={clsx('w-3.5 h-3.5', iconColor)} />
              
              <span className="text-xs text-slate-600 dark:text-gray-300 truncate max-w-[120px]">
                {artifact.name}
              </span>
              
              <Eye className="w-3 h-3 text-slate-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

// Single citation badge with popover
const CitationBadge = ({ index, reference }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isWeb = reference.type === 'web';
  
  return (
    <span className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'inline-flex items-center justify-center w-4 h-4 text-[10px] font-semibold rounded',
          'transition-all duration-150 hover:scale-110',
          isWeb 
            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50'
            : 'bg-violet-100 dark:bg-purple-900/50 text-violet-600 dark:text-purple-400 hover:bg-violet-200 dark:hover:bg-purple-800/50'
        )}
      >
        {index}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop to close */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            
            {/* Popover */}
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              className={clsx(
                'absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg shadow-xl',
                'bg-white dark:bg-gray-800 border',
                isWeb 
                  ? 'border-blue-200 dark:border-blue-700'
                  : 'border-violet-200 dark:border-purple-700'
              )}
            >
              {/* Arrow */}
              <div className={clsx(
                'absolute top-full left-1/2 -translate-x-1/2 w-0 h-0',
                'border-l-[6px] border-r-[6px] border-t-[6px] border-transparent',
                isWeb ? 'border-t-blue-200 dark:border-t-blue-700' : 'border-t-violet-200 dark:border-t-purple-700'
              )} />
              
              <div className="flex items-start gap-2">
                {isWeb ? (
                  <Globe className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <FileText className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  {isWeb && reference.url ? (
                    <a
                      href={reference.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <span className="truncate">{reference.title || new URL(reference.url).hostname}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  ) : (
                    <span className="text-xs font-medium text-violet-600 dark:text-purple-400">
                      {reference.title || reference.source}
                    </span>
                  )}
                  
                  {reference.snippet && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-3">
                      {reference.snippet}
                    </p>
                  )}
                  
                  {reference.relevance && (
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-purple-900 text-violet-600 dark:text-purple-300">
                      {Math.round(reference.relevance * 100)}% match
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  );
};

// Custom markdown renderer that handles inline citations [1], [2], etc.
const MarkdownWithCitations = ({ content, references }) => {
  // If no references, render with enhanced markdown
  if (!references || references.length === 0) {
    return <MarkdownRenderer content={content} />;
  }

  // Split content by citation markers [1], [2], etc.
  const citationRegex = /\[(\d+)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  
  // Create a copy to iterate
  const contentStr = String(content);
  
  while ((match = citationRegex.exec(contentStr)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: contentStr.slice(lastIndex, match.index)
      });
    }
    
    // Add citation
    const citationNum = parseInt(match[1], 10);
    const ref = references[citationNum - 1];
    if (ref) {
      parts.push({
        type: 'citation',
        index: citationNum,
        reference: ref
      });
    } else {
      // Keep original if no matching reference
      parts.push({
        type: 'text',
        content: match[0]
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < contentStr.length) {
    parts.push({
      type: 'text',
      content: contentStr.slice(lastIndex)
    });
  }

  // Render parts
  return (
    <>
      {parts.map((part, idx) => {
        if (part.type === 'citation') {
          return <CitationBadge key={`cite-${idx}`} index={part.index} reference={part.reference} />;
        }
        // Render markdown for text parts using enhanced renderer
        return <MarkdownRenderer key={`text-${idx}`} content={part.content} />;
      })}
    </>
  );
};

const MessageBubble = forwardRef(function MessageBubble({ message, messageId, toggleStep, expandedSteps, showExecutionDetails, onRegenerate, onRetry, isLatestMessage, hasActiveExecution, onPreviewArtifact }, ref) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'up' | 'down' | null

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // User message
  if (message.type === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.9, x: 20 }}
        animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
        transition={{ 
          type: 'spring', 
          stiffness: 300, 
          damping: 22,
          mass: 0.7
        }}
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
        initial={{ opacity: 0, y: 20, scale: 0.9, x: -10 }}
        animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
        transition={{ 
          type: 'spring', 
          stiffness: 400, 
          damping: 15
        }}
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
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ 
          type: 'spring', 
          stiffness: 300, 
          damping: 25
        }}
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

  // Streaming message - shows content as it comes in with typing cursor
  if (message.isStreaming || (message.content && message.id?.startsWith('streaming'))) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
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
          <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm border border-slate-200/80 dark:border-purple-500/20 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm dark:shadow-lg">
            <div className="markdown-content prose prose-slate dark:prose-invert prose-sm max-w-none">
              {message.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {message.content}
                </ReactMarkdown>
              ) : (
                <span className="text-gray-400">Generating response...</span>
              )}
              {/* Typing cursor */}
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 bg-violet-500 dark:bg-purple-400 animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Assistant message
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9, rotateX: -10 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
      transition={{ 
        type: 'spring', 
        stiffness: 260, 
        damping: 20,
        mass: 0.8
      }}
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
        {/* Execution View - Skip for latest message when execution still active (avoid duplication) */}
        {message.execution && showExecutionDetails && !(isLatestMessage && hasActiveExecution) && (
          <ExecutionView
            execution={message.execution}
            variant="compact"
            defaultExpanded={true}
            showAvatar={false}
            messageId={messageId}
            onRetry={onRetry}
          />
        )}

        {/* Message Content */}
        <motion.div
          whileHover={{ scale: 1.005 }}
          className="relative group"
        >
          <div className="bg-white/70 dark:bg-gray-800/60 backdrop-blur-sm border border-slate-200/80 dark:border-purple-500/20 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm dark:shadow-lg">
            <MarkdownWithCitations 
              content={message.content}
              references={message.references}
            />
            
            {/* Artifacts - created files */}
            <Artifacts artifacts={message.artifacts} onPreview={onPreviewArtifact} />
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
