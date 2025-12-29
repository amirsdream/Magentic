/**
 * Claude-style artifact preview panel
 * Shows code preview on the right side with download capability
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  Copy,
  Check,
  FileCode,
  File,
  ExternalLink,
  Code2,
  Eye,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';

// Language display names and syntax highlighting mappings
const LANGUAGE_CONFIG = {
  python: { name: 'Python', icon: FileCode, color: 'text-blue-500' },
  javascript: { name: 'JavaScript', icon: FileCode, color: 'text-yellow-500' },
  typescript: { name: 'TypeScript', icon: FileCode, color: 'text-blue-400' },
  html: { name: 'HTML', icon: Code2, color: 'text-orange-500' },
  css: { name: 'CSS', icon: Code2, color: 'text-pink-500' },
  json: { name: 'JSON', icon: File, color: 'text-green-500' },
  sql: { name: 'SQL', icon: FileCode, color: 'text-cyan-500' },
  markdown: { name: 'Markdown', icon: File, color: 'text-gray-500' },
  bash: { name: 'Bash', icon: FileCode, color: 'text-green-600' },
  yaml: { name: 'YAML', icon: File, color: 'text-red-400' },
  text: { name: 'Text', icon: File, color: 'text-gray-400' },
};

const getLanguageConfig = (language) => {
  return LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.text;
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
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={clsx(
              'fixed right-0 top-0 h-full w-[600px] max-w-[90vw] z-50',
              'bg-white dark:bg-gray-900 shadow-2xl',
              'flex flex-col border-l border-slate-200 dark:border-gray-800'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-gray-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className={clsx('p-2 rounded-lg bg-slate-100 dark:bg-gray-800', langConfig.color)}>
                  <LangIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-800 dark:text-white truncate">
                    {artifact?.name || 'Artifact'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    {langConfig.name} • {artifact?.path}
                  </p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-500 dark:text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* View toggle for HTML files */}
            {canPreview && (
              <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-850">
                <button
                  onClick={() => setView('code')}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    view === 'code'
                      ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800'
                  )}
                >
                  <Code2 className="w-4 h-4" />
                  Code
                </button>
                <button
                  onClick={() => setView('preview')}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    view === 'preview'
                      ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800'
                  )}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
              </div>
            )}
            
            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3 text-slate-500 dark:text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading content...</span>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="flex items-center justify-center h-full p-4">
                  <div className="text-center">
                    <div className="text-red-500 dark:text-red-400 mb-2">Failed to load file</div>
                    <div className="text-sm text-slate-500 dark:text-gray-500">{error}</div>
                  </div>
                </div>
              )}
              
              {content && !loading && view === 'code' && (
                <pre className={clsx(
                  'h-full overflow-auto p-4 text-sm font-mono',
                  'bg-slate-50 dark:bg-gray-950 text-slate-800 dark:text-gray-200',
                  'leading-relaxed'
                )}>
                  <code>{content}</code>
                </pre>
              )}
              
              {content && !loading && view === 'preview' && canPreview && (
                <iframe
                  srcDoc={content}
                  className="w-full h-full bg-white"
                  sandbox="allow-scripts"
                  title="HTML Preview"
                />
              )}
            </div>
            
            {/* Footer Actions */}
            <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-850">
              <div className="text-xs text-slate-500 dark:text-gray-500">
                {content ? `${content.split('\n').length} lines` : ''}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!content}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    'border border-slate-200 dark:border-gray-700',
                    copied
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700'
                      : 'bg-white dark:bg-gray-800 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-750',
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
                      Copy
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleDownload}
                  disabled={!content}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    'bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-purple-600 dark:to-pink-600',
                    'text-white shadow-md hover:shadow-lg hover:scale-[1.02]',
                    !content && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ArtifactPreviewPanel;
