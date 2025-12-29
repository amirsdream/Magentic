/**
 * Workflow Visualization - GitHub Actions style execution flow
 * Real-time visualization of agent execution with status updates
 */
import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Code,
  FileText,
  Brain,
  Zap,
  CheckCircle,
  Loader2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  X,
  Play,
  Square,
  Terminal,
  Wrench,
  Activity,
  Layers,
  History,
  ChevronLeft,
  GitBranch,
  List,
  Hash,
  DollarSign,
  Target,
  ArrowDownToLine,
  RotateCcw,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  FileCode,
  ArrowRight,
  Bot,
} from 'lucide-react';
import clsx from 'clsx';
import { useRoles } from '../hooks/useRoles';

// Create context for roles
const RolesContext = createContext(null);

// Hook to use roles context
const useRolesContext = () => {
  const context = useContext(RolesContext);
  // Return default if context not available
  if (!context) {
    return {
      getRole: (roleName) => DEFAULT_ROLE_CONFIG.default,
      roles: DEFAULT_ROLE_CONFIG,
      loading: false,
    };
  }
  return context;
};

// Default fallback config when backend is unavailable
const DEFAULT_ROLE_CONFIG = {
  default: { icon: Bot, label: 'Agent' },
};

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'gray', label: 'Pending', animate: false },
  running: { icon: Loader2, color: 'blue', label: 'Running', animate: true },
  completed: { icon: CheckCircle, color: 'green', label: 'Completed', animate: false },
  complete: { icon: CheckCircle, color: 'green', label: 'Completed', animate: false },
  error: { icon: AlertCircle, color: 'red', label: 'Failed', animate: false },
  stopped: { icon: Square, color: 'orange', label: 'Stopped', animate: false },
};

