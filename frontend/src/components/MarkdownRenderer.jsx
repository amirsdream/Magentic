/**
 * Markdown Renderer using react-markdown with GFM and syntax highlighting
 * Simple wrapper around existing libraries
 */
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Import common languages
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { Copy, Check, Globe, BookOpen, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

// Register languages
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('jsx', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('tsx', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('yml', yaml);

// Code block with syntax highlighting and copy button
const CodeBlock = ({ language, value }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 not-prose">
      <div className="absolute top-2 right-2 flex items-center gap-2 text-xs text-slate-400 z-10">
        {language && <span className="uppercase font-medium bg-slate-800/80 px-2 py-0.5 rounded">{language}</span>}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 transition-colors"
          type="button"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        customStyle={{
          margin: 0,
          padding: '2.5rem 1rem 1rem 1rem',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          background: '#282c34',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          }
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

// Inline code component
const InlineCode = ({ children, ...props }) => {
  return (
    <code 
      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-800 text-violet-600 dark:text-purple-400 text-sm font-mono"
      {...props}
    >
      {children}
    </code>
  );
};

// Citation tooltip component for inline references
const CitationTooltip = ({ index, reference }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isWeb = reference?.type === 'web' || reference?.url;
  const Icon = isWeb ? Globe : BookOpen;
  
  const handleClick = (e) => {
    e.preventDefault();
    if (reference?.url) {
      window.open(reference.url, '_blank', 'noopener,noreferrer');
    }
  };
  
  if (!reference) {
    return <sup className="text-xs text-slate-400">[{index}]</sup>;
  }
  
  return (
    <span className="relative inline-block">
      <sup
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-semibold rounded cursor-pointer transition-all duration-200 ${
          isWeb 
            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/30' 
            : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30'
        }`}
      >
        {index}
      </sup>
      
      {/* Tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-slate-200 dark:border-gray-700"
            style={{ pointerEvents: 'none' }}
          >
            {/* Arrow */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white dark:bg-gray-800 border-r border-b border-slate-200 dark:border-gray-700" />
            
            <div className="relative">
              <div className="flex items-start gap-2">
                <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isWeb ? 'text-blue-500' : 'text-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-gray-200 line-clamp-2">
                    {reference.title || reference.source || 'Unknown source'}
                  </p>
                  {reference.snippet && (
                    <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {reference.snippet}
                    </p>
                  )}
                  {reference.url && (
                    <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-1 truncate flex items-center gap-1">
                      <ExternalLink className="w-2.5 h-2.5" />
                      {(() => { try { return new URL(reference.url).hostname; } catch { return reference.url; } })()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};

// Process text to convert citation markers [1], [2] to interactive tooltips
const processTextWithCitations = (text, references) => {
  if (!text || !references?.length) return text;
  
  // Match [1], [2], etc. - citation markers
  const parts = text.split(/(\[\d+\])/g);
  
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const index = parseInt(match[1], 10);
      const reference = references[index - 1]; // 1-indexed to 0-indexed
      return <CitationTooltip key={i} index={index} reference={reference} />;
    }
    return part;
  });
};

const MarkdownRenderer = ({ content, className = '', references = [] }) => {
  if (!content) return null;
  
  // Custom text renderer that processes citations
  const TextWithCitations = ({ children }) => {
    if (typeof children === 'string') {
      return <>{processTextWithCitations(children, references)}</>;
    }
    if (Array.isArray(children)) {
      return <>{children.map((child, i) => {
        if (typeof child === 'string') {
          return <React.Fragment key={i}>{processTextWithCitations(child, references)}</React.Fragment>;
        }
        return child;
      })}</>;
    }
    return children;
  };
  
  return (
    <div className={clsx(
      'prose prose-slate dark:prose-invert prose-sm max-w-none',
      'prose-headings:font-semibold',
      'prose-a:text-violet-600 dark:prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline',
      'prose-blockquote:border-violet-500 dark:prose-blockquote:border-purple-500 prose-blockquote:bg-violet-50/50 dark:prose-blockquote:bg-purple-900/20 prose-blockquote:rounded-r-lg prose-blockquote:py-1',
      'prose-table:border prose-table:border-slate-200 dark:prose-table:border-gray-700',
      'prose-th:bg-slate-50 dark:prose-th:bg-gray-800 prose-th:px-3 prose-th:py-2',
      'prose-td:px-3 prose-td:py-2 prose-td:border-t prose-td:border-slate-200 dark:prose-td:border-gray-700',
      className
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const codeString = String(children).replace(/\n$/, '');
            
            // Block code (fenced with ```)
            if (!inline && match) {
              return <CodeBlock language={language} value={codeString} />;
            }
            
            // Block code without language specified
            if (!inline && codeString.includes('\n')) {
              return <CodeBlock language="" value={codeString} />;
            }
            
            // Inline code
            return <InlineCode {...props}>{children}</InlineCode>;
          },
          // Override pre to prevent double wrapping
          pre({ children }) {
            return <>{children}</>;
          },
          // Process citations in text elements
          p({ children }) {
            return <p><TextWithCitations>{children}</TextWithCitations></p>;
          },
          li({ children }) {
            return <li><TextWithCitations>{children}</TextWithCitations></li>;
          },
          td({ children }) {
            return <td><TextWithCitations>{children}</TextWithCitations></td>;
          },
          strong({ children }) {
            return <strong><TextWithCitations>{children}</TextWithCitations></strong>;
          },
          em({ children }) {
            return <em><TextWithCitations>{children}</TextWithCitations></em>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
