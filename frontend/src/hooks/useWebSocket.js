/**
 * WebSocket hook for managing connection to the backend
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_CONFIG, WEBSOCKET_EVENTS, RECONNECT_DELAY, AGENT_STATUS } from '../constants';

export function useWebSocket(user, isAuthenticated, onMessageReceived) {
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const wsRef = useRef(null);

  const connect = useCallback(() => {
    if (!user || !isAuthenticated) return;

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const websocket = new WebSocket(
      `${API_CONFIG.WS_URL}?username=${encodeURIComponent(user.username)}`
    );

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      // Reconnect after delay
      reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessageReceived(data);
    };

    wsRef.current = websocket;
    setWs(websocket);
  }, [user, isAuthenticated, onMessageReceived]);

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isAuthenticated, user, connect]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  return {
    ws,
    isConnected,
    sendMessage,
  };
}

/**
 * Process incoming WebSocket messages
 */
export function processWebSocketMessage(data, setCurrentExecution, setMessages, executionRef) {
  console.log('Received:', data);

  switch (data.type) {
    case WEBSOCKET_EVENTS.STATUS:
      // Initial acknowledgment - no action needed
      break;

    case WEBSOCKET_EVENTS.STAGE:
      setCurrentExecution((prev) => ({
        ...prev,
        stage: data.stage,
        stageMessage: data.message,
      }));
      // Update loading message with stage info
      setMessages((msgs) => {
        const loadingIndex = msgs.findIndex(m => m.type === 'assistant' && m.isLoading);
        if (loadingIndex !== -1) {
          const updatedMsgs = [...msgs];
          updatedMsgs[loadingIndex] = {
            ...updatedMsgs[loadingIndex],
            loadingStage: data.stage,
            loadingMessage: data.message,
          };
          return updatedMsgs;
        }
        return msgs;
      });
      break;

    case WEBSOCKET_EVENTS.THINKING:
      // Stream thinking content from reasoning models (Qwen3, QwQ, etc.)
      setCurrentExecution((prev) => ({
        ...prev,
        stage: 'thinking',
        isThinking: true,
        thinkingContent: (prev?.thinkingContent || '') + data.content,
        stageMessage: 'Model is reasoning...',
      }));
      break;

    case WEBSOCKET_EVENTS.PLAN:
      console.log('📋 PLAN received with agents:', data.data.agents?.map(a => ({ id: a.agent_id, status: a.status })));
      setCurrentExecution((prev) => {
        console.log('📋 PLAN handler - prev.agents:', prev?.agents?.map(a => ({ id: a.agent_id, status: a.status })));
        
        // Create a map of existing agent states to preserve
        const existingAgentStates = new Map();
        if (prev?.agents && Array.isArray(prev.agents)) {
          prev.agents.forEach(agent => {
            existingAgentStates.set(agent.agent_id, agent);
          });
        }
        
        // Normalize status from backend (completed -> complete)
        const normalizeStatus = (status) => {
          if (status === 'completed') return AGENT_STATUS.COMPLETE;
          if (status === 'complete') return AGENT_STATUS.COMPLETE;
          if (status === 'running') return AGENT_STATUS.RUNNING;
          if (status === 'pending') return AGENT_STATUS.PENDING;
          return status || AGENT_STATUS.PENDING;
        };
        
        // Build merged agents list
        const newPlanAgentIds = new Set(data.data.agents.map(a => a.agent_id));
        const mergedAgents = [];
        
        // First, process all agents from the new plan (preserving existing state)
        for (const agent of data.data.agents) {
          const existing = existingAgentStates.get(agent.agent_id);
          if (existing) {
            // Preserve existing state - CRITICAL: keep logs, status, input, output, startTime, etc.
            const preservedStatus = (existing.status === AGENT_STATUS.RUNNING || existing.status === AGENT_STATUS.COMPLETE)
              ? existing.status 
              : normalizeStatus(agent.status);
            console.log(`📋 MERGE: ${agent.agent_id} existing=${existing.status} plan=${agent.status} → ${preservedStatus}`);
            mergedAgents.push({
              ...existing,  // Start with ALL existing data
              // Only update non-state metadata from plan
              layer: agent.layer ?? existing.layer,
              task: agent.task || existing.task,
              role: agent.role || existing.role,
              status: preservedStatus,
            });
          } else {
            // New agent from plan - set startTime for coordinator (layer 0) from execution start
            const isCoordinator = (agent.layer ?? 0) === 0;
            const agentStartTime = isCoordinator && prev?.startedAt 
              ? new Date(prev.startedAt).getTime() 
              : null; // Other agents get startTime when they actually start via agent_start
            console.log(`📋 NEW: ${agent.agent_id} status=${normalizeStatus(agent.status)} startTime=${agentStartTime}`);
            mergedAgents.push({
              ...agent,
              status: normalizeStatus(agent.status),
              logs: agent.logs || [],
              startTime: agentStartTime,
            });
          }
        }
        
        // Also keep any agents that were in prev but NOT in new plan (edge case)
        for (const [agentId, agent] of existingAgentStates) {
          if (!newPlanAgentIds.has(agentId)) {
            console.log(`📋 KEEP orphan: ${agentId} status=${agent.status}`);
            mergedAgents.push(agent);
          }
        }
        
        console.log('📋 RESULT:', mergedAgents.map(a => ({ id: a.agent_id, status: a.status })));
        
        return {
          ...prev,
          stage: 'planned',
          plan: data.data,
          agents: mergedAgents,
          stageMessage: `Executing ${data.data.total_agents} agents across ${data.data.total_layers} layers`,
        };
      });
      break;

    case WEBSOCKET_EVENTS.AGENT_START:
      console.log('🚀 Agent start received:', data.data.agent_id);
      setCurrentExecution((prev) => {
        // Use execution startedAt for coordinator (layer 0), Date.now() for other agents
        const isCoordinator = (data.data.layer ?? 0) === 0;
        const agentStartTime = isCoordinator && prev?.startedAt 
          ? new Date(prev.startedAt).getTime() 
          : Date.now();
        
        // If no agents yet (null or empty), create the agent on-the-fly
        if (!prev?.agents || !Array.isArray(prev.agents) || prev.agents.length === 0) {
          console.log('🚀 Creating agent on-the-fly for agent_start:', data.data.agent_id);
          return {
            ...prev,
            agents: [{
              agent_id: data.data.agent_id,
              role: data.data.role || 'coordinator',
              task: data.data.task || 'Processing...',
              layer: data.data.layer ?? 0,
              status: AGENT_STATUS.RUNNING,
              input: data.data.input,
              startTime: agentStartTime,
              logs: [],
            }],
          };
        }

        const agentIds = prev.agents.map(a => a.agent_id);
        console.log('🚀 Looking for agent_id:', data.data.agent_id, 'in:', agentIds);
        
        const found = agentIds.includes(data.data.agent_id);
        if (!found) {
          // Agent not in list - add it
          console.log('🚀 Agent not found, adding:', data.data.agent_id);
          return {
            ...prev,
            agents: [...prev.agents, {
              agent_id: data.data.agent_id,
              role: data.data.role || 'agent',
              task: data.data.task || 'Processing...',
              layer: data.data.layer ?? 0,
              status: AGENT_STATUS.RUNNING,
              input: data.data.input,
              startTime: agentStartTime,
              logs: [],
            }],
          };
        }

        const updatedAgents = prev.agents.map((agent) =>
          agent.agent_id === data.data.agent_id
            ? {
                ...agent,
                status: AGENT_STATUS.RUNNING,
                input: data.data.input,
                // Preserve existing startTime if agent already has one, otherwise use calculated time
                startTime: agent.startTime || agentStartTime,
              }
            : agent
        );
        
        console.log('🚀 Updated agents after start:', updatedAgents.map(a => ({ id: a.agent_id, status: a.status })));

        return {
          ...prev,
          agents: updatedAgents,
        };
      });
      break;

    case WEBSOCKET_EVENTS.AGENT_COMPLETE:
      console.log('✅ AGENT_COMPLETE received:', data.data.agent_id);
      setCurrentExecution((prev) => {
        console.log('✅ AGENT_COMPLETE handler - prev.agents:', prev?.agents?.map(a => ({ id: a.agent_id, status: a.status })));
        
        // If no agents yet, create the agent on-the-fly as completed
        if (!prev?.agents || !Array.isArray(prev.agents) || prev.agents.length === 0) {
          console.log('✅ Creating agent on-the-fly for agent_complete:', data.data.agent_id);
          return {
            ...prev,
            agents: [{
              agent_id: data.data.agent_id,
              role: data.data.role || 'coordinator',
              task: 'Completed',
              layer: 0,
              status: AGENT_STATUS.COMPLETE,
              input: data.data.input,
              output: data.data.output,
              output_length: data.data.output_length,
              tool_calls: data.data.tool_calls,
              token_usage: data.data.token_usage,
              artifacts: data.data.artifacts || [],
              startTime: prev?.startedAt ? new Date(prev.startedAt).getTime() : Date.now(),
              endTime: Date.now(),
              logs: [],
            }],
          };
        }

        const agentIds = prev.agents.map(a => a.agent_id);
        const found = agentIds.includes(data.data.agent_id);
        
        if (!found) {
          // Add agent as completed
          console.log('✅ Agent not found, adding as completed:', data.data.agent_id);
          return {
            ...prev,
            agents: [...prev.agents, {
              agent_id: data.data.agent_id,
              role: data.data.role || 'agent',
              task: 'Completed',
              layer: data.data.layer || 0,
              status: AGENT_STATUS.COMPLETE,
              input: data.data.input,
              output: data.data.output,
              output_length: data.data.output_length,
              tool_calls: data.data.tool_calls,
              token_usage: data.data.token_usage,
              artifacts: data.data.artifacts || [],
              startTime: prev?.startedAt ? new Date(prev.startedAt).getTime() : Date.now(),
              endTime: Date.now(),
              logs: [],
            }],
          };
        }

        // Update existing agent
        console.log('✅ Marking agent complete:', data.data.agent_id);
        const updatedAgents = prev.agents.map((agent) => {
          if (agent.agent_id === data.data.agent_id) {
            // Calculate startTime - preserve existing, or use execution start for coordinator
            const isCoordinator = (agent.layer ?? 0) === 0;
            const preservedStartTime = agent.startTime || 
              (isCoordinator && prev?.startedAt ? new Date(prev.startedAt).getTime() : Date.now());
            
            console.log(`✅ Agent ${agent.agent_id} startTime=${preservedStartTime} endTime=${Date.now()}`);
            
            return {
              ...agent,  // Preserve logs and other state
              status: AGENT_STATUS.COMPLETE,
              input: data.data.input || agent.input,
              output: data.data.output,
              output_length: data.data.output_length,
              tool_calls: data.data.tool_calls,
              token_usage: data.data.token_usage,
              artifacts: data.data.artifacts || [],
              startTime: preservedStartTime,  // Explicitly preserve/set startTime
              endTime: Date.now(),
            };
          }
          return agent;
        });
        
        console.log('✅ RESULT:', updatedAgents.map(a => ({ id: a.agent_id, status: a.status, startTime: a.startTime })));
        return {
          ...prev,
          agents: updatedAgents,
        };
      });
      break;

    case WEBSOCKET_EVENTS.AGENT_LOG:
      // Handle streaming log entries for an agent
      // Each log is added to the agent's logs array - groupLogs will consolidate thinking
      setCurrentExecution((prev) => {
        const logType = data.data.log_type;
        const agentId = data.data.agent_id;
        const content = data.data.content;
        const metadata = data.data.metadata;
        const timestamp = data.data.timestamp || Date.now();

        const newLog = { timestamp, type: logType, content, metadata };

        // If no agents yet, create the agent on-the-fly
        if (!prev?.agents || prev.agents.length === 0) {
          return {
            ...prev,
            agents: [{
              agent_id: agentId,
              role: 'coordinator',
              task: 'Processing...',
              layer: 0,
              status: AGENT_STATUS.RUNNING,
              logs: [newLog],
            }],
          };
        }

        // Check if agent exists
        const agentExists = prev.agents.some(a => a.agent_id === agentId);
        if (!agentExists) {
          return {
            ...prev,
            agents: [...prev.agents, {
              agent_id: agentId,
              role: 'agent',
              task: 'Processing...',
              layer: 0,
              status: AGENT_STATUS.RUNNING,
              logs: [newLog],
            }],
          };
        }

        // Add log to agent
        const updatedAgents = prev.agents.map((agent) =>
          agent.agent_id === agentId
            ? { ...agent, logs: [...(agent.logs || []), newLog] }
            : agent
        );

        return { ...prev, agents: updatedAgents };
      });
      break;

    case WEBSOCKET_EVENTS.STREAM_START:
      // Start streaming response - preserve all existing state!
      setCurrentExecution((prev) => ({
        ...prev,  // IMPORTANT: preserve agents, plan, etc.
        stage: 'streaming',
        stageMessage: 'Generating response...',
        isStreaming: true,
        streamingContent: '',
        streamingAgentId: data.data?.agent_id,
      }));
      break;

    case WEBSOCKET_EVENTS.STREAM_TOKEN:
      // Append streaming token to current response
      setCurrentExecution((prev) => ({
        ...prev,  // Preserve all state
        streamingContent: (prev?.streamingContent || '') + data.token,
      }));
      break;

    case WEBSOCKET_EVENTS.STREAM_END:
      // Streaming complete - preserve state, content will be finalized in COMPLETE event
      setCurrentExecution((prev) => ({
        ...prev,  // Preserve all state
        isStreaming: false,
        stageMessage: 'Finalizing...',
      }));
      break;

    case WEBSOCKET_EVENTS.COMPLETE:
      // Mark execution as complete but DON'T clear it or add messages here
      // That's handled in App.jsx to allow smooth transition with streaming
      // Create a deep copy to preserve execution data
      const executionData = executionRef.current
        ? JSON.parse(JSON.stringify(executionRef.current))
        : null;

      // Add token usage from complete event to execution data
      if (executionData && data.data.token_usage) {
        executionData.token_usage = data.data.token_usage;
      }

      // Mark execution as complete (but keep it visible!)
      if (executionData) {
        executionData.stage = 'complete';
        executionData.output = data.data.output;
        // Include artifacts and references in execution data for persistence
        executionData.artifacts = data.data.artifacts || [];
        executionData.references = data.data.references || [];
        
        // Mark ALL agents as complete when execution finishes
        if (executionData.agents) {
          const endTime = Date.now();
          executionData.agents = executionData.agents.map((agent) => ({
            ...agent,
            status: (agent.status === AGENT_STATUS.RUNNING || agent.status === AGENT_STATUS.PENDING)
              ? AGENT_STATUS.COMPLETE
              : agent.status,
            endTime: agent.endTime || endTime,
          }));
        }
        
        // Update execution state - keep visible with streaming content intact
        setCurrentExecution(executionData);
      }
      // NOTE: Message adding is handled in App.jsx on next user message
      break;

    case WEBSOCKET_EVENTS.ERROR:
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          type: 'error',
          content: data.message,
          timestamp: new Date(),
        },
      ]);
      setCurrentExecution(null);
      break;

    case WEBSOCKET_EVENTS.STOPPED:
      // Create a deep copy to preserve execution data (similar to COMPLETE)
      const stoppedExecutionData = executionRef.current
        ? JSON.parse(JSON.stringify(executionRef.current))
        : null;

      // Mark as stopped - only running agents become stopped, pending stay pending (grey)
      if (stoppedExecutionData) {
        stoppedExecutionData.stage = 'stopped';
        stoppedExecutionData.stageMessage = data.message || 'Execution stopped by user';
        // Update agent statuses - only running becomes stopped, pending stays grey
        if (stoppedExecutionData.agents) {
          stoppedExecutionData.agents = stoppedExecutionData.agents.map((agent) => ({
            ...agent,
            status: agent.status === AGENT_STATUS.RUNNING
              ? AGENT_STATUS.STOPPED
              : agent.status, // Keep pending as pending (grey)
          }));
        }
      }

      // Update current execution to stopped state (smooth transition, no remount)
      setCurrentExecution((prev) => {
        if (!prev) {
          console.log('Stop acknowledged - no active execution');
          return null;
        }
        
        // Update agents - only running becomes stopped, pending stays grey
        const updatedAgents = prev.agents?.map((agent) => ({
          ...agent,
          status: agent.status === AGENT_STATUS.RUNNING
            ? AGENT_STATUS.STOPPED
            : agent.status, // Keep pending as pending (grey)
        })) || [];

        return {
          ...prev,
          stage: 'stopped',
          stageMessage: data.message || 'Execution stopped by user',
          agents: updatedAgents,
        };
      });

      // Add the stopped message (execution view is already showing)
      setMessages((msgs) => [
        ...msgs,
        {
          id: `stopped-${Date.now()}`,
          type: 'assistant',
          content: data.message || 'Execution stopped by user',
          execution: stoppedExecutionData,
          timestamp: new Date(),
        },
      ]);

      // Clear execution immediately
      setCurrentExecution(null);
      break;

    default:
      console.warn('Unknown message type:', data.type);
  }
}
