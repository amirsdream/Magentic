/**
 * Message component - displays chat messages
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import ExecutionSummary from './ExecutionSummary';

function Message({ message, messageId, toggleStep, expandedSteps, showExecutionDetails }) {
  // User message
  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg px-4 py-3 max-w-2xl">
          <p className="text-white">{message.content}</p>
        </div>
      </div>
    );
  }

  // Error message
  if (message.type === 'error') {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
        <p className="text-red-400">{message.content}</p>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex flex-col gap-2">
      {/* Execution summary above the message */}
      {message.execution && showExecutionDetails && (
        <ExecutionSummary
          execution={message.execution}
          messageId={messageId}
          toggleStep={toggleStep}
          expandedSteps={expandedSteps}
        />
      )}

      {/* Response content */}
      <div className="bg-gray-800/50 border border-purple-500/20 rounded-lg px-4 py-3 max-w-4xl">
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export default Message;