// Color utility
function getColorClasses(color, type = 'bg') {
  const colors = {
    blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-400', ring: 'ring-blue-500/50' },
    green: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-400', ring: 'ring-green-500/50' },
    purple: { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-400', ring: 'ring-purple-500/50' },
    yellow: { bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-400', ring: 'ring-yellow-500/50' },
    orange: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-400', ring: 'ring-orange-500/50' },
    red: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-400', ring: 'ring-red-500/50' },
    cyan: { bg: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-400', ring: 'ring-cyan-500/50' },
    pink: { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-400', ring: 'ring-pink-500/50' },
    gray: { bg: 'bg-gray-500', border: 'border-gray-500', text: 'text-gray-400', ring: 'ring-gray-500/50' },
    emerald: { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/50' },
    amber: { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-400', ring: 'ring-amber-500/50' },
    indigo: { bg: 'bg-indigo-500', border: 'border-indigo-500', text: 'text-indigo-400', ring: 'ring-indigo-500/50' },
  };
  return colors[color]?.[type] || colors.gray[type];
}

// Format duration
function formatDuration(ms) {
  if (!ms || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// ============================================
// DAG VISUALIZATION COMPONENTS (GitHub Actions Style)
// ============================================

// Job Card - Simple card with essential info (tokens + cost + task)
function JobCard({ agent, isSelected, onClick, index }) {
  const { getRole } = useRolesContext();
  const roleConfig = getRole(agent.role);
  const Icon = roleConfig.icon;
  const isRunning = agent.status === 'running';
  const isComplete = agent.status === 'completed' || agent.status === 'complete';
  const isPending = agent.status === 'pending' || !agent.status;
  const isError = agent.status === 'error';
  const isStopped = agent.status === 'stopped';
  
  const duration = agent.endTime && agent.startTime 
    ? agent.endTime - agent.startTime 
    : agent.startTime ? Date.now() - agent.startTime : null;

  // Extract token usage - handle multiple field name formats from backend
  const tokenUsage = agent.token_usage || agent.tokenUsage || agent.tokens || {};
  const inputTokens = tokenUsage.prompt_tokens || tokenUsage.input_tokens || tokenUsage.input || tokenUsage.promptTokens || 0;
  const outputTokens = tokenUsage.completion_tokens || tokenUsage.output_tokens || tokenUsage.output || tokenUsage.completionTokens || 0;
  const totalTokens = tokenUsage.total_tokens || tokenUsage.totalTokens || (inputTokens + outputTokens);
  const cost = tokenUsage.total_cost || tokenUsage.totalCost || agent.cost || tokenUsage.cost || 0;

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={clsx(
        'w-full text-left rounded-lg border transition-all duration-200',
        'hover:bg-slate-50 dark:hover:bg-gray-800/80',
        isSelected 
          ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-500/10' 
          : 'border-slate-200 dark:border-gray-700/50 bg-white dark:bg-gray-800/50'
      )}
    >
      <div className="px-3 py-2">
        {/* Header row */}
        <div className="flex items-center gap-2">
          {/* Status indicator */}
          <div className={clsx(
            'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
            isComplete && 'bg-green-500',
            isRunning && 'bg-blue-500',
            isPending && 'bg-slate-300 dark:bg-gray-600',
            isError && 'bg-red-500',
            isStopped && 'bg-orange-500'
          )}>
            {isComplete && <CheckCircle className="w-3 h-3 text-white" />}
            {isRunning && <Loader2 className="w-3 h-3 text-white animate-spin" />}
            {isPending && <Clock className="w-3 h-3 text-slate-500 dark:text-gray-400" />}
            {isError && <AlertCircle className="w-3 h-3 text-white" />}
            {isStopped && <Square className="w-3 h-3 text-white" />}
          </div>
          
          {/* Role name */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Icon className="w-3.5 h-3.5 flex-shrink-0 text-purple-500 dark:text-purple-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-gray-200 truncate">
              {roleConfig.label}
            </span>
          </div>
          
          {/* Duration */}
          {duration && (
            <span className="text-xs text-slate-400 dark:text-gray-500 flex-shrink-0">
              {formatDuration(duration)}
            </span>
          )}
        </div>
        
        {/* Task preview */}
        {agent.task && (
          <p className="text-[11px] text-slate-500 dark:text-gray-500 truncate mt-1">
            {agent.task}
          </p>
        )}
        
        {/* Tokens & Cost row - show for completed agents */}
        {(isComplete || isStopped) && (
          <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-gray-700/30">
            <span className="text-[10px] text-slate-500 dark:text-gray-500 font-mono">
              {totalTokens > 0 ? `${totalTokens.toLocaleString()} tokens` : '—'}
            </span>
            {cost > 0 && (
              <>
                <span className="text-slate-300 dark:text-gray-700">•</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                  ${cost.toFixed(4)}
                </span>
              </>
            )}
          </div>
        )}
        
        {/* Running indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-gray-700/30">
            <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium animate-pulse">
              Processing...
            </span>
          </div>
        )}
      </div>
      
      {/* Running progress bar */}
      {isRunning && (
        <div className="h-0.5 bg-slate-100 dark:bg-gray-700 overflow-hidden rounded-b-lg">
          <motion.div
            className="h-full bg-blue-500"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ width: '30%' }}
          />
        </div>
      )}
    </motion.button>
  );
}

// Layer Column - Vertical column of jobs
function LayerColumn({ layer, agents, selectedAgent, onSelectAgent, isFirst, isLast, layerIndex }) {
  const completedCount = agents.filter(a => a.status === 'completed' || a.status === 'complete').length;
  const runningCount = agents.filter(a => a.status === 'running').length;
  const allComplete = completedCount === agents.length;
  const hasRunning = runningCount > 0;

  return (
    <div className="flex items-start gap-2">
      {/* Connection line from previous layer */}
      {!isFirst && (
        <div className="flex items-center h-full pt-8">
          <div className={clsx(
            'w-8 h-0.5 rounded-full',
            allComplete ? 'bg-green-500' : hasRunning ? 'bg-blue-500' : 'bg-slate-300 dark:bg-gray-600'
          )}>
            {hasRunning && (
              <motion.div
                className="h-full w-2 bg-blue-400 rounded-full"
                animate={{ x: [0, 24, 0] }}
                transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>
        </div>
      )}
      
      {/* Layer column */}
      <div className="flex flex-col min-w-[180px] max-w-[200px]">
        {/* Layer header */}
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className={clsx(
            'w-2 h-2 rounded-full',
            allComplete ? 'bg-green-500' : hasRunning ? 'bg-blue-500' : 'bg-slate-300 dark:bg-gray-600'
          )} />
          <span className="text-xs font-medium text-slate-500 dark:text-gray-400">
            Layer {layer}
          </span>
          <span className="text-xs text-slate-400 dark:text-gray-500">
            {completedCount}/{agents.length}
          </span>
        </div>
        
        {/* Jobs in this layer */}
        <div className="space-y-2">
          {agents.map((agent, idx) => (
            <JobCard
              key={agent.agent_id || idx}
              agent={agent}
              isSelected={selectedAgent?.agent_id === agent.agent_id}
              onClick={() => onSelectAgent(agent)}
              index={layerIndex + idx * 0.1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Agent Detail Panel for DAG - Modal popup view (using Portal)
function AgentDetailPanel({ agent, onClose }) {
  const { getRole } = useRolesContext();
  // Start on logs tab if agent is running, otherwise overview
  const initialTab = agent?.status === 'running' ? 'logs' : 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showFullOutput, setShowFullOutput] = useState(false);
  const logsEndRef = React.useRef(null);
  
  // Auto-scroll logs when new entries arrive
  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [agent?.logs?.length, activeTab]);
  
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  
  if (!agent) return null;
  
  const roleConfig = getRole(agent.role);
  const statusConfig = STATUS_CONFIG[agent.status] || STATUS_CONFIG.pending;
  const Icon = roleConfig.icon;
  const StatusIcon = statusConfig.icon;
  
  const duration = agent.endTime && agent.startTime 
    ? agent.endTime - agent.startTime 
    : agent.startTime ? Date.now() - agent.startTime : null;

  // Extract metrics - handle multiple field name formats from backend
  const tokenUsage = agent.token_usage || agent.tokenUsage || agent.tokens || {};
  const inputTokens = tokenUsage.prompt_tokens || tokenUsage.input_tokens || tokenUsage.input || tokenUsage.promptTokens || 0;
  const outputTokens = tokenUsage.completion_tokens || tokenUsage.output_tokens || tokenUsage.output || tokenUsage.completionTokens || 0;
  const totalTokens = tokenUsage.total_tokens || tokenUsage.totalTokens || (inputTokens + outputTokens);
  const cost = tokenUsage.total_cost || tokenUsage.totalCost || agent.cost || tokenUsage.cost || 0;
  const toolCalls = agent.tool_calls || agent.toolCalls || [];
  const artifacts = agent.artifacts || [];
  
  // Format output for display
  const outputText = typeof agent.output === 'string' 
    ? agent.output 
    : agent.output ? JSON.stringify(agent.output, null, 2) : '';
  const outputPreview = outputText.slice(0, 500);
  const hasMoreOutput = outputText.length > 500;
  
  // Logs from streaming
  const logs = agent.logs || [];
  const isRunning = agent.status === 'running';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'output', label: 'Output', count: outputText.length > 0 ? 1 : 0 },
    { id: 'logs', label: 'Activity', count: logs.length, live: isRunning },
    { id: 'tools', label: 'Tools', count: toolCalls.length },
    { id: 'artifacts', label: 'Artifacts', count: artifacts.length },
  ];

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700/50 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-gray-700/50 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-gray-800/80 dark:to-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-500/20">
                <Icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-slate-700 dark:text-white">{roleConfig.label}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-1">
                    <StatusIcon className={clsx(
                      'w-3.5 h-3.5',
                      getColorClasses(statusConfig.color, 'text'),
                      statusConfig.animate && 'animate-spin'
                    )} />
                    <span className={clsx('text-xs font-medium', getColorClasses(statusConfig.color, 'text'))}>
                      {statusConfig.label}
                    </span>
                  </div>
                  {duration && (
                    <>
                      <span className="text-slate-300 dark:text-gray-600">•</span>
                      <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">{formatDuration(duration)}</span>
                    </>
                  )}
                  <span className="text-slate-300 dark:text-gray-600">•</span>
                  <span className="text-xs text-slate-500 dark:text-gray-400">Layer {agent.layer || 0}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-400 dark:text-gray-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        
        {/* Stats bar */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-200 dark:border-gray-700/50">
          <div className="flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs text-slate-600 dark:text-gray-400">
              <span className="font-mono font-medium">{totalTokens.toLocaleString()}</span> tokens
            </span>
            <span className="text-[10px] text-slate-400 dark:text-gray-500">
              ({inputTokens.toLocaleString()} in / {outputTokens.toLocaleString()} out)
            </span>
          </div>
          {cost > 0 && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400">
                ${cost.toFixed(4)}
              </span>
            </div>
          )}
          {toolCalls.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs text-slate-600 dark:text-gray-400">
                <span className="font-medium">{toolCalls.length}</span> tool call{toolCalls.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-gray-700/50 bg-slate-50/50 dark:bg-gray-800/30">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-xs font-medium transition-colors relative',
              activeTab === tab.id 
                ? 'text-purple-600 dark:text-purple-400' 
                : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.live && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-green-500/20 text-green-600 dark:text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              )}
              {!tab.live && tab.count > 0 && (
                <span className={clsx(
                  'px-1.5 py-0.5 rounded-full text-[10px]',
                  activeTab === tab.id 
                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                    : 'bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-400'
                )}>
                  {tab.count}
                </span>
              )}
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
            )}
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div className="p-4 overflow-y-auto flex-1">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Task */}
            {agent.task && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  Task
                </h4>
                <p className="text-sm text-slate-700 dark:text-gray-300 bg-slate-50 dark:bg-gray-900/50 rounded-lg p-3 border border-slate-100 dark:border-gray-700/50">
                  {agent.task}
                </p>
              </div>
            )}
            
            {/* Input from previous agents */}
            {agent.input && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  Input (from previous agents)
                </h4>
                <pre className="text-xs text-slate-600 dark:text-gray-400 bg-slate-50 dark:bg-gray-900/50 rounded-lg p-3 border border-slate-100 dark:border-gray-700/50 overflow-x-auto max-h-32 whitespace-pre-wrap">
                  {typeof agent.input === 'string' 
                    ? agent.input.slice(0, 300) + (agent.input.length > 300 ? '...' : '')
                    : JSON.stringify(agent.input, null, 2)}
                </pre>
              </div>
            )}
            
            {/* Quick output preview */}
            {outputText && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Output Preview
                </h4>
                <pre className="text-xs text-slate-600 dark:text-gray-400 bg-slate-50 dark:bg-gray-900/50 rounded-lg p-3 border border-slate-100 dark:border-gray-700/50 overflow-x-auto max-h-24 whitespace-pre-wrap">
                  {outputPreview}{hasMoreOutput ? '...' : ''}
                </pre>
                {hasMoreOutput && (
                  <button
                    onClick={() => setActiveTab('output')}
                    className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    View full output ({outputText.length.toLocaleString()} chars) →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'output' && (
          <div>
            {outputText ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Full Output
                    <span className="text-slate-400 dark:text-gray-600 font-normal normal-case">
                      ({outputText.length.toLocaleString()} characters)
                    </span>
                  </h4>
                  <button
                    onClick={() => setShowFullOutput(!showFullOutput)}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    {showFullOutput ? 'Show less' : 'Show all'}
                    <ChevronDown className={clsx('w-3 h-3 transition-transform', showFullOutput && 'rotate-180')} />
                  </button>
                </div>
                <pre className={clsx(
                  'text-xs text-slate-600 dark:text-gray-400 bg-slate-50 dark:bg-gray-900/50 rounded-lg p-3 border border-slate-100 dark:border-gray-700/50 overflow-x-auto whitespace-pre-wrap',
                  showFullOutput ? 'max-h-none' : 'max-h-48'
                )}>
                  {showFullOutput ? outputText : outputText.slice(0, 1000) + (outputText.length > 1000 ? '...' : '')}
                </pre>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-gray-600" />
                <p className="text-sm text-slate-500 dark:text-gray-500">No output yet</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'logs' && (
          <div>
            {logs.length > 0 ? (
              <div className="space-y-2 font-mono text-xs">
                {logs.map((log, idx) => {
                  const logTypeConfig = {
                    info: { icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    llm_start: { icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                    llm_end: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
                    tool_start: { icon: Wrench, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                    tool_end: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
                    warning: { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                  };
                  const config = logTypeConfig[log.type] || logTypeConfig.info;
                  const LogIcon = config.icon;
                  
                  return (
                    <div key={idx} className={clsx(
                      'flex items-start gap-2 p-2 rounded-lg',
                      config.bg
                    )}>
                      <LogIcon className={clsx('w-3.5 h-3.5 mt-0.5 shrink-0', config.color)} />
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-700 dark:text-gray-300">{log.content}</span>
                        {log.metadata?.preview && (
                          <p className="text-slate-500 dark:text-gray-500 mt-0.5 truncate text-[10px]">
                            {log.metadata.preview}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-gray-600 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })}
                {/* Scroll anchor for auto-scroll */}
                <div ref={logsEndRef} />
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-gray-600" />
                <p className="text-sm text-slate-500 dark:text-gray-500">
                  {agent.status === 'running' ? 'Waiting for activity...' : 'No activity logs'}
                </p>
                {agent.status === 'running' && (
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs text-slate-400">Agent is executing</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'tools' && (
          <div>
            {toolCalls.length > 0 ? (
              <div className="space-y-3">
                {toolCalls.map((tool, idx) => (
                  <ToolCallDetail key={idx} tool={tool} index={idx} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Wrench className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-gray-600" />
                <p className="text-sm text-slate-500 dark:text-gray-500">No tool calls</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'artifacts' && (
          <div>
            {artifacts.length > 0 ? (
              <div className="space-y-2">
                {artifacts.map((artifact, idx) => (
                  <ArtifactDebugItem key={idx} artifact={artifact} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-gray-600" />
                <p className="text-sm text-slate-500 dark:text-gray-500">No artifacts created</p>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
  
  // Render modal in portal to document.body
  return createPortal(modalContent, document.body);
}

// Artifact Debug Item Component - shows artifact with debug gateway fetch
function ArtifactDebugItem({ artifact }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState(null);
  const [error, setError] = useState(null);
  
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const MCP_GATEWAY = import.meta.env.VITE_MCP_GATEWAY_URL || 'http://localhost:9000';
  
  const filename = artifact.name || artifact.path?.split('/').pop() || 'Unnamed file';
  const filePath = artifact.path || '';
  
  // Load from MCP gateway directly (debug)
  const loadFromGateway = async () => {
    setLoading(true);
    setError(null);
    setContent(null);
    
    // Remove /workspace/ prefix for gateway
    let gatewayPath = filePath;
    if (gatewayPath.startsWith('/workspace/')) {
      gatewayPath = gatewayPath.slice('/workspace/'.length);
    }
    
    try {
      const response = await fetch(`${MCP_GATEWAY}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: 'filesystem',
          tool: 'read_file',
          params: { path: gatewayPath }
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        // Check for file not found errors
        const errorMsg = result.error || result.detail || `Gateway error: ${response.status}`;
        if (errorMsg.toLowerCase().includes('not found') || 
            errorMsg.toLowerCase().includes('no such file') ||
            response.status === 404) {
          setError('file_not_found');
        } else {
          setError(errorMsg);
        }
        return;
      }
      
      if (result.result?.content) {
        setContent(result.result.content);
      } else {
        setError('No content returned');
      }
    } catch (err) {
      // Network error or gateway unavailable
      if (err.message.includes('fetch') || err.message.includes('network')) {
        setError('gateway_unavailable');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-slate-50 dark:bg-gray-900/50 rounded-lg border border-slate-100 dark:border-gray-700/50 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-gray-300 truncate">
            {filename}
          </p>
          <p className="text-xs text-slate-500 dark:text-gray-500 truncate">
            {filePath}
          </p>
        </div>
        {artifact.language && (
          <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-400 rounded">
            {artifact.language}
          </span>
        )}
        <button
          onClick={() => {
            if (!expanded) loadFromGateway();
            setExpanded(!expanded);
          }}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
          title="Debug: Load from MCP Gateway"
        >
          <ChevronDown className={clsx(
            'w-4 h-4 text-slate-400 dark:text-gray-500 transition-transform',
            expanded && 'rotate-180'
          )} />
        </button>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 dark:border-gray-700/50"
          >
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                  Debug: MCP Gateway Content
                </span>
                <button
                  onClick={loadFromGateway}
                  disabled={loading}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              
              {loading && (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-500">Fetching from gateway...</span>
                </div>
              )}
              
              {error === 'file_not_found' && (
                <div className="text-xs bg-amber-50 dark:bg-amber-900/20 rounded p-3 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500">📁</span>
                    <div>
                      <p className="font-medium text-amber-700 dark:text-amber-400">File not on disk</p>
                      <p className="text-amber-600 dark:text-amber-500 mt-1">
                        This file was removed (docker cleanup). The content is still saved in the database and can be viewed via the artifact preview panel.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {error === 'gateway_unavailable' && (
                <div className="text-xs bg-slate-100 dark:bg-slate-800 rounded p-3 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400">🔌</span>
                    <div>
                      <p className="font-medium text-slate-600 dark:text-slate-400">Gateway unavailable</p>
                      <p className="text-slate-500 dark:text-slate-500 mt-1">
                        MCP Gateway is not running. Start docker services to access files on disk.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {error && error !== 'file_not_found' && error !== 'gateway_unavailable' && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
                  ⚠️ {error}
                </div>
              )}
              
              {content && (
                <pre className="text-xs text-slate-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded p-2 overflow-x-auto max-h-64 whitespace-pre-wrap">
                  {content}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Tool Call Detail Component
function ToolCallDetail({ tool, index }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = tool.name || tool.tool || 'Unknown Tool';
  const displayName = toolName.replace('mcp_', '').replace(/_/g, ' ');
  
  return (
    <div className="bg-slate-50 dark:bg-gray-900/50 rounded-lg border border-slate-100 dark:border-gray-700/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="p-1 rounded bg-purple-100 dark:bg-purple-500/20">
          <Wrench className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        </div>
        <span className="flex-1 text-left text-sm font-medium text-slate-700 dark:text-gray-300 capitalize">
          {displayName}
        </span>
        <ChevronDown className={clsx(
          'w-4 h-4 text-slate-400 dark:text-gray-500 transition-transform',
          expanded && 'rotate-180'
        )} />
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 dark:border-gray-700/50"
          >
            <div className="p-3 space-y-3">
              {/* Arguments */}
              {tool.args && Object.keys(tool.args).length > 0 && (
                <div>
                  <h5 className="text-[10px] font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-wide mb-1">
                    Arguments
                  </h5>
                  <pre className="text-xs text-slate-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded p-2 overflow-x-auto max-h-32">
                    {typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* Result */}
              {tool.result && (
                <div>
                  <h5 className="text-[10px] font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-wide mb-1">
                    Result
                  </h5>
                  <pre className="text-xs text-slate-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded p-2 overflow-x-auto max-h-40 whitespace-pre-wrap">
                    {typeof tool.result === 'string' 
                      ? (tool.result.length > 800 ? tool.result.slice(0, 800) + '...' : tool.result)
                      : JSON.stringify(tool.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// DAG View Component - GitHub Actions style horizontal layout
function DAGView({ agents, layers, selectedAgent, onSelectAgent }) {
  // Group agents by layer
  const layerData = useMemo(() => {
    if (!agents || agents.length === 0) return [];
    
    const layerMap = new Map();
    agents.forEach(agent => {
      const layer = agent.layer || 0;
      if (!layerMap.has(layer)) {
        layerMap.set(layer, []);
      }
      layerMap.get(layer).push(agent);
    });
    
    return Array.from(layerMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([layer, layerAgents]) => ({ layer, agents: layerAgents }));
  }, [agents]);

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable pipeline - allow both horizontal and vertical scroll */}
      <div className="flex-1 overflow-auto">
        <div className="flex items-start gap-0 p-4 min-w-max">
          {layerData.map(({ layer, agents: layerAgents }, idx) => (
            <LayerColumn
              key={layer}
              layer={layer}
              agents={layerAgents}
              selectedAgent={selectedAgent}
              onSelectAgent={onSelectAgent}
              isFirst={idx === 0}
              isLast={idx === layerData.length - 1}
              layerIndex={idx}
            />
          ))}
        </div>
      </div>
      
      {/* Selected agent detail modal - renders via portal */}
      {selectedAgent && (
        <AgentDetailPanel 
          agent={selectedAgent} 
          onClose={() => onSelectAgent(null)} 
        />
      )}
    </div>
  );
}

// ============================================
// END DAG VISUALIZATION COMPONENTS
// ============================================

// Tool Call Item
function ToolCallItem({ tool, index }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-700/30 transition-colors"
      >
        <Wrench className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-xs font-medium text-gray-300 flex-1 text-left truncate">
          {tool.name || tool.tool}
        </span>
        <ChevronDown className={clsx(
          'w-3.5 h-3.5 text-gray-500 transition-transform',
          expanded && 'rotate-180'
        )} />
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-700/50"
          >
            <div className="p-3 space-y-2">
              {tool.args && (
                <div>
                  <span className="text-xs text-gray-500">Arguments:</span>
                  <pre className="mt-1 text-xs text-gray-400 bg-gray-900/50 rounded p-2 overflow-x-auto max-h-24">
                    {typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args, null, 2)}
                  </pre>
                </div>
              )}
              {tool.result && (
                <div>
                  <span className="text-xs text-gray-500">Result:</span>
                  <pre className="mt-1 text-xs text-gray-400 bg-gray-900/50 rounded p-2 overflow-x-auto max-h-32">
                    {typeof tool.result === 'string' 
                      ? (tool.result.length > 500 ? tool.result.slice(0, 500) + '...' : tool.result)
                      : JSON.stringify(tool.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Agent Step Component - GitHub Actions style
function AgentStep({ agent, isExpanded, onToggle, layerIndex, stepIndex }) {
  const { getRole } = useRolesContext();
  const roleConfig = getRole(agent.role);
  const statusConfig = STATUS_CONFIG[agent.status] || STATUS_CONFIG.pending;
  const Icon = roleConfig.icon;
  const StatusIcon = statusConfig.icon;
  
  const duration = agent.endTime && agent.startTime 
    ? agent.endTime - agent.startTime 
    : agent.startTime ? Date.now() - agent.startTime : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: stepIndex * 0.1 }}
      className={clsx(
        'rounded-lg border overflow-hidden transition-all duration-300',
        agent.status === 'running' && 'ring-2 ring-offset-2 ring-offset-gray-900',
        agent.status === 'running' && getColorClasses(statusConfig.color, 'ring'),
        getColorClasses(statusConfig.color, 'border'),
        'border-opacity-50 bg-gray-900/80'
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800/50 transition-colors"
      >
        {/* Status indicator with animation */}
        <div className={clsx(
          'relative flex items-center justify-center w-8 h-8 rounded-full',
          getColorClasses(statusConfig.color, 'bg'),
          'bg-opacity-20'
        )}>
          <StatusIcon className={clsx(
            'w-4 h-4',
            getColorClasses(statusConfig.color, 'text'),
            statusConfig.animate && 'animate-spin'
          )} />
          {agent.status === 'running' && (
            <motion.div
              className={clsx(
                'absolute inset-0 rounded-full',
                getColorClasses(statusConfig.color, 'border'),
                'border-2 border-opacity-50'
              )}
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>

        {/* Agent info */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-purple-400" />
            <span className="font-medium text-white text-sm">{agent.agent_id}</span>
            <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-300">
              {roleConfig.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{agent.task}</p>
        </div>

        {/* Duration & expand */}
        <div className="flex items-center gap-3">
          {duration !== null && (
            <span className="text-xs text-gray-500 font-mono">
              {formatDuration(duration)}
            </span>
          )}
          <ChevronRight className={clsx(
            'w-4 h-4 text-gray-500 transition-transform',
            isExpanded && 'rotate-90'
          )} />
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-700/50"
          >
            <div className="p-4 space-y-4">
              {/* Tool calls */}
              {agent.tool_calls && agent.tool_calls.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5" />
                    Tool Calls ({agent.tool_calls.length})
                  </h4>
                  <div className="space-y-2">
                    {agent.tool_calls.map((tool, idx) => (
                      <ToolCallItem key={idx} tool={tool} index={idx} />
                    ))}
                  </div>
                </div>
              )}

              {/* Output preview */}
              {agent.output && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    Output
                  </h4>
                  <div className="bg-gray-800/50 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <p className="text-xs text-gray-300 whitespace-pre-wrap">
                      {agent.output.length > 500 ? agent.output.slice(0, 500) + '...' : agent.output}
                    </p>
                  </div>
                </div>
              )}

              {/* Token usage */}
              {agent.token_usage && (
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Input: {agent.token_usage.input_tokens?.toLocaleString() || 0}</span>
                  <span>Output: {agent.token_usage.output_tokens?.toLocaleString() || 0}</span>
                  {agent.token_usage.cost && (
                    <span className="text-green-400">${agent.token_usage.cost.toFixed(4)}</span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Layer Component
function ExecutionLayer({ layer, agents, expandedAgents, toggleAgent }) {
  const completedCount = agents.filter(a => a.status === 'completed' || a.status === 'complete').length;
  const runningCount = agents.filter(a => a.status === 'running').length;
  const allComplete = completedCount === agents.length;
  const hasRunning = runningCount > 0;

  return (
    <div className="relative">
      {/* Layer connector line */}
      {layer > 0 && (
        <div className="absolute -top-6 left-8 w-0.5 h-6 bg-gray-700" />
      )}
      
      {/* Layer header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={clsx(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
          allComplete ? 'bg-green-500/20 text-green-400' : 
          hasRunning ? 'bg-blue-500/20 text-blue-400' : 
          'bg-gray-700 text-gray-400'
        )}>
          {layer + 1}
        </div>
        <span className="text-sm text-gray-400">
          Layer {layer + 1}
          <span className="text-gray-600 ml-2">
            ({completedCount}/{agents.length} complete)
          </span>
        </span>
        {hasRunning && (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="flex items-center gap-1 text-blue-400 text-xs"
          >
            <Activity className="w-3 h-3" />
            In Progress
          </motion.div>
        )}
      </div>

      {/* Agents in layer */}
      <div className="space-y-3 ml-9">
        {agents.map((agent, idx) => (
          <AgentStep
            key={agent.agent_id}
            agent={agent}
            isExpanded={expandedAgents.has(agent.agent_id)}
            onToggle={() => toggleAgent(agent.agent_id)}
            layerIndex={layer}
            stepIndex={idx}
          />
        ))}
      </div>
    </div>
  );
}

// Main Workflow Visualization Component (inner)
function WorkflowVisualizationInner({ 
  execution, 
  executionHistory = [], 
  onSelectExecution,
  onClose, 
  onRetry,
  isPanel = false,
  isLive = false 
}) {
  const [expandedAgents, setExpandedAgents] = useState(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [viewMode, setViewMode] = useState('dag'); // 'dag' or 'list'
  const [selectedAgent, setSelectedAgent] = useState(null);

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

  // Auto-expand running agents
  useEffect(() => {
    if (execution?.agents) {
      const running = execution.agents.filter(a => a.status === 'running');
      if (running.length > 0) {
        setExpandedAgents(prev => {
          const next = new Set(prev);
          running.forEach(a => next.add(a.agent_id));
          return next;
        });
      }
    }
  }, [execution?.agents]);

  // Group agents by layer
  const layers = useMemo(() => {
    if (!execution?.agents) return [];
    
    const layerMap = new Map();
    execution.agents.forEach(agent => {
      const layer = agent.layer || 0;
      if (!layerMap.has(layer)) {
        layerMap.set(layer, []);
      }
      layerMap.get(layer).push(agent);
    });
    
    return Array.from(layerMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([layer, agents]) => ({ layer, agents }));
  }, [execution?.agents]);

  // Calculate overall progress
  const progress = useMemo(() => {
    if (!execution?.agents || execution.agents.length === 0) return 0;
    const completed = execution.agents.filter(a => 
      a.status === 'completed' || a.status === 'complete'
    ).length;
    return Math.round((completed / execution.agents.length) * 100);
  }, [execution?.agents]);

  // Determine if execution is stopped or complete (for retry button)
  const isStopped = execution?.stage === 'stopped';
  const isComplete = execution?.stage === 'complete' || progress === 100;
  const canRetry = onRetry && execution?.query && (isStopped || isComplete);

  // Show empty state when no execution
  if (!execution) {
    return (
      <div className={clsx(
        'flex flex-col',
        isPanel ? 'h-full bg-slate-50 dark:bg-gray-900' : 'fixed inset-0 z-50 bg-gray-900'
      )}>
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              {showHistory ? (
                <>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="font-semibold text-slate-700 dark:text-white">Execution History</h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      {executionHistory.length} past executions
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-gray-800">
                    <Activity className="w-5 h-5 text-slate-400 dark:text-gray-500" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-700 dark:text-white">Workflow</h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      Execution flow visualization
                    </p>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              {!showHistory && executionHistory.length > 0 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                  title="View history"
                >
                  <History className="w-4 h-4" />
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {showHistory ? (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-4 space-y-3"
              >
                {executionHistory.map((exec, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => onSelectExecution?.(exec)}
                    className="w-full p-3 rounded-xl bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700/50 hover:border-purple-500/50 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/20 flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-white truncate">
                          {exec.query || `Execution #${executionHistory.length - idx}`}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                          {exec.agents?.length || exec.plan?.total_agents || 0} agents • {exec.plan?.total_layers || 1} layers
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-gray-600 group-hover:text-purple-500 transition-colors flex-shrink-0" />
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex items-center justify-center h-full"
              >
                <div className="text-center px-6 py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
                    <Activity className="w-8 h-8 text-slate-300 dark:text-gray-600" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-600 dark:text-gray-300 mb-2">
                    No Active Execution
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-gray-500 max-w-xs mb-4">
                    Send a message to see the agent workflow here.
                  </p>
                  {executionHistory.length > 0 && (
                    <button
                      onClick={() => setShowHistory(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-sm font-medium transition-colors"
                    >
                      <History className="w-4 h-4" />
                      View {executionHistory.length} past execution{executionHistory.length !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Show minimal state when execution exists but no agents yet
  if (!execution.agents?.length && !execution.plan?.agents?.length) {
    return (
      <div className={clsx(
        'flex flex-col',
        isPanel ? 'h-full bg-slate-50 dark:bg-gray-900' : 'fixed inset-0 z-50 bg-gray-900'
      )}>
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-700 dark:text-white">Workflow</h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  {execution.stageMessage || 'Initializing...'}
                </p>
              </div>
            </div>
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-400 animate-spin" />
            <p className="text-sm text-slate-500 dark:text-gray-400">
              {execution.stageMessage || 'Planning execution...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center">
          <div className="flex items-center gap-3">
            {showHistory ? (
              <>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="font-semibold text-slate-700 dark:text-white">Execution History</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    {executionHistory.length} past executions
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className={clsx(
                  'p-2 rounded-lg',
                  progress === 100 ? 'bg-green-500/20' : isLive ? 'bg-purple-500/20' : 'bg-slate-200 dark:bg-gray-800'
                )}>
                  {progress === 100 ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : isLive ? (
                    <Play className="w-5 h-5 text-purple-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-slate-400 dark:text-gray-500" />
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-slate-700 dark:text-white truncate max-w-[200px]" title={execution.query}>
                    {execution.query 
                      ? (execution.query.length > 30 ? execution.query.slice(0, 30) + '...' : execution.query)
                      : (isLive ? 'Live Execution' : 'Last Execution')
                    }
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    {isLive && <span className="text-emerald-500 mr-1">●</span>}
                    {execution.plan?.total_agents || execution.agents?.length || 0} agents • {execution.plan?.total_layers || 1} layers
                  </p>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            {!showHistory && (
              <>
                {/* View mode toggle */}
                <div className="flex items-center bg-slate-100 dark:bg-gray-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('dag')}
                    className={clsx(
                      'p-1.5 rounded-md transition-colors',
                      viewMode === 'dag' 
                        ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                        : 'text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300'
                    )}
                    title="DAG View"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={clsx(
                      'p-1.5 rounded-md transition-colors',
                      viewMode === 'list' 
                        ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                        : 'text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300'
                    )}
                    title="List View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Progress indicator */}
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1.5 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">{progress}%</span>
                </div>
                
                {/* Retry button - show when stopped or complete */}
                {canRetry && (
                  <button
                    onClick={() => onRetry(execution.query)}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      isStopped 
                        ? 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                        : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                    )}
                    title={`Retry: ${execution.query}`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                )}
                
                {/* History button */}
                {executionHistory.length > 0 && (
                  <button
                    onClick={() => setShowHistory(true)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    title="View history"
                  >
                    <History className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Stage message - only show when not in history and live */}
        {!showHistory && isLive && execution.stageMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-xs text-slate-500 dark:text-gray-400 flex items-center gap-2"
          >
            <Activity className="w-3 h-3 animate-pulse" />
            {execution.stageMessage}
          </motion.div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {showHistory ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-3"
            >
              {executionHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-gray-600" />
                  <p className="text-sm text-slate-500 dark:text-gray-400">No execution history</p>
                </div>
              ) : (
                executionHistory.map((exec, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => {
                      if (onSelectExecution) {
                        onSelectExecution(exec);
                      }
                    }}
                    className="w-full p-3 rounded-xl bg-white dark:bg-gray-800/50 border border-slate-200 dark:border-gray-700/50 hover:border-purple-500/50 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/20 flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-white truncate">
                          {exec.query || `Execution #${executionHistory.length - idx}`}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                          {exec.agents?.length || exec.plan?.total_agents || 0} agents • {exec.plan?.total_layers || 1} layers
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-gray-600 group-hover:text-purple-500 transition-colors flex-shrink-0" />
                    </div>
                  </motion.button>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="workflow"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="relative h-full"
            >
              {viewMode === 'dag' ? (
                <div className="p-4 h-full">
                  <DAGView 
                    agents={execution.agents || []}
                    layers={layers}
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                  />
                </div>
              ) : (
                <div className="p-4 space-y-6">
                  {layers.map(({ layer, agents }) => (
                    <ExecutionLayer
                      key={layer}
                      layer={layer}
                      agents={agents}
                      expandedAgents={expandedAgents}
                      toggleAgent={toggleAgent}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer with legend - only show when not in history */}
      {!showHistory && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-slate-200 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Show unique statuses for legend: pending, running, completed, stopped, error */}
              {[
                { status: 'pending', ...STATUS_CONFIG.pending },
                { status: 'running', ...STATUS_CONFIG.running },
                { status: 'completed', ...STATUS_CONFIG.completed },
                { status: 'stopped', ...STATUS_CONFIG.stopped },
                { status: 'error', ...STATUS_CONFIG.error },
              ].map(({ status, color, label }) => (
                <div key={status} className="flex items-center gap-1">
                  <div className={clsx(
                    'w-2 h-2 rounded-full',
                    getColorClasses(color, 'bg')
                  )} />
                  <span className="text-[10px] text-slate-500 dark:text-gray-500">{label}</span>
                </div>
              ))}
            </div>
            {viewMode === 'dag' && selectedAgent && (
              <span className="text-[10px] text-slate-400 dark:text-gray-500">
                Click node for details
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Panel mode - just return content
  if (isPanel) {
    return content;
  }

  // Full screen modal mode
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
}

// Wrapper component that provides roles context
function WorkflowVisualization(props) {
  // Fetch roles from backend
  const rolesHook = useRoles('http://localhost:8000');
  
  return (
    <RolesContext.Provider value={rolesHook}>
      <WorkflowVisualizationInner {...props} />
    </RolesContext.Provider>
  );
}

export default WorkflowVisualization;
