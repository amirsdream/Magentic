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
  ProfileModal,
  Sidebar,
  MessageBubble,
  EnhancedChatInput,
  AgentFlowGraph,
  SettingsPanel,
  ExecutionView,
  WorkflowVisualization,
} from './components';
import { useUIStore, useExecutionStore, useConnectionStore, useChatStore } from './store';

function App() {
  const { user, isAuthenticated, isGuest, loading } = useAuth();
  
  // Memoize user data to prevent unnecessary re-renders
  const stableUser = useMemo(() => ({
    username: user?.username,
    display_name: user?.display_name,
    avatar_emoji: user?.avatar_emoji,
  }), [user?.username, user?.display_name, user?.avatar_emoji]);
  
  // Chat store for persistence - only get what we need to avoid re-renders
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const loadChats = useChatStore((state) => state.loadChats);
  const createConversation = useChatStore((state) => state.createConversation);
  const addMessage = useChatStore((state) => state.addMessage);
  
  // Local state for current session messages
  const [messages, setMessages] = useState([]);
  const [currentExecution, setCurrentExecution] = useState(null);
  const [lastExecution, setLastExecution] = useState(null); // Keep last completed execution
  const [viewingExecution, setViewingExecution] = useState(null); // For viewing past executions
  
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

  // Keep execution ref in sync with state
  useEffect(() => {
    executionRef.current = currentExecution;
  }, [currentExecution]);

  // Message handler for WebSocket
  const handleWebSocketMessage = useCallback((data) => {
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
    
    processWebSocketMessage(data, setCurrentExecution, setMessages, executionRef);
    
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
      
      // Save as last execution for quick access
      if (executionData) {
        setLastExecution(executionData);
      }
      
      addMessage({
        type: 'assistant',
        content: data.data.output,
        execution: executionData,
        timestamp: new Date(),
      }, username);
    }
    
    // Save stopped execution to chat store (for backend persistence)
    if (data.type === 'stopped') {
      const username = user?.username || 'guest';
      
      // Save as last execution
      if (stoppedExecutionData) {
        setLastExecution(stoppedExecutionData);
      }
      
      // Add message with captured execution data
      addMessage({
        type: 'assistant',
        content: data.message || 'Execution stopped by user',
        execution: stoppedExecutionData,
        timestamp: new Date(),
      }, username);
    }
  }, [setExecution, user, addMessage, setLastExecution]);

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

  // Sync theme from user profile when first logged in (only once)
  const [themeSynced, setThemeSynced] = React.useState(false);
  useEffect(() => {
    if (user?.theme && !themeSynced) {
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
  const prevConversationIdRef = useRef(activeConversationId);
  
  // Load messages from backend when needed
  const loadChatMessages = useChatStore((state) => state.loadChatMessages);
  const conversations = useChatStore((state) => state.conversations);
  
  // Sync messages when conversation SWITCHES (not on every message add)
  useEffect(() => {
    // Skip if no active conversation
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    
    // Find the active conversation
    const activeConv = conversations.find(c => c.id === activeConversationId);
    
    // Skip if conversation not found (might be loading)
    if (!activeConv) {
      return;
    }
    
    // Check if this is a conversation switch or initial load
    const isSwitch = prevConversationIdRef.current !== activeConversationId;
    if (isSwitch) {
      prevConversationIdRef.current = activeConversationId;
      setCurrentExecution(null); // Reset execution state for new/switched chat
      
      // Only sync messages on conversation switch
      if (activeConv.synced && activeConv.messageCount > 0 && activeConv.messages.length === 0) {
        const username = user?.username || 'guest';
        loadChatMessages(username, activeConversationId);
        // Set empty messages immediately, they'll be updated when loadChatMessages completes
        setMessages([]);
      } else {
        setMessages(activeConv.messages || []);
      }
    } else {
      // If not a switch but messages were loaded from backend, sync them
      // This handles the case when loadChatMessages completes asynchronously
      if (activeConv.messages.length > 0 && messages.length === 0) {
        setMessages(activeConv.messages);
      }
    }
  }, [activeConversationId, conversations, user, loadChatMessages]);

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
      type: 'user',
      content,
      timestamp: new Date(),
    };

    // Add user message locally
    setMessages((prev) => [...prev, userMessage]);
    
    // Save to store (which syncs to backend)
    await addMessage(userMessage, username);

    // Set immediate execution state with loading indicator (single box for progress)
    setCurrentExecution({
      stage: 'initializing',
      stageMessage: 'Processing your query...',
      isLoading: true,
      agents: [],
      plan: null,
      query: content, // Include the user's query for history display
      startedAt: new Date().toISOString(),
    });

    // Send to WebSocket with session_id for tracking
    sendMessage({ query: content, session_id: currentConvId });
  }, [isConnected, sendMessage, user, activeConversationId, createConversation, addMessage]);

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

  const isProcessing = !!currentExecution;

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

              <AnimatePresence mode="popLayout">
                {messages.map((message, index) => (
                  <MessageBubble
                    key={`msg-${index}`}
                    message={message}
                    messageId={index}
                    toggleStep={toggleStep}
                    expandedSteps={expandedSteps}
                    showExecutionDetails={showExecutionDetails}
                    onViewWorkflow={(execution) => setViewingExecution(execution)}
                    isLatestMessage={index === messages.length - 1}
                    hasActiveExecution={!!currentExecution}
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
              showSuggestions={messages.length === 0}
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
                className="border-l border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/50 overflow-hidden"
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
    </div>
  );
}

export default App;
