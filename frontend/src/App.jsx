/**
 * Main App — Magentic studio workspace
 * Chat + live YAML workflow + steps rail + human-in-the-loop
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
  SettingsPanel,
  WorkflowVisualization,
  ArtifactPreviewPanel,
  StudioWorkspace,
} from './components';
import { useUIStore, useConnectionStore } from './store';

function App() {
  const { user, isAuthenticated, isGuest, loading, updateProfile } = useAuth();
  
  const stableUser = useMemo(() => ({
    username: user?.username,
    display_name: user?.display_name,
    avatar_emoji: user?.avatar_emoji,
  }), [user?.username, user?.display_name, user?.avatar_emoji]);
  
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
  
  useThemeSync(user, isAuthenticated, isGuest, updateProfile);
  
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
  
  const [showProfile, setShowProfile] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [viewingExecution, setViewingExecution] = useState(null);
  const [previewArtifact, setPreviewArtifact] = useState(null);
  const [executionEngine, setExecutionEngine] = useState(null);
  const [ropexStatus, setRopexStatus] = useState(null);
  const [requireApproval, setRequireApproval] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const poll = async () => {
      try {
        const res = await fetch(`${apiBase}/health`);
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        setExecutionEngine(body.execution_engine || null);
        setRopexStatus(body.ropex?.status || null);
        if (typeof body.ropex_require_approval === 'boolean') {
          setRequireApproval(body.ropex_require_approval);
        }
      } catch {
        /* API may still be starting */
      }
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const { isConnected, sendMessage } = useWebSocket(
    user,
    isAuthenticated,
    handleWebSocketMessage
  );

  useEffect(() => {
    setConnected(isConnected);
  }, [isConnected, setConnected]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const timer = setTimeout(() => setShowLogin(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShowLogin(false);
    }
  }, [loading, isAuthenticated]);

  const handleSend = useCallback(async (content) => {
    if (!content.trim() || !isConnected) return;
    await sendChatMessage(content, sendMessage);
  }, [isConnected, sendChatMessage, sendMessage]);

  const handleStop = useCallback(() => {
    sendMessage({ type: 'stop' });
  }, [sendMessage]);

  const handleApprove = useCallback((pipelineId) => {
    if (!pipelineId) return;
    sendMessage({ type: 'approve', pipeline_id: pipelineId });
  }, [sendMessage]);

  const handleReject = useCallback((pipelineId) => {
    if (!pipelineId) return;
    sendMessage({ type: 'reject', pipeline_id: pipelineId });
  }, [sendMessage]);

  const openProfile = useCallback(() => setShowProfile(true), []);
  const closeProfile = useCallback(() => setShowProfile(false), []);
  const closeLogin = useCallback(() => setShowLogin(false), []);
  const closeSettings = useCallback(() => toggleSettings(), [toggleSettings]);
  const closeViewingExecution = useCallback(() => setViewingExecution(null), []);
  const closeArtifactPreview = useCallback(() => setPreviewArtifact(null), []);

  const isActivelyExecuting = currentExecution && 
    currentExecution.stage !== 'complete' && 
    currentExecution.stage !== 'stopped';
  const isProcessing = isActivelyExecuting || 
    (executingConversationId && executingConversationId !== activeConversationId);
  
  const loadingMessage = loading 
    ? 'Authenticating...' 
    : isLoadingChats 
      ? 'Loading your conversations...' 
      : 'Preparing studio...';
  
  const showLoadingScreen = loading || (isAuthenticated && !isInitialized);
  
  if (showLoadingScreen) {
    return <LoadingScreen message={loadingMessage} />;
  }

  return (
    <div className="relative flex h-screen overflow-hidden transition-colors duration-200 bg-[#eef3f8] dark:bg-slate-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80 dark:opacity-45"
        style={{
          background:
            'radial-gradient(ellipse 65% 45% at 8% 0%, rgba(14,165,233,0.12), transparent 55%), radial-gradient(ellipse 45% 35% at 92% 8%, rgba(20,184,166,0.10), transparent 50%), radial-gradient(ellipse 40% 30% at 50% 100%, rgba(14,165,233,0.06), transparent 50%)',
        }}
      />
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'bg-white dark:bg-gray-800 text-slate-700 dark:text-white shadow-lg border border-slate-200/50 dark:border-gray-700',
          duration: 4000,
        }}
      />
      
      <div className="relative z-10 flex h-full w-full min-w-0">
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
          executionEngine={executionEngine}
          ropexStatus={ropexStatus}
          requireApproval={requireApproval}
          awaitingApproval={currentExecution?.stage === 'awaiting_approval'}
        />

        <div className="flex-1 flex overflow-hidden">
          <motion.div 
            className="flex-1 flex flex-col overflow-hidden min-w-0"
            layout
            transition={{ duration: 0.3 }}
          >
            <StudioWorkspace
              messages={messages}
              currentExecution={currentExecution}
              onRetry={handleSend}
              onPreviewArtifact={setPreviewArtifact}
              showExecutionDetails={showExecutionDetails}
              onSend={handleSend}
              onStop={handleStop}
              onApprove={handleApprove}
              onReject={handleReject}
              isConnected={isConnected}
              isProcessing={isProcessing}
              disabled={Boolean(
                executingConversationId && executingConversationId !== activeConversationId
              )}
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
                className="hidden xl:flex h-full border-l border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/50 overflow-hidden flex-col"
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
