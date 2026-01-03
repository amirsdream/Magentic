/**
 * ChatArea - Main chat messages area
 * Shows: User messages → ExecutionView (workflow + response)
 */
import React, { useRef, useEffect, useCallback, useState, memo, useMemo } from 'react';
import EmptyState from './EmptyState';
import MessageBubble from './MessageBubble';
import ExecutionView from './ExecutionView';

const ChatArea = memo(function ChatArea({
  messages,
  currentExecution,
  onRetry,
  onPreviewArtifact,
  showExecutionDetails = true,
}) {
  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const lastScrollTop = useRef(0);
  const lastStreamScroll = useRef(0);

  // Pair user messages with their corresponding assistant responses
  // Returns: [{ user: userMsg, assistant: assistantMsg | null }, ...]
  const messagePairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.type === 'user') {
        // Look for the next assistant message
        const nextMsg = messages[i + 1];
        const assistant = nextMsg?.type === 'assistant' ? nextMsg : null;
        pairs.push({ user: msg, assistant });
        if (assistant) i++; // Skip the assistant message in next iteration
      }
    }
    return pairs;
  }, [messages]);

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (autoScroll && messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
      });
    }
  }, [autoScroll]);

  // Handle scroll - detect if user scrolled up
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (container.scrollTop < lastScrollTop.current - 10) setAutoScroll(false);
    if (nearBottom) setAutoScroll(true);
    lastScrollTop.current = container.scrollTop;
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length, scrollToBottom]);

  // Scroll on streaming (throttled)
  useEffect(() => {
    if (currentExecution?.streamingContent) {
      const now = Date.now();
      if (now - lastStreamScroll.current > 100) {
        lastStreamScroll.current = now;
        scrollToBottom('auto');
      }
    }
  }, [currentExecution?.streamingContent, scrollToBottom]);

  // Scroll when execution starts
  useEffect(() => {
    if (currentExecution) scrollToBottom('smooth');
  }, [currentExecution?.stage, scrollToBottom]);

  // Check if we have current execution that's not yet in message pairs
  const lastPairHasNoAssistant = messagePairs.length > 0 && !messagePairs[messagePairs.length - 1].assistant;
  const showCurrentExecution = currentExecution && (lastPairHasNoAssistant || messagePairs.length === 0);

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-hide"
    >
      {messages.length === 0 && !currentExecution && <EmptyState />}

      {/* Render user messages paired with their assistant execution */}
      {messagePairs.map(({ user, assistant }, index) => (
        <React.Fragment key={user.id || `pair-${index}`}>
          <MessageBubble message={user} />
          
          {/* Show execution from assistant message (historical) */}
          {assistant && (
            <ExecutionView
              execution={assistant.execution ? {
                ...assistant.execution,
                // Ensure output is set from message content if not in execution
                output: assistant.execution.output || assistant.content,
                artifacts: assistant.execution.artifacts || assistant.artifacts || [],
                references: assistant.execution.references || assistant.references || [],
                stage: assistant.execution.stage || 'complete',
              } : {
                // Fallback for messages without execution data
                stage: 'complete',
                output: assistant.content,
                artifacts: assistant.artifacts || [],
                references: assistant.references || [],
              }}
              variant="auto"
              showAvatar={true}
              onRetry={onRetry}
              onPreviewArtifact={onPreviewArtifact}
              showDetails={showExecutionDetails}
            />
          )}
        </React.Fragment>
      ))}

      {/* Current execution (active streaming/running) */}
      {showCurrentExecution && (
        <ExecutionView
          execution={currentExecution}
          variant="auto"
          showAvatar={true}
          onRetry={onRetry}
          onPreviewArtifact={onPreviewArtifact}
          showDetails={showExecutionDetails}
        />
      )}

      <div ref={messagesEndRef} className="h-1" />
    </div>
  );
});

export default ChatArea;
