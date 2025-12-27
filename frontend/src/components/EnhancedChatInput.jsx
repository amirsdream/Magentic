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
  Mic,
  StopCircle,
  Loader2,
  Wand2,
  Image,
  FileText,
  Globe,
} from 'lucide-react';
import clsx from 'clsx';

const SUGGESTIONS = [
  { icon: Globe, text: 'Search the web for latest news about AI', color: 'text-blue-400' },
  { icon: FileText, text: 'Analyze and summarize this document', color: 'text-green-400' },
  { icon: Wand2, text: 'Help me write a creative story', color: 'text-purple-400' },
  { icon: Image, text: 'Describe what you see in this image', color: 'text-pink-400' },
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

      {/* Input Container */}
      <motion.div
        animate={{
          borderColor: isFocused ? 'rgba(139, 92, 246, 0.4)' : 'rgba(148, 163, 184, 0.3)',
          boxShadow: isFocused
            ? '0 0 25px rgba(139, 92, 246, 0.1)'
            : '0 0 0 rgba(139, 92, 246, 0)',
        }}
        className="relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-purple-500/20 transition-all duration-200"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 dark:from-purple-500/5 dark:to-pink-500/5 rounded-2xl" />

        <div className="relative flex items-end gap-2 p-3">
          {/* Attachment Button */}
          <button
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Textarea */}
          <div className="flex-1 relative">
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
                'w-full bg-transparent text-gray-900 dark:text-white placeholder-gray-500 resize-none focus:outline-none',
                'text-base leading-6 py-2',
                isExecuting && 'cursor-not-allowed opacity-50'
              )}
              style={{ maxHeight: '144px' }}
            />
          </div>

          {/* Voice Input Button */}
          <button
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="Voice input"
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Send/Stop Button */}
          {isExecuting ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStop}
              className="p-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
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
                'p-2.5 rounded-xl transition-all duration-200',
                canSend
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-slate-200 dark:bg-gray-800 text-slate-400 dark:text-gray-600 cursor-not-allowed'
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

        {/* Character count / Status */}
        <div className="flex items-center justify-between px-4 pb-2 text-xs">
          <div className="flex items-center gap-2">
            {!isConnected && (
              <span className="text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Connecting...
              </span>
            )}
            {isExecuting && (
              <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-pulse" />
                Agents working...
              </span>
            )}
          </div>
          <span className={clsx(
            'transition-colors',
            value.length > 4000 ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-600'
          )}>
            {value.length > 0 && `${value.length} / 4096`}
          </span>
        </div>
      </motion.div>

      {/* Keyboard hint */}
      <p className="text-center text-xs text-gray-500 dark:text-gray-600 mt-2">
        Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">Enter</kbd> to send,{' '}
        <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">Shift + Enter</kbd> for new line
      </p>
    </div>
  );
}

export default EnhancedChatInput;
