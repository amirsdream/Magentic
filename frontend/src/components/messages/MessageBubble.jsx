/**
 * MessageBubble - User message component
 * Assistant responses are shown in ExecutionView, not here
 */
import React, { memo } from 'react';
import { Clock, Bot } from 'lucide-react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import UserAvatar from './UserAvatar';

// Timestamp
const Timestamp = memo(({ time, align = 'left' }) => {
  if (!time) return null;
  return (
    <p className={clsx('text-xs text-gray-500 mt-1 flex items-center gap-1', align === 'right' && 'justify-end')}>
      <Clock className="w-3 h-3" />
      {formatDistanceToNow(new Date(time), { addSuffix: true })}
    </p>
  );
});

// User message
const UserMessage = memo(({ message }) => (
  <div className="flex gap-3 justify-end">
    <div className="max-w-2xl">
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-purple-600 dark:to-pink-600 rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg">
        <p className="text-white whitespace-pre-wrap">{message.content}</p>
      </div>
      <Timestamp time={message.timestamp} align="right" />
    </div>
    <UserAvatar />
  </div>
));

// Error message
const ErrorMessage = memo(({ message }) => (
  <div className="flex gap-3">
    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
      <Bot className="w-4 h-4 text-red-400" />
    </div>
    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl rounded-tl-sm px-4 py-3 max-w-2xl">
      <p className="text-red-400">{message.content}</p>
    </div>
  </div>
));

// Main component - only handles user and error messages
const MessageBubble = memo(function MessageBubble({ message }) {
  if (message.type === 'user') return <UserMessage message={message} />;
  if (message.type === 'error') return <ErrorMessage message={message} />;
  return null; // Assistant messages shown in ExecutionView
});

export default MessageBubble;
