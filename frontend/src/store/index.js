/**
 * Global state management with Zustand
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Chat store - manages conversations and messages
export const useChatStore = create(
  persist(
    (set, get) => ({
      // Conversations
      conversations: [],
      activeConversationId: null,
      isLoading: false,
      isInitialized: false, // True after first load completes
      
      // Execution state per conversation (keyed by conversation ID)
      executionsByConversation: {},
      // Which conversation is currently executing (may be different from active)
      executingConversationId: null,
      
      // Load chats from backend
      loadChats: async (username) => {
        if (!username) return;
        
        // Wait for hydration to complete (so activeConversationId is loaded from localStorage)
        // Use a promise that resolves when _hasHydrated becomes true
        const waitForHydration = async () => {
          // Check if already hydrated
          if (useChatStore.getState()._hasHydrated) {
            return;
          }
          
          // Wait for hydration with timeout
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              resolve();
            }, 500); // 500ms timeout
            
            const unsubscribe = useChatStore.subscribe((state) => {
              if (state._hasHydrated) {
                clearTimeout(timeout);
                unsubscribe();
                resolve();
              }
            });
          });
        };
        
        await waitForHydration();
        
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_URL}/chats/${username}`);
          if (response.ok) {
            const data = await response.json();
            
            // Get activeConversationId after hydration
            const { activeConversationId } = useChatStore.getState();
            
            const loadedConversations = data.chats.map(chat => ({
              id: chat.id,
              title: chat.title,
              messages: [], // Messages loaded on demand
              createdAt: chat.createdAt,
              updatedAt: chat.updatedAt,
              messageCount: chat.messageCount,
              synced: true,
            }));
            
            // Check if saved activeConversationId exists in loaded chats
            const activeExists = activeConversationId && loadedConversations.some(c => c.id === activeConversationId);
            
            // Determine which conversation to select:
            // 1. Persisted ID if it exists in chats
            // 2. Most recent chat (first in list, sorted by updatedAt desc)
            // 3. null if no chats
            const selectedId = activeExists 
              ? activeConversationId 
              : (loadedConversations[0]?.id || null);
            
            set({
              conversations: loadedConversations,
              activeConversationId: selectedId,
            });
          }
        } catch (error) {
          console.error('Failed to load chats:', error);
        } finally {
          set({ isLoading: false, isInitialized: true });
        }
      },
      
      // Load messages for a specific chat
      loadChatMessages: async (username, sessionId) => {
        if (!username || !sessionId) return;
        try {
          const response = await fetch(`${API_URL}/chats/${username}/${sessionId}`);
          if (response.ok) {
            const data = await response.json();
            set((state) => ({
              conversations: state.conversations.map(conv =>
                conv.id === sessionId
                  ? {
                      ...conv,
                      messages: data.messages.map(msg => ({
                        id: msg.id,
                        type: msg.role,
                        content: msg.content,
                        timestamp: msg.timestamp,
                        execution: msg.executionData, // Map to 'execution' for MessageBubble compatibility
                        // Extract artifacts and references from executionData for display
                        artifacts: msg.executionData?.artifacts || [],
                        references: msg.executionData?.references || [],
                      })),
                    }
                  : conv
              ),
            }));
          }
        } catch (error) {
          console.error('Failed to load messages:', error);
        }
      },
      
      // Create new conversation
      createConversation: async (username, title = 'New Chat') => {
        // Create locally first for instant feedback
        const tempId = `conv_${Date.now()}`;
        const conversation = {
          id: tempId,
          title,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          synced: false,
        };
        
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: tempId,
        }));
        
        // Sync with backend if username provided
        if (username) {
          try {
            const response = await fetch(`${API_URL}/chats`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, title }),
            });
            if (response.ok) {
              const data = await response.json();
              // Update local conversation with server ID
              set((state) => ({
                conversations: state.conversations.map(conv =>
                  conv.id === tempId
                    ? { ...conv, id: data.chat.id, synced: true }
                    : conv
                ),
                activeConversationId: data.chat.id,
              }));
              return data.chat.id;
            }
          } catch (error) {
            console.error('Failed to create chat on server:', error);
          }
        }
        
        return tempId;
      },
      
      // Set active conversation
      setActiveConversation: (id) => set({ activeConversationId: id }),
      
      // Set which conversation is executing
      setExecutingConversation: (id) => set({ executingConversationId: id }),
      
      // Save execution state for a conversation
      setConversationExecution: (conversationId, execution) => {
        if (!conversationId) return;
        set((state) => ({
          executionsByConversation: {
            ...state.executionsByConversation,
            [conversationId]: execution,
          },
        }));
      },
      
      // Get execution state for a conversation
      getConversationExecution: (conversationId) => {
        return get().executionsByConversation[conversationId] || null;
      },
      
      // Clear execution state for a conversation
      clearConversationExecution: (conversationId) => {
        if (!conversationId) return;
        set((state) => {
          const { [conversationId]: _, ...rest } = state.executionsByConversation;
          return {
            executionsByConversation: rest,
            executingConversationId: state.executingConversationId === conversationId 
              ? null 
              : state.executingConversationId,
          };
        });
      },
      
      // Add message to a SPECIFIC conversation (for background execution completion)
      addMessageToConversation: async (conversationId, message, username) => {
        if (!conversationId) {
          console.warn('addMessageToConversation called with no conversationId');
          return;
        }
        
        const { conversations } = get();
        const targetConv = conversations.find(c => c.id === conversationId);
        if (!targetConv) {
          console.warn('addMessageToConversation: conversation not found:', conversationId);
          return;
        }
        
        const msgId = `msg_${Date.now()}`;
        const executionData = message.executionData || message.execution || null;
        
        const normalizedMessage = {
          id: msgId,
          type: message.type,
          content: message.content,
          timestamp: message.timestamp || new Date(),
          execution: executionData,
          artifacts: message.artifacts || executionData?.artifacts || [],
          references: message.references || executionData?.references || [],
        };
        
        const executionDataForBackend = executionData ? {
          ...executionData,
          artifacts: message.artifacts || executionData.artifacts || [],
          references: message.references || executionData.references || [],
        } : null;
        
        // Update local state for the SPECIFIC conversation
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, normalizedMessage],
                  updatedAt: new Date().toISOString(),
                }
              : conv
          ),
        }));
        
        // Sync with backend
        if (username && conversationId.startsWith('chat_')) {
          try {
            const response = await fetch(`${API_URL}/chats/${conversationId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                role: message.type,
                content: message.content,
                execution_data: executionDataForBackend,
              }),
            });
            if (response.ok) {
              const data = await response.json();
              if (data.chatTitle && data.chatTitle !== 'New Chat') {
                set((state) => ({
                  conversations: state.conversations.map(conv =>
                    conv.id === conversationId
                      ? { ...conv, title: data.chatTitle }
                      : conv
                  ),
                }));
              }
            }
          } catch (error) {
            console.error('Failed to save message to conversation:', error);
          }
        }
      },
      
      // Add message to active conversation
      addMessage: async (message, username) => {
        // Always get fresh state
        const { activeConversationId, conversations } = get();
        
        // If no active conversation, skip (shouldn't happen if createConversation was called)
        if (!activeConversationId) {
          return;
        }
        
        const msgId = `msg_${Date.now()}`;
        const activeConv = conversations.find(c => c.id === activeConversationId);
        const isFirstUserMessage = activeConv?.messages.length === 0 && message.type === 'user';
        const newTitle = isFirstUserMessage 
          ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
          : null;
        
        // Get execution data, ensuring artifacts and references are included
        const executionData = message.executionData || message.execution || null;
        
        // Normalize message format - use 'execution' for consistency with MessageBubble
        // Also preserve artifacts and references at message level for display
        const normalizedMessage = {
          id: msgId,
          type: message.type,
          content: message.content,
          timestamp: message.timestamp || new Date(),
          execution: executionData,
          // Preserve artifacts and references - they come from message OR execution
          artifacts: message.artifacts || executionData?.artifacts || [],
          references: message.references || executionData?.references || [],
        };
        
        // Prepare execution_data for backend - ensure artifacts/references are included
        const executionDataForBackend = executionData ? {
          ...executionData,
          artifacts: message.artifacts || executionData.artifacts || [],
          references: message.references || executionData.references || [],
        } : null;
        
        // Update local state
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === activeConversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, normalizedMessage],
                  updatedAt: new Date().toISOString(),
                  title: newTitle || conv.title,
                }
              : conv
          ),
        }));
        
        // Sync with backend if conversation is synced (has chat_ prefix)
        if (username && activeConversationId.startsWith('chat_')) {
          try {
            const response = await fetch(`${API_URL}/chats/${activeConversationId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                role: message.type,
                content: message.content,
                execution_data: executionDataForBackend,
              }),
            });
            if (response.ok) {
              const data = await response.json();
              // Update title if changed by backend
              if (data.chatTitle && data.chatTitle !== 'New Chat') {
                set((state) => ({
                  conversations: state.conversations.map(conv =>
                    conv.id === activeConversationId
                      ? { ...conv, title: data.chatTitle }
                      : conv
                  ),
                }));
              }
            }
          } catch (error) {
            console.error('Failed to save message:', error);
          }
        }
      },
      
      // Update last message (for streaming)
      updateLastMessage: (updates) => {
        const { activeConversationId, conversations } = get();
        if (!activeConversationId) return;
        
        set({
          conversations: conversations.map((conv) =>
            conv.id === activeConversationId
              ? {
                  ...conv,
                  messages: conv.messages.map((msg, idx) =>
                    idx === conv.messages.length - 1 ? { ...msg, ...updates } : msg
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : conv
          ),
        });
      },
      
      // Delete conversation
      deleteConversation: async (id, username) => {
        const { conversations, activeConversationId } = get();
        const newConversations = conversations.filter((c) => c.id !== id);
        set({
          conversations: newConversations,
          activeConversationId:
            activeConversationId === id
              ? newConversations[0]?.id || null
              : activeConversationId,
        });
        
        // Delete from backend
        if (username && id.startsWith('chat_')) {
          try {
            await fetch(`${API_URL}/chats/${id}`, { method: 'DELETE' });
          } catch (error) {
            console.error('Failed to delete chat:', error);
          }
        }
      },
      
      // Clear all conversations
      clearAll: () => set({ conversations: [], activeConversationId: null }),
      
      // Get active conversation
      getActiveConversation: () => {
        const { conversations, activeConversationId } = get();
        return conversations.find((c) => c.id === activeConversationId);
      },
      
      // Hydration state - tracks when localStorage state is restored
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: 'magentic-chat-storage',
      partialize: (state) => ({
        // Don't persist conversations - use backend as source of truth
        // Only persist the active conversation ID for UX continuity
        activeConversationId: state.activeConversationId,
      }),
      onRehydrateStorage: (state) => {
        // Return a callback that will be called after hydration
        return (hydratedState, error) => {
          // Mark hydration complete using the state's own action
          // Use setTimeout to ensure store is fully initialized
          setTimeout(() => {
            useChatStore.getState().setHasHydrated(true);
          }, 0);
        };
      },
    }
  )
);

// UI Store - manages UI state
export const useUIStore = create(
  persist(
    (set) => ({
      // Sidebar
      sidebarOpen: true,
      sidebarWidth: 280,
      
      // Theme
      theme: 'dark', // 'dark' | 'light' | 'system'
      
      // View settings
      showExecutionDetails: true,
      showAgentGraph: false,
      showAgentFlow: false,
      compactMode: false,
      
      // Settings panel
      settingsOpen: false,
      
      // Expanded steps
      expandedSteps: new Set(),
      
      // Actions
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
      
      setTheme: (theme) => {
        // Update DOM
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        set({ theme });
      },
      toggleExecutionDetails: () => set((state) => ({ showExecutionDetails: !state.showExecutionDetails })),
      toggleAgentGraph: () => set((state) => ({ showAgentGraph: !state.showAgentGraph })),
      toggleAgentFlow: () => set((state) => ({ showAgentFlow: !state.showAgentFlow })),
      toggleCompactMode: () => set((state) => ({ compactMode: !state.compactMode })),
      
      toggleStep: (key) => set((state) => {
        const newSet = new Set(state.expandedSteps);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        return { expandedSteps: newSet };
      }),
    }),
    {
      name: 'magentic-ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        showExecutionDetails: state.showExecutionDetails,
        compactMode: state.compactMode,
        sidebarWidth: state.sidebarWidth,
        sidebarOpen: state.sidebarOpen,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply theme to DOM after hydration from localStorage
        if (state?.theme) {
          if (state.theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      },
    }
  )
);

// Execution Store - manages current execution state
export const useExecutionStore = create((set) => ({
  currentExecution: null,
  isExecuting: false,
  
  setExecution: (execution) => set({ currentExecution: execution }),
  setIsExecuting: (isExecuting) => set({ isExecuting }),
  clearExecution: () => set({ currentExecution: null, isExecuting: false }),
  
  // Update agent status within execution
  updateAgentStatus: (agentId, status) => set((state) => {
    if (!state.currentExecution) return state;
    return {
      currentExecution: {
        ...state.currentExecution,
        agents: state.currentExecution.agents?.map((a) =>
          a.agent_id === agentId ? { ...a, ...status } : a
        ) || [],
      },
    };
  }),
}));

// Connection Store
export const useConnectionStore = create((set) => ({
  isConnected: false,
  reconnecting: false,
  lastError: null,
  
  setConnected: (isConnected) => set({ isConnected, reconnecting: false }),
  setReconnecting: (reconnecting) => set({ reconnecting }),
  setError: (error) => set({ lastError: error }),
}));

// Knowledge Base Store - manages document uploads and KB state
export const useKnowledgeBaseStore = create((set, get) => ({
  sources: [],
  isLoading: false,
  uploadProgress: null, // { status: 'uploading' | 'success' | 'error', message: string, progress: number }
  showPanel: false,

  setShowPanel: (show) => set({ showPanel: show }),
  togglePanel: () => set((state) => ({ showPanel: !state.showPanel })),

  fetchSources: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_URL}/documents/sources`);
      if (response.ok) {
        const data = await response.json();
        set({ sources: data.sources || [] });
      } else if (response.status === 503) {
        // RAG service not enabled - silently ignore
        set({ sources: [] });
      }
    } catch (error) {
      console.error('Failed to fetch KB sources:', error);
    }
    set({ isLoading: false });
  },

  deleteSource: async (source) => {
    try {
      const response = await fetch(`${API_URL}/documents/${encodeURIComponent(source)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        set((state) => ({ sources: state.sources.filter(s => s !== source) }));
        return true;
      }
    } catch (error) {
      console.error('Failed to delete source:', error);
    }
    return false;
  },

  uploadFiles: async (files) => {
    if (!files || files.length === 0) return;

    set({ uploadProgress: { status: 'uploading', message: 'Uploading...', progress: 0 } });

    try {
      const formData = new FormData();
      let endpoint = '';
      
      if (files.length === 1) {
        formData.append('file', files[0]);
        endpoint = `${API_URL}/documents/upload`;
      } else {
        files.forEach(file => formData.append('files', file));
        endpoint = `${API_URL}/documents/upload-multiple`;
      }

      // Use XMLHttpRequest for real progress tracking
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            // Upload progress is 0-80%, processing is 80-100%
            const percent = Math.round((event.loaded / event.total) * 80);
            set({ uploadProgress: { status: 'uploading', message: 'Uploading...', progress: percent } });
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              reject(new Error('Invalid response'));
            }
          } else {
            try {
              const errData = JSON.parse(xhr.responseText);
              reject(new Error(errData.detail || 'Upload failed'));
            } catch (e) {
              reject(new Error('Upload failed'));
            }
          }
        });
        
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
        
        // Show processing state once upload completes
        xhr.upload.addEventListener('loadend', () => {
          set({ uploadProgress: { status: 'uploading', message: 'Processing...', progress: 85 } });
        });
        
        xhr.open('POST', endpoint);
        xhr.send(formData);
      });

      const data = result;
      if (data.success || data.successful > 0) {
        const msg = files.length === 1
          ? `${data.filename} added to knowledge base`
          : `${data.successful} file(s) added to knowledge base`;
        set({ uploadProgress: { status: 'success', message: msg, progress: 100 } });
        // Refresh sources
        get().fetchSources();
      } else {
        set({ uploadProgress: { status: 'error', message: data.detail || 'Upload failed', progress: 0 } });
      }
    } catch (error) {
      set({ uploadProgress: { status: 'error', message: error.message || 'Upload failed', progress: 0 } });
    }

    // Clear progress after delay
    setTimeout(() => {
      set({ uploadProgress: null });
    }, 3000);
  },

  clearProgress: () => set({ uploadProgress: null }),
}));
