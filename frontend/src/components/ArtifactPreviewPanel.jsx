/**
 * Claude-style artifact preview panel
 * Shows code preview on the right side with download capability
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  Copy,
  Check,
  FileCode,
  File,
  Code2,
  Eye,
  Loader2,
  Sparkles,
  FileText,
  Database,
  Terminal,
  Braces,
  FileJson,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';

// Language display names and syntax highlighting mappings
const LANGUAGE_CONFIG = {
  python: { name: 'Python', icon: FileCode, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10', text: 'text-blue-500' },
  javascript: { name: 'JavaScript', icon: FileCode, color: 'from-yellow-500 to-orange-500', bg: 'bg-yellow-500/10', text: 'text-yellow-500' },
  typescript: { name: 'TypeScript', icon: FileCode, color: 'from-blue-400 to-indigo-500', bg: 'bg-blue-400/10', text: 'text-blue-400' },
  html: { name: 'HTML', icon: Code2, color: 'from-orange-500 to-red-500', bg: 'bg-orange-500/10', text: 'text-orange-500' },
  css: { name: 'CSS', icon: Code2, color: 'from-pink-500 to-purple-500', bg: 'bg-pink-500/10', text: 'text-pink-500' },
  json: { name: 'JSON', icon: FileJson, color: 'from-green-500 to-emerald-500', bg: 'bg-green-500/10', text: 'text-green-500' },
  sql: { name: 'SQL', icon: Database, color: 'from-cyan-500 to-blue-500', bg: 'bg-cyan-500/10', text: 'text-cyan-500' },
  markdown: { name: 'Markdown', icon: FileText, color: 'from-gray-500 to-slate-500', bg: 'bg-gray-500/10', text: 'text-gray-500' },
  bash: { name: 'Bash', icon: Terminal, color: 'from-green-600 to-lime-500', bg: 'bg-green-600/10', text: 'text-green-600' },
  shell: { name: 'Shell', icon: Terminal, color: 'from-green-600 to-lime-500', bg: 'bg-green-600/10', text: 'text-green-600' },
  yaml: { name: 'YAML', icon: Braces, color: 'from-red-400 to-rose-500', bg: 'bg-red-400/10', text: 'text-red-400' },
  text: { name: 'Text', icon: File, color: 'from-gray-400 to-slate-400', bg: 'bg-gray-400/10', text: 'text-gray-400' },
  jsx: { name: 'JSX', icon: FileCode, color: 'from-cyan-400 to-blue-500', bg: 'bg-cyan-400/10', text: 'text-cyan-400' },
  tsx: { name: 'TSX', icon: FileCode, color: 'from-blue-400 to-indigo-500', bg: 'bg-blue-400/10', text: 'text-blue-400' },
};

const getLanguageConfig = (language) => {
  const lang = language?.toLowerCase() || 'text';
  return LANGUAGE_CONFIG[lang] || LANGUAGE_CONFIG.text;
};

// Code display with line numbers
const CodeWithLineNumbers = ({ content, language }) => {
  const lines = useMemo(() => content?.split('\n') || [], [content]);
  const lineNumberWidth = useMemo(() => Math.max(String(lines.length).length * 10 + 16, 40), [lines.length]);
  
  return (
    <div className="flex h-full overflow-auto font-mono text-[13px]">
      {/* Line numbers */}
      <div 
        className="flex-shrink-0 text-right pr-4 py-4 select-none border-r border-slate-200/50 dark:border-gray-700/50 bg-slate-100/30 dark:bg-gray-900/30 sticky left-0"
        style={{ minWidth: lineNumberWidth }}
      >
        {lines.map((_, idx) => (
          <div 
            key={idx} 
            className="text-slate-400 dark:text-gray-600 leading-6 text-xs px-2"
          >
            {idx + 1}
          </div>
        ))}
      </div>
      
      {/* Code content */}
      <div className="flex-1 overflow-x-auto">
        <pre className="py-4 pl-4 pr-6 leading-6 text-slate-800 dark:text-gray-200">
          {lines.map((line, idx) => (
            <div 
              key={idx} 
              className="hover:bg-violet-500/5 dark:hover:bg-purple-500/5 -ml-4 pl-4 pr-4 -mr-6 transition-colors"
            >
              {line || '\u00A0'}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
};

const ArtifactPreviewPanel = ({ artifact, onClose, isOpen }) => {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState('code'); // 'code' or 'preview' (for html)
  
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  
  // Fetch artifact content when opened
  useEffect(() => {
    if (isOpen && artifact?.path) {
      setLoading(true);
      setError(null);
      setContent(null);
      
      fetch(`${API_BASE}/artifacts/${encodeURIComponent(artifact.path)}`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to load: ${res.statusText}`);
          return res.text();
        })
        .then(text => {
          setContent(text);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to load artifact:', err);
          setError(err.message);
          setLoading(false);
        });
    }
  }, [isOpen, artifact?.path, API_BASE]);
  
  const handleCopy = async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleDownload = () => {
    if (!content || !artifact) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };
  
  const langConfig = artifact ? getLanguageConfig(artifact.language) : LANGUAGE_CONFIG.text;
  const LangIcon = langConfig.icon;
  const canPreview = artifact?.language === 'html';
  const lineCount = content ? content.split('\n').length : 0;
  const charCount = content ? content.length : 0;
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: '100%', opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className={clsx(
              'fixed right-0 top-0 h-full w-[700px] max-w-[95vw] z-50',
              'bg-gradient-to-b from-white via-white to-slate-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950',
              'shadow-2xl shadow-black/20 dark:shadow-black/50',
              'flex flex-col',
              'overflow-hidden rounded-l-2xl'
            )}
          >
            {/* Decorative gradient bar */}
            <div className={clsx(
              'h-1.5 w-full bg-gradient-to-r',
              langConfig.color
            )} />
            
            {/* Header */}
            <div className="relative px-6 py-5 border-b border-slate-200/80 dark:border-gray-800/80">
              <div className="flex items-center gap-4">
                {/* File icon with gradient background */}
                <motion.div 
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}
                  className={clsx(
                    'relative p-3.5 rounded-2xl',
                    'bg-gradient-to-br shadow-lg',
                    langConfig.color
                  )}
                >
                  <LangIcon className="w-7 h-7 text-white" />
                  <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-white/80" />
                </motion.div>
                
                <div className="flex-1 min-w-0">
                  <motion.h3 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="font-bold text-xl text-slate-800 dark:text-white truncate"
                  >
                    {artifact?.name || 'Artifact'}
                  </motion.h3>
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-3 mt-1.5"
                  >
                    <span className={clsx(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                      langConfig.bg,
                      langConfig.text
                    )}>
                      <LangIcon className="w-3 h-3" />
                      {langConfig.name}
                    </span>
                    {content && (
                      <span className="text-xs text-slate-400 dark:text-gray-500">
                        {lineCount} lines • {charCount.toLocaleString()} chars
                      </span>
                    )}
                  </motion.div>
                </div>
                
                {/* Close button */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-500 transition-all"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
              
              {/* Path display */}
              {artifact?.path && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="mt-3 px-3 py-2 bg-slate-50 dark:bg-gray-800/50 rounded-lg"
                >
                  <code className="text-xs text-slate-500 dark:text-gray-400 font-mono break-all">
                    {artifact.path}
                  </code>
                </motion.div>
              )}
            </div>
            
            {/* View toggle for HTML files */}
            {canPreview && (
              <div className="flex items-center gap-1.5 px-6 py-3 border-b border-slate-200/80 dark:border-gray-800/80 bg-slate-50/50 dark:bg-gray-850/50">
                <button
                  onClick={() => setView('code')}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    view === 'code'
                      ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-md'
                      : 'text-slate-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50'
                  )}
                >
                  <Code2 className="w-4 h-4" />
                  Code
                </button>
                <button
                  onClick={() => setView('preview')}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    view === 'preview'
                      ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-md'
                      : 'text-slate-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50'
                  )}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
              </div>
            )}
            
            {/* Content */}
            <div className="flex-1 overflow-hidden bg-slate-50/50 dark:bg-gray-950/50">
              {loading && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="w-8 h-8 text-violet-500 dark:text-purple-400" />
                  </motion.div>
                  <span className="text-sm text-slate-500 dark:text-gray-400">Loading content...</span>
                </div>
              )}
              
              {error && (
                <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
                  <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/30">
                    <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-red-600 dark:text-red-400 mb-1">Failed to load file</div>
                    <div className="text-sm text-slate-500 dark:text-gray-500 max-w-sm">{error}</div>
                  </div>
                </div>
              )}
              
              {content && !loading && view === 'code' && (
                <CodeWithLineNumbers content={content} language={artifact?.language} />
              )}
              
              {content && !loading && view === 'preview' && canPreview && (
                <iframe
                  srcDoc={content}
                  className="w-full h-full bg-white rounded-lg m-4"
                  style={{ height: 'calc(100% - 32px)', width: 'calc(100% - 32px)' }}
                  sandbox="allow-scripts"
                  title="HTML Preview"
                />
              )}
            </div>
            
            {/* Footer Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200/80 dark:border-gray-800/80 bg-white dark:bg-gray-900">
              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-gray-500">
                {content && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      {lineCount} lines
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-gray-600" />
                    <span>{charCount.toLocaleString()} characters</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCopy}
                  disabled={!content}
                  className={clsx(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
                    'border-2',
                    copied
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700'
                      : 'bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-purple-600',
                    !content && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Code
                    </>
                  )}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDownload}
                  disabled={!content}
                  className={clsx(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                    'bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-purple-600 dark:to-pink-600',
                    'text-white shadow-lg shadow-violet-500/25 dark:shadow-purple-500/25',
                    'hover:shadow-xl hover:shadow-violet-500/30 dark:hover:shadow-purple-500/30',
                    !content && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Download className="w-4 h-4" />
                  Download
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ArtifactPreviewPanel;
