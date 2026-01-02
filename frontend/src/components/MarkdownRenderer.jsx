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
import { Copy, Check } from 'lucide-react';
import clsx from 'clsx';

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

const MarkdownRenderer = ({ content, className = '' }) => {
  if (!content) return null;
  
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
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
