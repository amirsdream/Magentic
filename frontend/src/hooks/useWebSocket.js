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

    case WEBSOCKET_EVENTS.PLAN:
      console.log('Plan received with agents:', data.data.agents);
      console.log('Agent IDs in plan:', data.data.agents.map(a => a.agent_id));
      setCurrentExecution({
        stage: 'planned',
        plan: data.data,
        agents: data.data.agents.map((agent) => ({
          ...agent,
          status: AGENT_STATUS.PENDING,
        })),
        stageMessage: `Executing ${data.data.total_agents} agents across ${data.data.total_layers} layers`,
      });
      break;

    case WEBSOCKET_EVENTS.AGENT_START:
      console.log('Agent start received:', data.data.agent_id);
      setCurrentExecution((prev) => {
        if (!prev?.agents) {
          console.warn('No current execution when agent_start received');
          return prev;
        }

        const agentIds = prev.agents.map(a => a.agent_id);
        console.log('Looking for agent_id:', data.data.agent_id, 'in:', agentIds);
        
        const found = agentIds.includes(data.data.agent_id);
        if (!found) {
          console.error('Agent ID not found in agents list!', data.data.agent_id);
        }

        const updatedAgents = prev.agents.map((agent) =>
          agent.agent_id === data.data.agent_id
            ? {
                ...agent,
                status: AGENT_STATUS.RUNNING,
                input: data.data.input,
                startTime: Date.now(),
              }
            : agent
        );
        
        console.log('Updated agents after start:', updatedAgents.map(a => ({ id: a.agent_id, status: a.status })));

        return {
          ...prev,
          agents: updatedAgents,
        };
      });
      break;

    case WEBSOCKET_EVENTS.AGENT_COMPLETE:
      console.log('Agent complete received:', data.data.agent_id);
      setCurrentExecution((prev) => {
        if (!prev?.agents) {
          console.warn('No current execution or agents to update!');
          return prev;
        }

        const agentIds = prev.agents.map(a => a.agent_id);
        console.log('Looking for agent_id:', data.data.agent_id, 'in:', agentIds);
        
        const found = agentIds.includes(data.data.agent_id);
        if (!found) {
          console.error('Agent ID not found in agents list!', data.data.agent_id);
        }

        const updatedAgents = prev.agents.map((agent) =>
          agent.agent_id === data.data.agent_id
            ? {
                ...agent,
                status: AGENT_STATUS.COMPLETE,
                input: data.data.input,
                output: data.data.output,
                output_length: data.data.output_length,
                tool_calls: data.data.tool_calls,
                token_usage: data.data.token_usage,
                endTime: Date.now(),
              }
            : agent
        );
        
        console.log('Updated agents after complete:', updatedAgents.map(a => ({ id: a.agent_id, status: a.status })));

        return {
          ...prev,
          agents: updatedAgents,
        };
      });
      break;

    case WEBSOCKET_EVENTS.COMPLETE:
      // Create a deep copy to preserve execution data
      const executionData = executionRef.current
        ? JSON.parse(JSON.stringify(executionRef.current))
        : null;

      // Add token usage from complete event to execution data
      if (executionData && data.data.token_usage) {
        executionData.token_usage = data.data.token_usage;
      }

      // Add the assistant response message
      setMessages((msgs) => [
        ...msgs,
        {
          type: 'assistant',
          content: data.data.output,
          execution: executionData,
          timestamp: new Date(),
        },
      ]);

      setCurrentExecution(null);
      break;

    case WEBSOCKET_EVENTS.ERROR:
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          type: 'error',
          content: data.message,
          timestamp: new Date(),
        },
      ]);
      setCurrentExecution(null);
      break;

    case WEBSOCKET_EVENTS.STOPPED:
      // Mark all running/pending agents as stopped (if any)
      setCurrentExecution((prev) => {
        if (!prev) {
          // No execution was in progress, just return null
          console.log('Stop acknowledged - no active execution');
          return null;
        }
        
        if (!prev.agents) {
          // Execution started but no agents yet
          return {
            ...prev,
            stage: 'stopped',
            stageMessage: data.message || 'Execution stopped by user',
          };
        }
        
        const updatedAgents = prev.agents.map((agent) => ({
          ...agent,
          status: agent.status === AGENT_STATUS.RUNNING || agent.status === AGENT_STATUS.PENDING
            ? AGENT_STATUS.STOPPED
            : agent.status,
        }));

        return {
          ...prev,
          stage: 'stopped',
          stageMessage: data.message || 'Execution stopped by user',
          agents: updatedAgents,
        };
      });

      // Add stopped message
      setMessages((prev) => {
        // Remove loading message if present
        const filtered = prev.filter(m => !m.isLoading);
        return [
          ...filtered,
          {
            type: 'info',
            content: data.message || 'Execution stopped by user',
            timestamp: new Date(),
          },
        ];
      });

      // Clear execution after a brief delay to show stopped state
      setTimeout(() => setCurrentExecution(null), 1000);
      break;

    default:
      console.warn('Unknown message type:', data.type);
  }
}
