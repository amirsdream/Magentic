/**
 * useChat hook - Manages chat state, messages, and WebSocket message handling
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useChatStore } from '../store';
import { useExecutionStore } from '../store';
import { processWebSocketMessage } from './useWebSocket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function useChat(user, isAuthenticated) {
  // Chat store selectors - use useShallow for object selectors to prevent unnecessary re-renders
  const {
    activeConversationId,
    isInitialized,
    isLoadingChats,
    executingConversationId,
    executionsByConversation,
  } = useChatStore(useShallow((state) => ({
    activeConversationId: state.activeConversationId,
    isInitialized: state.isInitialized,
    isLoadingChats: state.isLoading,
    executingConversationId: state.executingConversationId,
    executionsByConversation: state.executionsByConversation,
  })));
  
  // Stable function references - these don't change
  const loadChats = useChatStore((state) => state.loadChats);
  const createConversation = useChatStore((state) => state.createConversation);
  const addMessage = useChatStore((state) => state.addMessage);
  const addMessageToConversation = useChatStore((state) => state.addMessageToConversation);
  const loadChatMessages = useChatStore((state) => state.loadChatMessages);
  const setConversationExecution = useChatStore((state) => state.setConversationExecution);
  
  // Get active conversation messages length only (not the whole object)
  const activeConvMessagesLength = useChatStore((state) => {
    const conv = state.conversations.find(c => c.id === state.activeConversationId);
    return conv?.messages?.length ?? 0;
  });
  
  // Get active conversation data only when needed via ref
  const getActiveConversation = useCallback(() => {
    return useChatStore.getState().conversations.find(
      c => c.id === useChatStore.getState().activeConversationId
    );
  }, []);
  
  const { setExecution } = useExecutionStore();
  
  // Local state
  const [messages, setMessages] = useState([]);
  const [currentExecution, setCurrentExecution] = useState(null);
  
  // Refs
  const executionRef = useRef(null);
  const executingConvIdRef = useRef(null);
  const prevConversationIdRef = useRef(null);
  const initialLoadDoneRef = useRef(false);
  const skipNextSyncRef = useRef(false); // Skip sync after direct update

  // Keep executing conversation ref in sync
  useEffect(() => {
    executingConvIdRef.current = executingConversationId;
  }, [executingConversationId]);

  // Sync execution to store
  useEffect(() => {
    if (executingConversationId && currentExecution) {
      setConversationExecution(executingConversationId, currentExecution);
    }
  }, [currentExecution, executingConversationId, setConversationExecution]);

  // Load chats when user logs in
  useEffect(() => {
    if (isAuthenticated && user?.username) {
      loadChats(user.username);
    }
  }, [isAuthenticated, user?.username, loadChats]);

  // Sync messages when conversation switches or initial load
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    
    const activeConversation = getActiveConversation();
    if (!activeConversation) return;
    
    // Skip sync if we just updated messages directly
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    
    const isSwitch = prevConversationIdRef.current !== activeConversationId;
    const isInitialLoad = !initialLoadDoneRef.current && isInitialized;
    
    if (isSwitch || isInitialLoad) {
      prevConversationIdRef.current = activeConversationId;
      
      if (isInitialLoad) {
        initialLoadDoneRef.current = true;
      }
      
      // Restore execution state if switching back to running task
      const storedExecution = executionsByConversation[activeConversationId];
      if (storedExecution && executingConversationId === activeConversationId) {
        executionRef.current = storedExecution;
        setCurrentExecution(storedExecution);
      } else if (isSwitch) {
        // Only clear execution when actually switching conversations
        executionRef.current = null;
        setCurrentExecution(null);
      }
      // Otherwise keep current execution (don't clear on sync)
      
      // Load messages from backend or use cache
      if (activeConversation.synced && activeConversation.messageCount > 0 && activeConversation.messages.length === 0) {
        const username = user?.username || 'guest';
        loadChatMessages(username, activeConversationId);
        setMessages([]);
      } else {
        setMessages(activeConversation.messages || []);
      }
    }
  }, [activeConversationId, user, loadChatMessages, isInitialized, executionsByConversation, executingConversationId, getActiveConversation]);

  // Separate effect to handle async message loading from backend
  // This only triggers when messages count changes (backend load complete)
  const prevStoreMessagesLengthRef = useRef(0);
  useEffect(() => {
    // Skip if we just updated locally
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      prevStoreMessagesLengthRef.current = activeConvMessagesLength;
      return;
    }
    
    const prevLength = prevStoreMessagesLengthRef.current;
    
    // Only sync if store messages loaded from 0 (async load completed)
    // and we're not currently executing (which updates messages directly)
    if (prevLength === 0 && activeConvMessagesLength > 0 && !executingConversationId) {
      const activeConversation = getActiveConversation();
      if (activeConversation) {
        setMessages(activeConversation.messages);
      }
    }
    
    prevStoreMessagesLengthRef.current = activeConvMessagesLength;
  }, [activeConvMessagesLength, executingConversationId, getActiveConversation]);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((data) => {
    const targetConvId = executingConvIdRef.current;
    const isViewingExecutingConv = targetConvId === useChatStore.getState().activeConversationId;
    
    // Capture stopped execution data
    let stoppedExecutionData = null;
    if (data.type === 'stopped' && executionRef.current) {
      stoppedExecutionData = JSON.parse(JSON.stringify(executionRef.current));
      stoppedExecutionData.stage = 'stopped';
      stoppedExecutionData.stageMessage = data.message || 'Execution stopped by user';
      if (stoppedExecutionData.agents) {
        stoppedExecutionData.agents = stoppedExecutionData.agents.map(agent => ({
          ...agent,
          status: agent.status === 'running' ? 'stopped' : agent.status
        }));
      }
    }
    
    // Wrapped setters
    const wrappedSetExecution = (newExecution) => {
      const resolvedExecution = typeof newExecution === 'function' 
        ? newExecution(executionRef.current)
        : newExecution;
      
      executionRef.current = resolvedExecution;
      
      if (isViewingExecutingConv) {
        setCurrentExecution(resolvedExecution);
      }
      
      if (targetConvId && resolvedExecution) {
        setConversationExecution(targetConvId, resolvedExecution);
      }
    };
    
    const wrappedSetMessages = (updater) => {
      if (data.type === 'complete' || data.type === 'stopped') return;
      if (isViewingExecutingConv) {
        setMessages(updater);
      }
    };
    
    // Process message
    processWebSocketMessage(data, wrappedSetExecution, wrappedSetMessages, executionRef);
    
    if (data.type === 'agent_start' || data.type === 'agent_end' || data.type === 'tool_start') {
      setExecution(data);
    }
    
    // Handle complete
    if (data.type === 'complete' && data.data?.output) {
      const executionData = executionRef.current
        ? JSON.parse(JSON.stringify(executionRef.current))
        : null;
      
      // Ensure execution stays visible with complete stage
      if (executionData) {
        executionData.stage = 'complete';
        executionRef.current = executionData;
        setCurrentExecution(executionData);
      }
      
      const execConvId = targetConvId;
      const username = user?.username || 'guest';
      
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: data.data.output,
        execution: executionData,
        artifacts: data.data.artifacts || executionData?.artifacts || [],
        references: data.data.references || executionData?.references || [],
        timestamp: new Date(),
      };
      
      if (execConvId) {
        // Don't add assistant message to local state - ExecutionView shows the response
        // Just clear the executing ref
        executingConvIdRef.current = null;
        
        // Batch store updates in setTimeout to avoid triggering re-renders
        setTimeout(() => {
          // Store the message in conversation for history (but won't render as MessageBubble)
          useChatStore.setState((state) => ({
            conversations: state.conversations.map((conv) =>
              conv.id === execConvId
                ? { ...conv, messages: [...conv.messages, assistantMessage], updatedAt: new Date().toISOString() }
                : conv
            ),
            // Clear execution state
            executionsByConversation: {
              ...state.executionsByConversation,
              [execConvId]: undefined,
            },
            executingConversationId: null,
          }));
        }, 0);
      }
      
      // Persist to backend
      if (execConvId && username && execConvId.startsWith('chat_')) {
        const executionDataForBackend = executionData ? {
          ...executionData,
          artifacts: data.data.artifacts || executionData.artifacts || [],
          references: data.data.references || executionData.references || [],
        } : null;
        
        fetch(`${API_URL}/chats/${execConvId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'assistant',
            content: data.data.output,
            execution_data: executionDataForBackend,
          }),
        }).catch(err => console.error('Failed to save assistant message:', err));
      }
    }
    
    // Handle stopped
    if (data.type === 'stopped') {
      const username = user?.username || 'guest';
      const execConvId = targetConvId;
      
      // Mark execution as stopped (keep it visible)
      if (stoppedExecutionData && isViewingExecutingConv) {
        executionRef.current = stoppedExecutionData;
        setCurrentExecution(stoppedExecutionData);
      }
      
      const stoppedMessage = {
        id: `stopped-${Date.now()}`,
        type: 'assistant',
        content: data.message || 'Execution stopped by user',
        execution: stoppedExecutionData,
        timestamp: new Date(),
      };
      
      if (execConvId) {
        // Update local state first
        if (isViewingExecutingConv) {
          skipNextSyncRef.current = true;
          setMessages((msgs) => [...msgs, stoppedMessage]);
          
          // Clear execution after message added (smooth transition)
          requestAnimationFrame(() => {
            executionRef.current = null;
            setCurrentExecution(null);
          });
        }
        
        // Clear ref immediately
        executingConvIdRef.current = null;
        
        // Batch all store updates
        setTimeout(() => {
          addMessageToConversation(execConvId, {
            type: 'assistant',
            content: data.message || 'Execution stopped by user',
            execution: stoppedExecutionData,
            timestamp: new Date(),
          }, username);
          
          useChatStore.setState((state) => ({
            executionsByConversation: {
              ...state.executionsByConversation,
              [execConvId]: undefined,
            },
            executingConversationId: null,
          }));
        }, 0);
      }
    }
  }, [setExecution, user, addMessageToConversation, setConversationExecution]);

  // Send message handler
  const sendChatMessage = useCallback(async (content, sendMessage) => {
    if (!content.trim()) return;
    
    const username = user?.username || 'guest';
    
    let currentConvId = activeConversationId;
    if (!currentConvId) {
      currentConvId = await createConversation(username);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    await addMessage(userMessage, username);

    // Set executing conversation via direct store update
    useChatStore.setState({ executingConversationId: currentConvId });
    executingConvIdRef.current = currentConvId;

    const initialExecution = {
      stage: 'initializing',
      stageMessage: 'Processing your query...',
      isLoading: true,
      agents: null,
      plan: null,
      query: content,
      startedAt: new Date().toISOString(),
    };
    
    // Update both state and ref synchronously
    executionRef.current = initialExecution;
    setCurrentExecution(initialExecution);
    setConversationExecution(currentConvId, initialExecution);

    sendMessage({ query: content, session_id: currentConvId });
  }, [user, activeConversationId, createConversation, addMessage, setConversationExecution]);

  // Execution history for workflow panel
  const executionHistory = useMemo(() => {
    return messages
      .filter(m => m.type === 'assistant' && m.execution)
      .map((m, idx, arr) => {
        const msgIndex = messages.indexOf(m);
        const userMsg = messages.slice(0, msgIndex).reverse().find(msg => msg.type === 'user');
        return {
          ...m.execution,
          query: m.execution.query || userMsg?.content || `Execution #${arr.length - idx}`,
        };
      });
  }, [messages]);

  return {
    // State
    messages,
    currentExecution,
    activeConversationId,
    executingConversationId,
    isInitialized,
    isLoadingChats,
    executionHistory,
    
    // Actions
    handleWebSocketMessage,
    sendChatMessage,
    setMessages,
    setCurrentExecution,
  };
}
