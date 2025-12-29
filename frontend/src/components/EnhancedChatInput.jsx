/**
 * Enhanced ChatInput component with modern design
 * Supports both controlled (value/onChange) and uncontrolled (onSend with content) patterns
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Sparkles,
  Paperclip,
  StopCircle,
  Loader2,
  Wand2,
  Code,
  Brain,
  Lightbulb,
} from 'lucide-react';
import clsx from 'clsx';
import { useKnowledgeBaseStore } from '../store';

const SUGGESTIONS = [
  // Complex queries
  { icon: Code, text: 'Build a REST API with authentication and database integration in Python', color: 'text-blue-400' },
  { icon: Brain, text: 'Research and compare different machine learning frameworks for image classification', color: 'text-purple-400' },
  // Simple queries
  { icon: Lightbulb, text: 'Explain how async/await works in JavaScript', color: 'text-green-400' },
  { icon: Wand2, text: 'Write a function to validate email addresses', color: 'text-pink-400' },
];

function EnhancedChatInput({ 
  value: controlledValue, 
  onChange: controlledOnChange, 
  onSend, 
  onStop,
  isConnected = true,
  disabled = false,
  isProcessing = false,
  showSuggestions = true 
}) {
  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [rows, setRows] = useState(1);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // KB Store for file uploads
  const uploadFiles = useKnowledgeBaseStore((state) => state.uploadFiles);

  // Determine if we're in controlled or uncontrolled mode
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const isExecuting = isProcessing || disabled;

  const handleChange = (e) => {
    const newValue = e.target.value;
    if (isControlled && controlledOnChange) {
      controlledOnChange(e);
    } else {
      setInternalValue(newValue);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const newRows = Math.min(Math.max(Math.ceil(scrollHeight / 24), 1), 6);
      setRows(newRows);
      textareaRef.current.style.height = `${Math.min(scrollHeight, 144)}px`;
    }
  }, [value]);

  const handleSend = () => {
    if (!value.trim() || !isConnected || isExecuting) return;
    
    if (onSend) {
      // Pass content to onSend callback
      onSend(value.trim());
    }
    
    // Clear internal state if uncontrolled
    if (!isControlled) {
      setInternalValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (isControlled && controlledOnChange) {
      controlledOnChange({ target: { value: suggestion.text } });
    } else {
      setInternalValue(suggestion.text);
    }
    textareaRef.current?.focus();
  };

  // File upload handler - delegates to global KB store
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadFiles(files);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  const canSend = value.trim() && isConnected && !isExecuting;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      {/* Suggestions */}
      <AnimatePresence>
        {showSuggestions && !value && !isExecuting && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="grid grid-cols-2 gap-2 mb-4"
          >
            {SUGGESTIONS.map((suggestion, idx) => (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSuggestionClick(suggestion)}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/70 dark:bg-gray-800/50 border border-slate-200/80 dark:border-gray-700 hover:border-violet-400/50 dark:hover:border-purple-500/50 hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 text-left group"
              >
                <suggestion.icon className={clsx('w-5 h-5', suggestion.color)} />
                <span className="text-sm text-slate-600 dark:text-gray-400 group-hover:text-slate-800 dark:group-hover:text-gray-200 transition-colors line-clamp-1">
                  {suggestion.text}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Container - UX Best Practice: Clear visual container with adequate padding */}
      <motion.div
        animate={{
          borderColor: isFocused ? 'rgba(139, 92, 246, 0.5)' : 'rgba(148, 163, 184, 0.2)',
          boxShadow: isFocused
            ? '0 0 0 3px rgba(139, 92, 246, 0.1)'
            : '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}
        className="relative bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 transition-all duration-200"
      >
        <div className="flex items-end gap-2 px-4 py-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.pdf,.json,.csv,.py,.js,.ts,.html,.css"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {/* Attachment Button - 44px touch target */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
            title="Upload documents to knowledge base"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Textarea - 16px font size per UX best practices */}
          <div className="flex-1 min-h-[44px] flex items-center">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={isExecuting ? 'Processing...' : 'Message Magentic...'}
              disabled={isExecuting}
              rows={1}
              className={clsx(
                'w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 resize-none focus:outline-none',
                'text-base leading-6 py-2',
                isExecuting && 'cursor-not-allowed opacity-50'
              )}
              style={{ maxHeight: '150px' }}
            />
          </div>

          {/* Send/Stop Button - 44px touch target */}
          {isExecuting ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStop}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors shadow-sm"
              title="Stop execution"
            >
              <StopCircle className="w-5 h-5" />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: canSend ? 1.05 : 1 }}
              whileTap={{ scale: canSend ? 0.95 : 1 }}
              onClick={handleSend}
              disabled={!canSend}
              className={clsx(
                'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200',
                canSend
                  ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-gray-800 text-slate-300 dark:text-gray-600 cursor-not-allowed'
              )}
              title="Send message"
            >
              {!isConnected ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </motion.button>
          )}
        </div>

        {/* Status indicators - shown contextually */}
        {((!isConnected) || isExecuting || value.length > 200) && (
          <div className="flex items-center justify-between px-4 pb-2 text-xs text-slate-500 dark:text-gray-500">
            <div className="flex items-center gap-2">
              {!isConnected && (
                <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Connecting...
                </span>
              )}
              {isExecuting && (
                <span className="text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  Agents working...
                </span>
              )}
            </div>
            {value.length > 200 && (
              <span className={clsx(
                'tabular-nums',
                value.length > 4000 ? 'text-red-500' : ''
              )}>
                {value.length} / 4096
              </span>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default EnhancedChatInput;
