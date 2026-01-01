/**
 * Main App component - Magentic chat interface v3.0
 * Redesigned with animated UI and agent visualization
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';
import { useWebSocket, processWebSocketMessage } from './hooks';
import {
  Header,
  EmptyState,
  LoginModal,
  LoadingScreen,
  ProfileModal,
  Sidebar,
  MessageBubble,
  EnhancedChatInput,
  AgentFlowGraph,
  SettingsPanel,
  ExecutionView,
  WorkflowVisualization,
  ArtifactPreviewPanel,
} from './components';
import { useUIStore, useExecutionStore, useConnectionStore, useChatStore } from './store';

function App() {
  const { user, isAuthenticated, isGuest, loading, updateProfile } = useAuth();
  
  // Memoize user data to prevent unnecessary re-renders
  const stableUser = useMemo(() => ({
    username: user?.username,
    display_name: user?.display_name,
    avatar_emoji: user?.avatar_emoji,
  }), [user?.username, user?.display_name, user?.avatar_emoji]);
  
  // Chat store for persistence - only get what we need to avoid re-renders
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const isInitialized = useChatStore((state) => state.isInitialized);
  const isLoadingChats = useChatStore((state) => state.isLoading);
  const loadChats = useChatStore((state) => state.loadChats);
  const createConversation = useChatStore((state) => state.createConversation);
  const addMessage = useChatStore((state) => state.addMessage);
  const addMessageToConversation = useChatStore((state) => state.addMessageToConversation);
  
  // Execution tracking per conversation
  const executingConversationId = useChatStore((state) => state.executingConversationId);
  const setExecutingConversation = useChatStore((state) => state.setExecutingConversation);
  const setConversationExecution = useChatStore((state) => state.setConversationExecution);
  const getConversationExecution = useChatStore((state) => state.getConversationExecution);
  const clearConversationExecution = useChatStore((state) => state.clearConversationExecution);
  
  // Local state for current session messages
  const [messages, setMessages] = useState([]);
  const [currentExecution, setCurrentExecution] = useState(null);
  const [lastExecution, setLastExecution] = useState(null); // Keep last completed execution
  const [viewingExecution, setViewingExecution] = useState(null); // For viewing past executions
  const [previewArtifact, setPreviewArtifact] = useState(null); // For artifact preview panel
  
  // Zustand stores for UI only
  const {
    sidebarOpen,
    settingsOpen,
    showExecutionDetails,
    showAgentFlow,
    toggleSidebar,
    toggleSettings,
    toggleExecutionDetails,
    toggleAgentFlow,
    theme,
    setTheme,
  } = useUIStore();
  
  const { setExecution, clearExecution } = useExecutionStore();
  const { setConnected } = useConnectionStore();
  
  // Local UI state
  const [showProfile, setShowProfile] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState(new Set());
  
  // Refs
  const messagesEndRef = useRef(null);
  const executionRef = useRef(null);
  const executingConvIdRef = useRef(null); // Track which conversation started the execution

  // Keep execution ref in sync with state
  useEffect(() => {
    executionRef.current = currentExecution;
  }, [currentExecution]);
  
  // Keep executing conversation ref in sync
  useEffect(() => {
    executingConvIdRef.current = executingConversationId;
  }, [executingConversationId]);
  
  // Also sync execution to store whenever it changes (for conversation switching)
  useEffect(() => {
    if (executingConversationId && currentExecution) {
      setConversationExecution(executingConversationId, currentExecution);
    }
  }, [currentExecution, executingConversationId, setConversationExecution]);

  // Message handler for WebSocket
  const handleWebSocketMessage = useCallback((data) => {
    // Get which conversation this execution belongs to
    const targetConvId = executingConvIdRef.current;
    const isViewingExecutingConv = targetConvId === useChatStore.getState().activeConversationId;
    
    // For stopped events, capture execution BEFORE processing clears it
    let stoppedExecutionData = null;
    if (data.type === 'stopped' && executionRef.current) {
      // Capture and transform execution data immediately
      stoppedExecutionData = JSON.parse(JSON.stringify(executionRef.current));
      stoppedExecutionData.stage = 'stopped';
      stoppedExecutionData.stageMessage = data.message || 'Execution stopped by user';
      // Only mark running agents as stopped, pending stay grey
      if (stoppedExecutionData.agents) {
        stoppedExecutionData.agents = stoppedExecutionData.agents.map(agent => ({
          ...agent,
          status: agent.status === 'running'
            ? 'stopped' 
            : agent.status // Keep pending as pending (grey)
        }));
      }
    }
    
    // Create wrapped setters that also update the conversation execution store
    const wrappedSetExecution = (newExecution) => {
      // If it's a function, apply it to current ref
      const resolvedExecution = typeof newExecution === 'function' 
        ? newExecution(executionRef.current)
        : newExecution;
      
      // Update the ref
      executionRef.current = resolvedExecution;
      
      // Update local UI state only if viewing the executing conversation
      if (isViewingExecutingConv) {
        setCurrentExecution(resolvedExecution);
      }
      
      // Always update the stored execution for the target conversation
      if (targetConvId && resolvedExecution) {
        setConversationExecution(targetConvId, resolvedExecution);
      }
    };
    
    // Wrapper for setMessages that only updates if viewing executing conversation
    // EXCEPT for complete/stopped events - we handle those ourselves with addMessage
    const wrappedSetMessages = (updater) => {
      // Skip message updates for complete/stopped - we handle those separately
      // to ensure they go to the correct conversation
      if (data.type === 'complete' || data.type === 'stopped') {
        return;
      }
      if (isViewingExecutingConv) {
        setMessages(updater);
      }
    };
    
    // Process the message with wrapped setters
    processWebSocketMessage(data, wrappedSetExecution, wrappedSetMessages, executionRef);
    
    // Update execution store for visualization
    if (data.type === 'agent_start' || data.type === 'agent_end' || data.type === 'tool_start') {
      setExecution(data);
    }
    
    // Save assistant response to chat store when complete (for backend persistence)
    if (data.type === 'complete' && data.data?.output) {
      const username = user?.username || 'guest';
      // Get execution data and ensure token_usage is included
      const executionData = executionRef.current
        ? JSON.parse(JSON.stringify(executionRef.current))
        : null;
      
      // Add token usage from complete event
      if (executionData && data.data.token_usage) {
        executionData.token_usage = data.data.token_usage;
      }
      
      // Save as last execution for quick access (only if viewing this conversation)
      if (executionData && isViewingExecutingConv) {
        setLastExecution(executionData);
      }
      
      // Create the assistant message
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: data.data.output,
        execution: executionData,
        artifacts: data.data.artifacts || [],
        references: data.data.references || [],
        timestamp: new Date(),
      };
      
      // Save to the EXECUTING conversation (not necessarily active one)
      const execConvId = targetConvId;
      if (execConvId) {
        // If viewing the executing conversation, add to local messages state
        if (isViewingExecutingConv) {
          setMessages((msgs) => [...msgs, assistantMessage]);
        }
        
        // Add to store for the correct conversation (without switching active)
        addMessageToConversation(execConvId, {
          type: 'assistant',
          content: data.data.output,
          execution: executionData,
          artifacts: data.data.artifacts || [],
          references: data.data.references || [],
          timestamp: new Date(),
        }, username);
        
        // Clear the executing conversation state
        clearConversationExecution(execConvId);
        setExecutingConversation(null);
        executingConvIdRef.current = null;
        
        // Clear local execution state if viewing this conversation
        if (isViewingExecutingConv) {
          setCurrentExecution(null);
        }
      }
    }
    
    // Save stopped execution to chat store (for backend persistence)
    if (data.type === 'stopped') {
      const username = user?.username || 'guest';
      const execConvId = targetConvId;
      
      // Save as last execution (only if viewing)
      if (stoppedExecutionData && isViewingExecutingConv) {
        setLastExecution(stoppedExecutionData);
      }
      
      // Create the stopped message
      const stoppedMessage = {
        id: `stopped-${Date.now()}`,
        type: 'assistant',
        content: data.message || 'Execution stopped by user',
        execution: stoppedExecutionData,
        timestamp: new Date(),
      };
      
      // Add message to the executing conversation
      if (execConvId) {
        // If viewing the executing conversation, add to local messages state
        if (isViewingExecutingConv) {
          setMessages((msgs) => [...msgs, stoppedMessage]);
        }
        
        // Add to store for the correct conversation (without switching active)
        addMessageToConversation(execConvId, {
          type: 'assistant',
          content: data.message || 'Execution stopped by user',
          execution: stoppedExecutionData,
          timestamp: new Date(),
        }, username);
        
        // Clear executing state
        clearConversationExecution(execConvId);
        setExecutingConversation(null);
        executingConvIdRef.current = null;
        
        // Clear local execution state if viewing this conversation
        if (isViewingExecutingConv) {
          setCurrentExecution(null);
        }
      }
    }
  }, [setExecution, user, addMessage, addMessageToConversation, setLastExecution, setConversationExecution, clearConversationExecution, setExecutingConversation]);

  // WebSocket connection
  const { isConnected, sendMessage } = useWebSocket(
    user,
    isAuthenticated,
    handleWebSocketMessage
  );

  // Sync connection state
  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected, setConnected]);

  // Sync theme from user profile on initial login, but only if no local preference exists
  const [themeSynced, setThemeSynced] = React.useState(false);
  useEffect(() => {
    if (user?.theme && !themeSynced) {
      // Check if there's a local theme preference - if so, use that instead
      try {
        const storedData = localStorage.getItem('magentic-ui-storage');
        if (storedData) {
          const parsed = JSON.parse(storedData);
          // If local theme exists, don't override with backend theme
          if (parsed?.state?.theme) {
            setThemeSynced(true);
            return;
          }
        }
      } catch (e) {
        // ignore
      }
      // No local preference, use backend theme
      setTheme(user.theme);
      setThemeSynced(true);
    }
  }, [user?.theme, themeSynced, setTheme]);

  // Show login modal if not authenticated (with small delay to prevent flash)
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Small delay to ensure session restore has completed
      const timer = setTimeout(() => {
        setShowLogin(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setShowLogin(false);
    }
  }, [loading, isAuthenticated]);
  
  // Load chats when user logs in
  useEffect(() => {
    if (isAuthenticated && user?.username) {
      console.log('[App] Loading chats for user:', user.username);
      loadChats(user.username);
    }
  }, [isAuthenticated, user?.username, loadChats]);
  
  // Track previous conversation ID to detect switches
  const prevConversationIdRef = useRef(null); // Start with null to detect initial load
  const initialLoadDoneRef = useRef(false);
  
  // Load messages from backend when needed
  const loadChatMessages = useChatStore((state) => state.loadChatMessages);
  const conversations = useChatStore((state) => state.conversations);
  
  // Find the active conversation (memoized to avoid unnecessary recalculations)
  const activeConversation = useMemo(() => {
    return conversations.find(c => c.id === activeConversationId);
  }, [conversations, activeConversationId]);
  
  // Get stored executions for restoration
  const executionsByConversation = useChatStore((state) => state.executionsByConversation);
  
  // Sync messages when conversation SWITCHES or messages are loaded
  useEffect(() => {
    // Skip if no active conversation
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    
    // Skip if conversation not found (might be loading)
    if (!activeConversation) {
      return;
    }
    
    // Check if this is a conversation switch or initial load
    const isSwitch = prevConversationIdRef.current !== activeConversationId;
    const isInitialLoad = !initialLoadDoneRef.current && isInitialized;
    
    console.log('[App] Message sync check:', { 
      isSwitch, 
      isInitialLoad, 
      isInitialized,
      prevId: prevConversationIdRef.current,
      activeId: activeConversationId,
      conversationFound: !!activeConversation,
      synced: activeConversation?.synced,
      messageCount: activeConversation?.messageCount,
      loadedMessages: activeConversation?.messages?.length,
      hasStoredExecution: !!executionsByConversation[activeConversationId],
      executingConvId: executingConversationId,
    });
    
    if (isSwitch || isInitialLoad) {
      prevConversationIdRef.current = activeConversationId;
      
      if (isInitialLoad) {
        initialLoadDoneRef.current = true;
      }
      
      // Check if this conversation has an active execution (switching back to running task)
      const storedExecution = executionsByConversation[activeConversationId];
      if (storedExecution && executingConversationId === activeConversationId) {
        // Restore execution state - this is the running task!
        console.log('[App] Restoring execution state for running conversation');
        setCurrentExecution(storedExecution);
      } else {
        // Not the executing conversation - clear execution state
        setCurrentExecution(null);
      }
      
      // Load messages from backend if synced but no messages loaded yet
      if (activeConversation.synced && activeConversation.messageCount > 0 && activeConversation.messages.length === 0) {
        const username = user?.username || 'guest';
        console.log('[App] Loading messages for session:', activeConversationId);
        loadChatMessages(username, activeConversationId);
        setMessages([]); // Set empty while loading
      } else {
        // Use cached messages
        console.log('[App] Using cached messages:', activeConversation.messages?.length || 0);
        setMessages(activeConversation.messages || []);
      }
    } else {
      // Not a switch - check if messages were loaded asynchronously and need to be synced
      // This handles the case when loadChatMessages completes
      if (activeConversation.messages.length > 0 && activeConversation.messages.length !== messages.length) {
        console.log('[App] Syncing messages from store:', activeConversation.messages.length);
        setMessages(activeConversation.messages);
      }
    }
  }, [activeConversationId, activeConversation, user, loadChatMessages, messages.length, isInitialized, executionsByConversation, executingConversationId]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentExecution, scrollToBottom]);

  // Handle send message
  const handleSend = useCallback(async (content) => {
    if (!content.trim() || !isConnected) return;
    
    const username = user?.username || 'guest';
    
    // Create a new conversation if none active
    let currentConvId = activeConversationId;
    if (!currentConvId) {
      currentConvId = await createConversation(username);
      // Wait a tick for state to update
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content,
      timestamp: new Date(),
    };

    // Add user message locally
    setMessages((prev) => [...prev, userMessage]);
    
    // Save to store (which syncs to backend)
    await addMessage(userMessage, username);

    // Track which conversation this execution belongs to
    setExecutingConversation(currentConvId);
    executingConvIdRef.current = currentConvId;

    // Set immediate execution state with loading indicator (single box for progress)
    // Don't set agents - let the WebSocket handler create them properly
    const initialExecution = {
      stage: 'initializing',
      stageMessage: 'Processing your query...',
      isLoading: true,
      agents: null,  // null means "waiting for agents", not empty array
      plan: null,
      query: content, // Include the user's query for history display
      startedAt: new Date().toISOString(),
    };
    
    setCurrentExecution(initialExecution);
    setConversationExecution(currentConvId, initialExecution);

    // Send to WebSocket with session_id for tracking
    sendMessage({ query: content, session_id: currentConvId });
  }, [isConnected, sendMessage, user, activeConversationId, createConversation, addMessage, setExecutingConversation, setConversationExecution]);

  // Handle stop execution
  const handleStop = useCallback(() => {
    // Send stop signal - let the backend response handler clear the execution
    sendMessage({ type: 'stop' });
    // Don't clear execution here - wait for 'stopped' message from backend
  }, [sendMessage]);

  // Toggle step expansion
  const toggleStep = useCallback((key) => {
    setExpandedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  // Sync theme on mount (handles hydration from localStorage)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  
  // Sync theme changes to backend (debounced to avoid excessive calls)
  const lastSyncedTheme = useRef(null);
  useEffect(() => {
    // Only sync if authenticated (not guest) and theme actually changed
    if (isAuthenticated && !isGuest && theme && theme !== lastSyncedTheme.current) {
      lastSyncedTheme.current = theme;
      // Debounce the update to avoid rapid calls during hydration
      const timer = setTimeout(() => {
        updateProfile({ theme }).catch(() => {
          // Ignore errors - local storage is the primary source
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [theme, isAuthenticated, isGuest, updateProfile]);

  // Block input when ANY execution is running (current or background)
  const isProcessing = !!currentExecution || !!executingConversationId;
  
  // Check if we're viewing the executing conversation (for showing stop button)
  const isViewingExecutingConversation = executingConversationId === activeConversationId;
  
  // Determine loading message
  const loadingMessage = loading 
    ? 'Authenticating...' 
    : isLoadingChats 
      ? 'Loading your conversations...' 
      : 'Preparing workspace...';
  
  // Show loading screen while auth is loading OR chats are loading for authenticated user
  const showLoadingScreen = loading || (isAuthenticated && !isInitialized);
  
  if (showLoadingScreen) {
    return <LoadingScreen message={loadingMessage} />;
  }

  return (
    <div className="flex h-screen overflow-hidden transition-colors duration-200 bg-slate-50 dark:bg-gray-950">
      
      {/* Toast notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'bg-white dark:bg-gray-800 text-slate-700 dark:text-white shadow-lg border border-slate-200/50 dark:border-gray-700',
          duration: 4000,
        }}
      />
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => toggleSidebar()}
        onOpenSettings={() => toggleSettings()}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header
          user={stableUser}
          isGuest={isGuest}
          isConnected={isConnected}
          showExecutionDetails={showExecutionDetails}
          onToggleExecutionDetails={toggleExecutionDetails}
          onShowProfile={() => setShowProfile(true)}
          onToggleSidebar={toggleSidebar}
          sidebarOpen={sidebarOpen}
          onToggleWorkflow={toggleAgentFlow}
          showWorkflow={showAgentFlow}
          hasActiveExecution={!!currentExecution}
        />

        {/* Content Area with Agent Flow */}
        <div className="flex-1 flex overflow-hidden">
          {/* Messages Area */}
          <motion.div 
            className="flex-1 flex flex-col overflow-hidden"
            layout
            transition={{ duration: 0.3 }}
          >
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-hide">
              {messages.length === 0 && !currentExecution && <EmptyState />}

              <AnimatePresence mode="sync">
                {messages.map((message, index) => (
                  <MessageBubble
                    key={message.id || `msg-${index}`}
                    message={message}
                    messageId={index}
                    toggleStep={toggleStep}
                    expandedSteps={expandedSteps}
                    showExecutionDetails={showExecutionDetails}
                    onViewWorkflow={(execution) => setViewingExecution(execution)}
                    onRetry={handleSend}
                    isLatestMessage={index === messages.length - 1}
                    hasActiveExecution={!!currentExecution}
                    onPreviewArtifact={setPreviewArtifact}
                  />
                ))}
              </AnimatePresence>

              {/* Unified execution view - shows progress during execution, summary when complete */}
              {currentExecution && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <ExecutionView
                    execution={currentExecution}
                    variant="auto"
                    showAvatar={true}
                    onRetry={handleSend}
                  />
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <EnhancedChatInput
              onSend={handleSend}
              onStop={handleStop}
              disabled={!isConnected}
              isProcessing={isProcessing}
              showSuggestions={messages.length === 0 && !isProcessing}
              disabledMessage={
                executingConversationId && executingConversationId !== activeConversationId
                  ? 'A query is running in another chat...'
                  : undefined
              }
            />
          </motion.div>

          {/* Workflow Visualization Panel - GitHub Actions style */}
          <AnimatePresence>
            {showAgentFlow && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 450, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="h-full border-l border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/50 overflow-hidden flex flex-col"
              >
                <WorkflowVisualization 
                  execution={currentExecution || lastExecution} 
                  executionHistory={messages
                    .filter(m => m.type === 'assistant' && m.execution)
                    .map((m, idx, arr) => {
                      // Find the user message before this assistant message to get the query
                      const msgIndex = messages.indexOf(m);
                      const userMsg = messages.slice(0, msgIndex).reverse().find(msg => msg.type === 'user');
                      return {
                        ...m.execution,
                        query: m.execution.query || userMsg?.content || `Execution #${arr.length - idx}`,
                      };
                    })
                  }
                  onSelectExecution={setViewingExecution}
                  onClose={toggleAgentFlow}
                  isPanel={true}
                  isLive={!!currentExecution}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
      <SettingsPanel isOpen={settingsOpen} onClose={() => toggleSettings()} />
      
      {/* Past Execution Workflow Modal */}
      <AnimatePresence>
        {viewingExecution && (
          <WorkflowVisualization
            execution={viewingExecution}
            onClose={() => setViewingExecution(null)}
            isPanel={false}
          />
        )}
      </AnimatePresence>
      
      {/* Artifact Preview Panel - Claude style */}
      <ArtifactPreviewPanel
        artifact={previewArtifact}
        isOpen={!!previewArtifact}
        onClose={() => setPreviewArtifact(null)}
      />
    </div>
  );
}

export default App;
