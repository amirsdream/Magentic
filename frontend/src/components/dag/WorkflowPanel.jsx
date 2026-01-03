/**
 * WorkflowPanel - Main workflow visualization panel
 * Refactored from WorkflowVisualization.jsx into smaller, maintainable components
 */
import React, { useState, useEffect, useMemo, useCallback, createContext, useContext, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  Play,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';
import { useRoles } from '../../hooks/useRoles';
import { DEFAULT_ROLE_CONFIG } from './constants';

// Sub-components
import DAGView from './DAGView';
import CollapsedView from './CollapsedView';
import WorkflowHeader from './WorkflowHeader';
import HistoryView from './HistoryView';
import EmptyState from './EmptyState';
import StatusLegend from './StatusLegend';
import ListView from './ListView';

// Create context for roles
const RolesContext = createContext(null);

// Hook to use roles context
export const useRolesContext = () => {
  const context = useContext(RolesContext);
  if (!context) {
    return {
      getRole: (roleName) => {
        const normalized = roleName?.toLowerCase().replace(/\s+/g, '_');
        return DEFAULT_ROLE_CONFIG[normalized] || DEFAULT_ROLE_CONFIG.default;
      },
      roles: DEFAULT_ROLE_CONFIG,
      loading: false,
    };
  }
  return context;
};

// Inner component - memoized to prevent unnecessary re-renders
const WorkflowPanelInner = memo(function WorkflowPanelInner({ 
  execution, 
  executionHistory = [], 
  onSelectExecution,
  onClose, 
  onRetry,
  isPanel = false,
  isLive = false 
}) {
  const { getRole } = useRolesContext();
  const [expandedAgents, setExpandedAgents] = useState(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [viewMode, setViewMode] = useState('dag');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleAgent = useCallback((agentId) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }, []);

  // Create synthetic coordinator when execution starts but no agents yet
  const displayAgents = useMemo(() => {
    const executionStartTime = execution?.startedAt 
      ? new Date(execution.startedAt).getTime() 
      : null;
    
    if (execution?.agents && Array.isArray(execution.agents) && execution.agents.length > 0) {
      return execution.agents.map(agent => {
        if ((agent.layer ?? 0) === 0 && executionStartTime) {
          return { ...agent, startTime: executionStartTime };
        }
        return agent;
      });
    }
    
    if (execution) {
      const hasThinking = execution.thinkingContent && execution.thinkingContent.length > 0;
      const isStillRunning = execution.stage !== 'complete' && execution.stage !== 'stopped';
      return [{
        agent_id: 'coordinator_0',
        role: 'coordinator',
        task: execution.stageMessage || 'Analyzing query and creating execution plan...',
        layer: 0,
        status: isStillRunning ? 'running' : (execution.stage === 'complete' ? 'completed' : execution.stage),
        logs: hasThinking ? [{
          type: 'thinking',
          content: execution.thinkingContent,
          timestamp: new Date().toISOString(),
        }] : [],
        startTime: executionStartTime || Date.now(),
        endTime: !isStillRunning ? Date.now() : null,
      }];
    }
    
    return [];
  }, [execution?.agents, execution?.thinkingContent, execution?.startedAt, execution?.stage, execution?.stageMessage, execution]);

  // Auto-expand running agents
  useEffect(() => {
    const running = displayAgents.filter(a => a.status === 'running');
    if (running.length > 0) {
      setExpandedAgents(prev => {
        const next = new Set(prev);
        running.forEach(a => next.add(a.agent_id));
        return next;
      });
    }
  }, [displayAgents]);

  // Group agents by layer
  const layers = useMemo(() => {
    if (!displayAgents.length) return [];
    
    const layerMap = new Map();
    displayAgents.forEach(agent => {
      const layer = agent.layer || 0;
      if (!layerMap.has(layer)) {
        layerMap.set(layer, []);
      }
      layerMap.get(layer).push(agent);
    });
    
    return Array.from(layerMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([layer, agents]) => ({ layer, agents }));
  }, [displayAgents]);

  // Get fresh agent data for selected agent
  const currentSelectedAgent = useMemo(() => {
    if (!selectedAgent) return null;
    return displayAgents.find(a => a.agent_id === selectedAgent.agent_id) || selectedAgent;
  }, [selectedAgent, displayAgents]);

  // Calculate overall progress
  const progress = useMemo(() => {
    if (!displayAgents.length) return 0;
    const completed = displayAgents.filter(a => 
      a.status === 'completed' || a.status === 'complete'
    ).length;
    return Math.round((completed / displayAgents.length) * 100);
  }, [displayAgents]);

  // Execution state
  const isStopped = execution?.stage === 'stopped';
  const isComplete = execution?.stage === 'complete' || progress === 100;
  const canRetry = onRetry && execution?.query && (isStopped || isComplete);
  const hasExecution = !!execution;
  
  // Header configuration
  const headerIcon = !hasExecution ? (
    <Activity className="w-5 h-5 text-slate-400 dark:text-gray-500" />
  ) : progress === 100 ? (
    <CheckCircle className="w-5 h-5 text-green-400" />
  ) : isLive ? (
    <Play className="w-5 h-5 text-purple-400" />
  ) : (
    <Clock className="w-5 h-5 text-slate-400 dark:text-gray-500" />
  );
  
  const headerIconBg = !hasExecution ? 'bg-slate-100 dark:bg-gray-800' :
    progress === 100 ? 'bg-green-500/20' : 
    isLive ? 'bg-purple-500/20' : 
    'bg-slate-200 dark:bg-gray-800';
  
  const headerTitle = !hasExecution ? 'Workflow' :
    execution.query 
      ? (execution.query.length > 30 ? execution.query.slice(0, 30) + '...' : execution.query)
      : (isLive ? 'Live Execution' : 'Last Execution');
  
  const headerSubtitle = !hasExecution ? 'Execution flow visualization' :
    `${isLive ? '● ' : ''}${execution.plan?.total_agents || displayAgents.length || 0} agents • ${execution.plan?.total_layers || layers.length || 1} layers`;

  // Collapsed mini view
  if (isCollapsed && isPanel) {
    return (
      <CollapsedView
        headerIcon={headerIcon}
        headerIconBg={headerIconBg}
        hasExecution={hasExecution}
        isLive={isLive}
        progress={progress}
        displayAgents={displayAgents}
        executionHistory={executionHistory}
        onExpand={() => setIsCollapsed(false)}
        onShowHistory={() => { setIsCollapsed(false); setShowHistory(true); }}
      />
    );
  }

  const content = (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-gray-900">
      {/* Header */}
      <WorkflowHeader
        showHistory={showHistory}
        viewMode={viewMode}
        progress={progress}
        hasExecution={hasExecution}
        isLive={isLive}
        isPanel={isPanel}
        canRetry={canRetry}
        isStopped={isStopped}
        executionHistory={executionHistory}
        execution={execution}
        stageMessage={execution?.stageMessage}
        headerIcon={headerIcon}
        headerIconBg={headerIconBg}
        headerTitle={headerTitle}
        headerSubtitle={headerSubtitle}
        onSetShowHistory={setShowHistory}
        onSetViewMode={setViewMode}
        onRetry={onRetry}
        onCollapse={() => setIsCollapsed(true)}
        onClose={onClose}
      />

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <AnimatePresence mode="wait">
          {showHistory ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-5"
            >
              <HistoryView
                executionHistory={executionHistory}
                onSelectExecution={onSelectExecution}
                onCloseHistory={() => setShowHistory(false)}
              />
            </motion.div>
          ) : !hasExecution ? (
            <EmptyState
              key="empty"
              executionHistory={executionHistory}
              onShowHistory={() => setShowHistory(true)}
            />
          ) : (
            <motion.div
              key="workflow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-5"
            >
              {viewMode === 'dag' ? (
                <DAGView 
                  agents={displayAgents}
                  selectedAgent={currentSelectedAgent}
                  onSelectAgent={setSelectedAgent}
                  getRole={getRole}
                />
              ) : (
                <ListView
                  layers={layers}
                  expandedAgents={expandedAgents}
                  toggleAgent={toggleAgent}
                  getRole={getRole}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {!showHistory && hasExecution && (
        <StatusLegend 
          viewMode={viewMode} 
          hasSelectedAgent={!!currentSelectedAgent} 
        />
      )}
    </div>
  );

  // Panel mode
  if (isPanel) {
    return content;
  }

  // Modal mode
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-3xl h-[80vh] bg-gray-900 rounded-2xl border border-purple-500/30 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </motion.div>
    </motion.div>
  );
});

// Wrapper with roles context
export function WorkflowPanel(props) {
  const rolesHook = useRoles();
  
  const contextValue = rolesHook || {
    getRole: (roleName) => {
      const normalized = roleName?.toLowerCase().replace(/\s+/g, '_');
      return DEFAULT_ROLE_CONFIG[normalized] || DEFAULT_ROLE_CONFIG.default;
    },
    roles: DEFAULT_ROLE_CONFIG,
    loading: false,
    error: null,
  };
  
  return (
    <RolesContext.Provider value={contextValue}>
      <WorkflowPanelInner {...props} />
    </RolesContext.Provider>
  );
}

export default WorkflowPanel;
