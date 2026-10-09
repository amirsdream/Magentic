/**
 * ChatArea - Main chat messages area
 * Shows: User messages → ExecutionView (workflow + response)
 */
import React, { useRef, useEffect, useCallback, useState, memo, useMemo } from 'react';
import EmptyState from './EmptyState';
import MessageBubble from './MessageBubble';
import ExecutionView from './ExecutionView';

/** Demo execution for `?demo=loop` — showcases Copilot-style agent loop bar */
const DEMO_LOOP_EXECUTION = {
  stage: 'executing',
  stageMessage: 'Agents running',
  plan: {
    description: 'Research and synthesize an answer',
    total_agents: 3,
    total_layers: 3,
    agents: [
      { agent_id: 'coordinator_0', role: 'coordinator', task: 'Plan the approach', layer: 0 },
      { agent_id: 'researcher_1', role: 'researcher', task: 'Gather sources', layer: 1 },
      { agent_id: 'synthesizer_2', role: 'synthesizer', task: 'Write the final answer', layer: 2 },
    ],
  },
  agents: [
    {
      agent_id: 'coordinator_0',
      role: 'coordinator',
      task: 'Plan the approach',
      layer: 0,
      status: 'complete',
      output: 'Deploy researcher → synthesizer.',
      logs: [{ type: 'thinking', content: 'Breaking the query into research + synthesis.' }],
    },
    {
      agent_id: 'researcher_1',
      role: 'researcher',
      task: 'Gather sources',
      layer: 1,
      status: 'running',
      logs: [
        { type: 'thought', content: 'Searching recent docs…' },
        { type: 'observation', content: 'Found 4 relevant sources.' },
      ],
      tool_calls: [{ name: 'web_search' }],
    },
    {
      agent_id: 'synthesizer_2',
      role: 'synthesizer',
      task: 'Write the final answer',
      layer: 2,
      status: 'pending',
    },
  ],
};

/** Demo for `?demo=hitl` — approval gate + YAML + steps */
const DEMO_HITL_EXECUTION = {
  stage: 'awaiting_approval',
  stageMessage: 'Waiting for human approval…',
  pipelineId: 'pipe-demo-hitl',
  workflowYaml: `workflow:
  id: pipe-demo-hitl
  description: Research and synthesize an answer
  prompt: What is Magentic studio?
  stages: 3
  steps:
    - id: coordinator_0
      role: coordinator
      task: Plan the approach
      layer: 0
      status: pending
    - id: researcher_1
      role: researcher
      task: Gather sources
      layer: 1
      status: pending
    - id: synthesizer_2
      role: synthesizer
      task: Write the final answer
      layer: 2
      status: pending
`,
  plan: {
    description: 'Research and synthesize an answer',
    total_agents: 3,
    stages: 3,
    agents: [
      { agent_id: 'coordinator_0', role: 'coordinator', task: 'Plan the approach', layer: 0, status: 'pending' },
      { agent_id: 'researcher_1', role: 'researcher', task: 'Gather sources', layer: 1, status: 'pending' },
      { agent_id: 'synthesizer_2', role: 'synthesizer', task: 'Write the final answer', layer: 2, status: 'pending' },
    ],
  },
  agents: [
    { agent_id: 'coordinator_0', role: 'coordinator', task: 'Plan the approach', layer: 0, status: 'pending' },
    { agent_id: 'researcher_1', role: 'researcher', task: 'Gather sources', layer: 1, status: 'pending' },
    { agent_id: 'synthesizer_2', role: 'synthesizer', task: 'Write the final answer', layer: 2, status: 'pending' },
  ],
  approval: {
    pipeline_id: 'pipe-demo-hitl',
    agents: [
      { agent_id: 'coordinator_0', role: 'coordinator', task: 'Plan the approach', status: 'pending' },
      { agent_id: 'researcher_1', role: 'researcher', task: 'Gather sources', status: 'pending' },
      { agent_id: 'synthesizer_2', role: 'synthesizer', task: 'Write the final answer', status: 'pending' },
    ],
    description: 'Research and synthesize an answer',
    workflow_yaml: '',
    stages: 3,
    message: 'Review the visual workflow and step actions, then approve to run.',
  },
};

const ChatArea = memo(function ChatArea({
  messages,
  currentExecution,
  onRetry,
  onPreviewArtifact,
  showExecutionDetails = true,
  studioMode = false,
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
  const demoParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('demo')
      : null;
  const showLoopDemo =
    demoParam === 'loop' && messages.length === 0 && !currentExecution;
  const showHitlDemo =
    demoParam === 'hitl' && messages.length === 0 && !currentExecution;
  const demoExecution = showHitlDemo
    ? DEMO_HITL_EXECUTION
    : showLoopDemo
      ? DEMO_LOOP_EXECUTION
      : null;

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-5 scrollbar-hide"
    >
      {messages.length === 0 && !currentExecution && !showLoopDemo && !showHitlDemo && (
        <EmptyState studioMode={studioMode} compact={studioMode} />
      )}

      {(showLoopDemo || showHitlDemo) && (
        <div className="max-w-3xl mx-auto w-full space-y-3">
          <p className="text-[13px] text-slate-500 dark:text-slate-400 px-1">
            {showHitlDemo ? 'Demo · Human-in-the-loop approval' : 'Demo · Copilot-style agent loop'}
          </p>
          <ExecutionView
            execution={demoExecution}
            variant="live"
            showAvatar={true}
            showDetails={showExecutionDetails}
            hideLoop={studioMode}
          />
        </div>
      )}

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
              hideLoop={studioMode}
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
          hideLoop={studioMode}
        />
      )}

      <div ref={messagesEndRef} className="h-1" />
    </div>
  );
});

export default ChatArea;
