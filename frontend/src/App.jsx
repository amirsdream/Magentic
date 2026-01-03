/**
 * Main App component - Magentic chat interface v3.0
 * Redesigned with animated UI and agent visualization
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';
import { useWebSocket, useChat, useThemeSync } from './hooks';
import {
  Header,
  LoginModal,
  LoadingScreen,
  ProfileModal,
  Sidebar,
  EnhancedChatInput,
  SettingsPanel,
  WorkflowVisualization,
  ArtifactPreviewPanel,
  ChatArea,
} from './components';
import { useUIStore, useConnectionStore } from './store';

function App() {
  const { user, isAuthenticated, isGuest, loading, updateProfile } = useAuth();
  
  // Memoize user data to prevent unnecessary re-renders
  const stableUser = useMemo(() => ({
    username: user?.username,
    display_name: user?.display_name,
    avatar_emoji: user?.avatar_emoji,
  }), [user?.username, user?.display_name, user?.avatar_emoji]);
  
  // Use chat hook for all chat state and logic
  const {
    messages,
    currentExecution,
    activeConversationId,
    executingConversationId,
    isInitialized,
    isLoadingChats,
    executionHistory,
    handleWebSocketMessage,
    sendChatMessage,
  } = useChat(user, isAuthenticated);
  
  // Theme sync hook
  useThemeSync(user, isAuthenticated, isGuest, updateProfile);
  
  // UI stores
  const {
    sidebarOpen,
    settingsOpen,
    showExecutionDetails,
    showAgentFlow,
    toggleSidebar,
    toggleSettings,
    toggleExecutionDetails,
    toggleAgentFlow,
  } = useUIStore();
  
  const { setConnected } = useConnectionStore();
  
  // Local UI state
  const [showProfile, setShowProfile] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [viewingExecution, setViewingExecution] = useState(null);
  const [previewArtifact, setPreviewArtifact] = useState(null);

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

  // Show login modal if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const timer = setTimeout(() => setShowLogin(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShowLogin(false);
    }
  }, [loading, isAuthenticated]);

  // Handle send message
  const handleSend = useCallback(async (content) => {
    if (!content.trim() || !isConnected) return;
    await sendChatMessage(content, sendMessage);
  }, [isConnected, sendChatMessage, sendMessage]);

  // Handle stop execution
  const handleStop = useCallback(() => {
    sendMessage({ type: 'stop' });
  }, [sendMessage]);

  // Stable callbacks
  const openProfile = useCallback(() => setShowProfile(true), []);
  const closeProfile = useCallback(() => setShowProfile(false), []);
  const closeLogin = useCallback(() => setShowLogin(false), []);
  const closeSettings = useCallback(() => toggleSettings(), [toggleSettings]);
  const closeViewingExecution = useCallback(() => setViewingExecution(null), []);
  const closeArtifactPreview = useCallback(() => setPreviewArtifact(null), []);

  // Determine processing state
  const isActivelyExecuting = currentExecution && 
    currentExecution.stage !== 'complete' && 
    currentExecution.stage !== 'stopped';
  const isProcessing = isActivelyExecuting || 
    (executingConversationId && executingConversationId !== activeConversationId);
  
  // Loading state
  const loadingMessage = loading 
    ? 'Authenticating...' 
    : isLoadingChats 
      ? 'Loading your conversations...' 
      : 'Preparing workspace...';
  
  const showLoadingScreen = loading || (isAuthenticated && !isInitialized);
  
  if (showLoadingScreen) {
    return <LoadingScreen message={loadingMessage} />;
  }

  return (
    <div className="flex h-screen overflow-hidden transition-colors duration-200 bg-slate-50 dark:bg-gray-950">
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'bg-white dark:bg-gray-800 text-slate-700 dark:text-white shadow-lg border border-slate-200/50 dark:border-gray-700',
          duration: 4000,
        }}
      />
      
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={toggleSidebar}
        onOpenSettings={toggleSettings}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          user={stableUser}
          isGuest={isGuest}
          isConnected={isConnected}
          showExecutionDetails={showExecutionDetails}
          onToggleExecutionDetails={toggleExecutionDetails}
          onShowProfile={openProfile}
          onToggleSidebar={toggleSidebar}
          sidebarOpen={sidebarOpen}
          onToggleWorkflow={toggleAgentFlow}
          showWorkflow={showAgentFlow}
          hasActiveExecution={!!currentExecution && currentExecution.stage !== 'complete' && currentExecution.stage !== 'stopped'}
        />

        <div className="flex-1 flex overflow-hidden">
          <motion.div 
            className="flex-1 flex flex-col overflow-hidden"
            layout
            transition={{ duration: 0.3 }}
          >
            <ChatArea
              messages={messages}
              currentExecution={currentExecution}
              onRetry={handleSend}
              onPreviewArtifact={setPreviewArtifact}
              showExecutionDetails={showExecutionDetails}
            />

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
                  execution={currentExecution} 
                  executionHistory={executionHistory}
                  onSelectExecution={setViewingExecution}
                  onClose={toggleAgentFlow}
                  isPanel={true}
                  isLive={!!currentExecution && currentExecution.stage !== 'complete' && currentExecution.stage !== 'stopped'}
                  showHistoryAfterComplete={true}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <LoginModal isOpen={showLogin} onClose={closeLogin} />
      <ProfileModal isOpen={showProfile} onClose={closeProfile} />
      <SettingsPanel isOpen={settingsOpen} onClose={closeSettings} />
      
      <AnimatePresence>
        {viewingExecution && (
          <WorkflowVisualization
            execution={viewingExecution}
            onClose={closeViewingExecution}
            isPanel={false}
          />
        )}
      </AnimatePresence>
      
      <ArtifactPreviewPanel
        artifact={previewArtifact}
        isOpen={!!previewArtifact}
        onClose={closeArtifactPreview}
      />
    </div>
  );
}

export default App;
