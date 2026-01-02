/**
 * AgentDetailPanel - Modal panel showing detailed agent information
 * Includes Overview, Output, Activity, Tools, and Artifacts tabs
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  Wrench,
  FileText,
  ChevronDown,
  Terminal,
  Activity,
  Box,
  Hash,
  Coins,
  ArrowDownToLine,
  ArrowUpFromLine,
  Brain,
  Sparkles,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import { STATUS_CONFIG, getColorClasses } from './constants';

function AgentDetailPanel({ agent, onClose, getRole }) {
  const initialTab = agent?.status === 'running' ? 'activity' : 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showFullOutput, setShowFullOutput] = useState(false);
  const logsEndRef = useRef(null);
  
  // Auto-scroll logs when new entries arrive
  useEffect(() => {
    if (activeTab === 'activity' && logsEndRef.current) {
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
  
  const roleConfig = getRole?.(agent.role) || {};
  const statusConfig = STATUS_CONFIG[agent.status] || STATUS_CONFIG.pending;
  const Icon = roleConfig.icon || Activity;
  const StatusIcon = statusConfig.icon;
  
  // Parse timestamps
  const parseTime = (time) => {
    if (!time) return null;
    if (typeof time === 'number') return time;
    if (time instanceof Date) return time.getTime();
    const parsed = new Date(time).getTime();
    return isNaN(parsed) ? null : parsed;
  };

  const startTime = parseTime(agent.startTime || agent.started_at || agent.start_time);
  const endTime = parseTime(agent.endTime || agent.ended_at || agent.end_time);
  const isRunning = agent.status === 'running';

  const duration = endTime && startTime 
    ? endTime - startTime 
    : startTime ? Date.now() - startTime : null;

  // Extract metrics
  const tokenUsage = agent.token_usage || agent.tokenUsage || agent.tokens || {};
  const inputTokens = tokenUsage.prompt_tokens || tokenUsage.input_tokens || tokenUsage.input || tokenUsage.promptTokens || 0;
  const outputTokens = tokenUsage.completion_tokens || tokenUsage.output_tokens || tokenUsage.output || tokenUsage.completionTokens || 0;
  const totalTokens = tokenUsage.total_tokens || tokenUsage.totalTokens || (inputTokens + outputTokens);
  const cost = tokenUsage.total_cost || tokenUsage.totalCost || agent.cost || tokenUsage.cost || 0;
  const toolCalls = agent.tool_calls || agent.toolCalls || [];
  const artifacts = agent.artifacts || [];
  const logs = agent.logs || [];
  
  // Get input from various possible field names
  const agentInput = agent.input || agent.prior_output || agent.context || agent.inputFromPrior || null;

  // Format output for display
  const outputText = typeof agent.output === 'string' 
    ? agent.output 
    : agent.output ? JSON.stringify(agent.output, null, 2) : '';
  const outputPreview = outputText.slice(0, 500);
  const hasMoreOutput = outputText.length > 500;

  // Enrich tool calls with results from logs
  const enrichedToolCalls = useMemo(() => {
    // Extract tool results from logs
    const toolResults = new Map();
    logs.forEach(log => {
      if (log.type === 'tool_end' && log.metadata) {
        const toolName = log.metadata.tool_name || log.metadata.tool;
        const result = log.metadata.result || log.metadata.output;
        const duration = log.metadata.duration;
        if (toolName) {
          // Store by tool name (might have multiple calls, store latest)
          if (!toolResults.has(toolName)) {
            toolResults.set(toolName, []);
          }
          toolResults.get(toolName).push({ result, duration });
        }
      }
    });
    
    // Match tool calls with their results
    const toolCallCounts = new Map();
    return toolCalls.map(tool => {
      const toolName = tool.name || tool.tool || 'unknown';
      // Track which instance of this tool we're on
      const count = toolCallCounts.get(toolName) || 0;
      toolCallCounts.set(toolName, count + 1);
      
      const results = toolResults.get(toolName) || [];
      const matchedResult = results[count] || results[0] || null;
      
      return {
        ...tool,
        name: toolName,
        result: tool.result || matchedResult?.result,
        duration: tool.duration || matchedResult?.duration,
        status: tool.status || (matchedResult?.result ? 'success' : undefined),
      };
    });
  }, [toolCalls, logs]);

  const formatDuration = (ms) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'output', label: 'Output', icon: MessageSquare, count: outputText.length > 0 ? 1 : 0 },
    { id: 'activity', label: 'Activity', icon: Terminal, count: logs.length, live: isRunning },
    { id: 'tools', label: 'Tools', icon: Wrench, count: enrichedToolCalls.length },
    { id: 'artifacts', label: 'Artifacts', icon: Box, count: artifacts.length },
  ];

  // Group logs into logical sections
  const logGroups = groupLogs(logs);

  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-3xl max-h-[85vh] bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              'bg-purple-100 dark:bg-purple-500/20'
            )}>
              <Icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {roleConfig.label || agent.role || 'Agent'}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
                <StatusIcon className={clsx(
                  'w-3.5 h-3.5',
                  agent.status === 'completed' || agent.status === 'complete' ? 'text-emerald-500' :
                  agent.status === 'running' ? 'text-blue-500' :
                  agent.status === 'error' ? 'text-red-500' :
                  'text-slate-400'
                )} />
                <span>{statusConfig.label}</span>
                {duration && (
                  <>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(duration)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics bar */}
        {(totalTokens > 0 || cost > 0) && (
          <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-800">
            {inputTokens > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <ArrowDownToLine className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-slate-600 dark:text-gray-400">In:</span>
                <span className="font-mono text-slate-700 dark:text-gray-300">{inputTokens.toLocaleString()}</span>
              </div>
            )}
            {outputTokens > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <ArrowUpFromLine className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-slate-600 dark:text-gray-400">Out:</span>
                <span className="font-mono text-slate-700 dark:text-gray-300">{outputTokens.toLocaleString()}</span>
              </div>
            )}
            {totalTokens > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-600 dark:text-gray-400">Total:</span>
                <span className="font-mono text-slate-700 dark:text-gray-300">{totalTokens.toLocaleString()}</span>
              </div>
            )}
            {cost > 0 && (
              <div className="flex items-center gap-1.5 text-xs ml-auto">
                <Coins className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-mono text-emerald-600 dark:text-emerald-400">${cost.toFixed(4)}</span>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-gray-800 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === tab.id 
                  ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-500' 
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={clsx(
                  'px-1.5 py-0.5 text-xs rounded',
                  tab.live 
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 animate-pulse' 
                    : 'bg-slate-100 text-slate-600 dark:bg-gray-700 dark:text-gray-300'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Task first */}
              {agent.task && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase mb-2">Task</h4>
                  <p className="text-sm text-slate-700 dark:text-gray-300 bg-slate-50 dark:bg-gray-800/50 rounded-lg p-3">
                    {agent.task}
                  </p>
                </div>
              )}
              
              {/* Input from Prior Agent */}
              {agentInput && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase mb-2 flex items-center gap-1.5">
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    Input from Prior Agent
                  </h4>
                  <div className="text-sm text-slate-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                    {typeof agentInput === 'string' ? agentInput : JSON.stringify(agentInput, null, 2)}
                  </div>
                </div>
              )}
              
              {/* Output Preview */}
              {outputText && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase mb-2 flex items-center gap-1.5">
                    <ArrowUpFromLine className="w-3.5 h-3.5" />
                    Output Preview
                  </h4>
                  <div className="text-sm text-slate-700 dark:text-gray-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {outputPreview}
                    {hasMoreOutput && (
                      <button 
                        onClick={() => setActiveTab('output')}
                        className="text-purple-600 dark:text-purple-400 hover:underline ml-1"
                      >
                        ... View full output
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 dark:text-gray-500 mb-1">Duration</div>
                  <div className="text-lg font-semibold text-slate-700 dark:text-gray-200">{formatDuration(duration)}</div>
                </div>
                <div className="bg-slate-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 dark:text-gray-500 mb-1">Tokens</div>
                  <div className="text-lg font-semibold text-slate-700 dark:text-gray-200">{totalTokens.toLocaleString() || '-'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 dark:text-gray-500 mb-1">Tool Calls</div>
                  <div className="text-lg font-semibold text-slate-700 dark:text-gray-200">{toolCalls.length}</div>
                </div>
                <div className="bg-slate-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 dark:text-gray-500 mb-1">Cost</div>
                  <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{cost > 0 ? `$${cost.toFixed(4)}` : '-'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Output Tab */}
          {activeTab === 'output' && (
            <div>
              {outputText ? (
                <div className="bg-slate-50 dark:bg-gray-800/50 rounded-lg p-4 text-sm text-slate-700 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-[60vh] overflow-y-auto">
                  {showFullOutput ? outputText : outputPreview}
                  {hasMoreOutput && !showFullOutput && (
                    <button 
                      onClick={() => setShowFullOutput(true)}
                      className="block mt-2 text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      Show full output ({outputText.length.toLocaleString()} chars)
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 dark:text-gray-500">
                  No output available
                </div>
              )}
            </div>
          )}

          {/* Activity Tab - Terminal Style */}
          {activeTab === 'activity' && (
            <div className="bg-slate-900 dark:bg-black rounded-lg overflow-hidden border border-slate-700 dark:border-gray-800 shadow-inner">
              {/* Terminal Header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 dark:bg-gray-900 border-b border-slate-700 dark:border-gray-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="ml-2 text-xs text-slate-400 font-mono flex-1">
                  {roleConfig.label || agent.role || 'Agent'} — Activity Log
                </span>
                {isRunning && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              
              {/* Terminal Body */}
              <div className="p-3 font-mono text-sm max-h-[50vh] overflow-y-auto scroll-smooth">
                {logGroups.length > 0 ? (
                  <div className="space-y-3">
                    {logGroups.map((group, idx) => (
                      <TerminalLogEntry key={idx} group={group} index={idx} />
                    ))}
                  </div>
                ) : logs.length > 0 ? (
                  <div className="space-y-1">
                    {logs.map((log, idx) => (
                      <div key={idx} className="flex gap-2 text-xs">
                        <span className="text-slate-500 select-none">{String(idx + 1).padStart(3, ' ')}</span>
                        <span className="text-slate-300">
                          {typeof log === 'string' ? log : log.content || JSON.stringify(log)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <Terminal className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-xs">
                      {isRunning ? 'Waiting for activity...' : 'No activity logs'}
                    </span>
                    {isRunning && (
                      <span className="mt-2 flex items-center gap-1 text-emerald-400 text-xs">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Listening...
                      </span>
                    )}
                  </div>
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* Tools Tab */}
          {activeTab === 'tools' && (
            <div className="space-y-3">
              {enrichedToolCalls.length > 0 ? (
                enrichedToolCalls.map((tool, idx) => (
                  <ToolCallItem key={idx} tool={tool} index={idx} />
                ))
              ) : (
                <div className="text-center py-12 text-slate-500 dark:text-gray-500">
                  <Wrench className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No tool calls</p>
                  <p className="text-xs mt-1">This agent didn't use any MCP tools</p>
                </div>
              )}
            </div>
          )}

          {/* Artifacts Tab */}
          {activeTab === 'artifacts' && (
            <div className="space-y-3">
              {artifacts.length > 0 ? (
                artifacts.map((artifact, idx) => (
                  <ArtifactItem key={idx} artifact={artifact} index={idx} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-gray-500">
                  <span className="text-4xl mb-3">📦</span>
                  <p className="font-medium">No artifacts generated</p>
                  <p className="text-xs mt-1">This agent didn't create any files or outputs</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  return createPortal(modalContent, document.body);
}

// Group logs into logical sections
function groupLogs(logs) {
  const groups = [];
  let currentGroup = null;
  
  const closeCurrentGroup = () => {
    if (currentGroup) {
      if (currentGroup.type === 'thinking') {
        currentGroup.status = 'complete';
      }
      currentGroup = null;
    }
  };
  
  logs.forEach((log) => {
    if (log.type === 'info') {
      closeCurrentGroup();
      groups.push({
        type: 'info',
        title: log.content,
        timestamp: log.timestamp,
        logs: [log],
        status: 'complete'
      });
    } else if (log.type === 'llm_start') {
      closeCurrentGroup();
      currentGroup = {
        type: 'llm',
        title: log.content,
        timestamp: log.timestamp,
        logs: [log],
        metadata: log.metadata,
        status: 'running'
      };
      groups.push(currentGroup);
    } else if (log.type === 'thinking') {
      const thinkingContent = log.metadata?.content || log.content;
      let thinkingGroup = groups.find(g => g.type === 'thinking');
      if (thinkingGroup) {
        thinkingGroup.thinking += thinkingContent;
      } else {
        groups.push({
          type: 'thinking',
          title: 'Reasoning',
          thinking: thinkingContent,
          timestamp: log.timestamp,
          logs: [log],
          status: 'running'
        });
      }
    } else if (log.type === 'llm_end') {
      if (currentGroup?.type === 'llm') {
        currentGroup.logs.push(log);
        currentGroup.status = 'complete';
        currentGroup.duration = log.metadata?.duration;
        currentGroup.endTimestamp = log.timestamp;
      }
      currentGroup = null;
    } else if (log.type === 'tool_start') {
      closeCurrentGroup();
      currentGroup = {
        type: 'tool',
        title: log.content,
        toolName: log.metadata?.tool_name || 'Tool',
        args: log.metadata?.args,
        timestamp: log.timestamp,
        logs: [log],
        status: 'running'
      };
      groups.push(currentGroup);
    } else if (log.type === 'tool_end') {
      if (currentGroup?.type === 'tool') {
        currentGroup.logs.push(log);
        currentGroup.status = 'complete';
        currentGroup.result = log.metadata?.result;
        currentGroup.duration = log.metadata?.duration;
      }
      currentGroup = null;
    } else if (log.type === 'error') {
      if (currentGroup) {
        currentGroup.logs.push(log);
        currentGroup.status = 'error';
        currentGroup.error = log.metadata?.error || log.content;
        currentGroup = null;
      } else {
        groups.push({
          type: 'error',
          title: log.content,
          timestamp: log.timestamp,
          logs: [log],
          error: log.metadata?.error || log.content,
          status: 'error'
        });
      }
    } else if (currentGroup) {
      currentGroup.logs.push(log);
    } else {
      groups.push({
        type: 'info',
        title: log.content || String(log),
        timestamp: log.timestamp,
        logs: [log],
        status: 'complete'
      });
    }
  });
  
  return groups;
}

// Terminal-style log entry for Activity tab
function TerminalLogEntry({ group, index }) {
  const [expanded, setExpanded] = useState(group.status === 'running');
  
  useEffect(() => {
    if (group.status === 'running') setExpanded(true);
  }, [group.status]);
  
  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  const typeConfig = {
    llm: { prefix: '✨', color: 'text-purple-400', label: 'LLM' },
    tool: { prefix: '🔧', color: 'text-amber-400', label: 'TOOL' },
    thinking: { prefix: '🧠', color: 'text-cyan-400', label: 'THINK' },
    info: { prefix: '→', color: 'text-blue-400', label: 'INFO' },
    error: { prefix: '✗', color: 'text-red-400', label: 'ERROR' },
  };
  
  const config = typeConfig[group.type] || typeConfig.info;
  const hasDetails = group.thinking || group.args || group.result || group.error;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="group"
    >
      {/* Main log line */}
      <div 
        className={clsx(
          'flex items-start gap-2 py-1 px-2 rounded cursor-pointer transition-colors',
          hasDetails && 'hover:bg-slate-800/50',
        )}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {/* Timestamp */}
        <span className="text-slate-600 text-xs w-[70px] flex-shrink-0">
          {formatTimestamp(group.timestamp)}
        </span>
        
        {/* Status indicator */}
        {group.status === 'running' ? (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
          </span>
        ) : group.status === 'error' ? (
          <span className="text-red-400 w-4 text-center flex-shrink-0">✗</span>
        ) : group.status === 'complete' ? (
          <span className="text-emerald-400 w-4 text-center flex-shrink-0">✓</span>
        ) : (
          <span className={clsx('w-4 text-center flex-shrink-0', config.color)}>{config.prefix}</span>
        )}
        
        {/* Label badge */}
        <span className={clsx(
          'text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0',
          group.type === 'llm' && 'bg-purple-500/20 text-purple-400',
          group.type === 'tool' && 'bg-amber-500/20 text-amber-400',
          group.type === 'thinking' && 'bg-cyan-500/20 text-cyan-400',
          group.type === 'info' && 'bg-blue-500/20 text-blue-400',
          group.type === 'error' && 'bg-red-500/20 text-red-400',
        )}>
          {config.label}
        </span>
        
        {/* Message */}
        <span className="text-slate-300 flex-1 truncate text-xs">
          {group.title || config.label}
        </span>
        
        {/* Duration */}
        {group.duration && (
          <span className="text-slate-500 text-[10px]">
            {group.duration < 1000 ? `${group.duration}ms` : `${(group.duration / 1000).toFixed(2)}s`}
          </span>
        )}
        
        {/* Expand indicator */}
        {hasDetails && (
          <ChevronDown className={clsx(
            'w-3 h-3 text-slate-500 transition-transform flex-shrink-0',
            expanded && 'rotate-180'
          )} />
        )}
      </div>
      
      {/* Expanded details */}
      <AnimatePresence>
        {expanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="ml-[90px] mr-2 mb-2 pl-3 border-l-2 border-slate-700 space-y-2">
              {group.thinking && (
                <div className="text-xs text-cyan-300/70 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {group.thinking}
                </div>
              )}
              {group.args && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase">args:</span>
                  <pre className="text-xs text-amber-300/70 overflow-x-auto">
                    {typeof group.args === 'string' ? group.args : JSON.stringify(group.args, null, 2)}
                  </pre>
                </div>
              )}
              {group.result && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase">result:</span>
                  <pre className="text-xs text-emerald-300/70 overflow-x-auto max-h-24">
                    {typeof group.result === 'string' 
                      ? (group.result.length > 300 ? group.result.slice(0, 300) + '...' : group.result)
                      : JSON.stringify(group.result, null, 2)}
                  </pre>
                </div>
              )}
              {group.error && (
                <div className="text-xs text-red-400">
                  <span className="text-[10px] text-slate-500 uppercase">error:</span> {group.error}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Log group expandable item
function LogGroupItem({ group, index }) {
  const [expanded, setExpanded] = useState(group.status === 'running');
  
  useEffect(() => {
    if (group.status === 'running') setExpanded(true);
    else if (group.status === 'complete' && group.type === 'thinking') setExpanded(false);
  }, [group.status, group.type]);

  const typeConfig = {
    llm: { icon: Sparkles, color: 'purple', label: 'LLM Call' },
    tool: { icon: Wrench, color: 'amber', label: 'Tool Call' },
    thinking: { icon: Brain, color: 'cyan', label: 'Reasoning' },
    info: { icon: MessageSquare, color: 'blue', label: 'Info' },
    error: { icon: AlertCircle, color: 'red', label: 'Error' },
  };
  
  const config = typeConfig[group.type] || typeConfig.info;
  const Icon = config.icon;
  const hasExpandableContent = group.thinking || group.args || group.result || group.error;

  return (
    <div className={clsx(
      'rounded-lg border overflow-hidden',
      group.status === 'error' 
        ? 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10' 
        : 'border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800/50'
    )}>
      <button
        onClick={() => hasExpandableContent && setExpanded(!expanded)}
        className={clsx(
          'w-full px-3 py-2 flex items-center gap-2 transition-colors',
          hasExpandableContent && 'hover:bg-slate-100 dark:hover:bg-gray-700/30'
        )}
      >
        <Icon className={clsx(
          'w-4 h-4 flex-shrink-0',
          config.color === 'purple' && 'text-purple-500',
          config.color === 'amber' && 'text-amber-500',
          config.color === 'cyan' && 'text-cyan-500',
          config.color === 'blue' && 'text-blue-500',
          config.color === 'red' && 'text-red-500'
        )} />
        
        <span className="text-xs font-medium text-slate-700 dark:text-gray-300 flex-1 text-left truncate">
          {group.title || config.label}
        </span>
        
        {group.status === 'running' && (
          <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
        )}
        {group.status === 'complete' && (
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
        )}
        {group.status === 'error' && (
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
        )}
        
        {group.duration && (
          <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono">
            {group.duration < 1000 ? `${group.duration}ms` : `${(group.duration / 1000).toFixed(1)}s`}
          </span>
        )}
        
        {hasExpandableContent && (
          <ChevronDown className={clsx(
            'w-3.5 h-3.5 text-slate-400 transition-transform',
            expanded && 'rotate-180'
          )} />
        )}
      </button>
      
      <AnimatePresence>
        {expanded && hasExpandableContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-200 dark:border-gray-700"
          >
            <div className="p-3 space-y-2">
              {group.thinking && (
                <div className="text-xs text-slate-600 dark:text-gray-400 bg-white dark:bg-gray-900/50 rounded p-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                  {group.thinking}
                </div>
              )}
              {group.args && (
                <div>
                  <h5 className="text-[10px] font-medium text-slate-500 uppercase mb-1">Arguments</h5>
                  <pre className="text-xs text-slate-600 dark:text-gray-400 bg-white dark:bg-gray-900/50 rounded p-2 overflow-x-auto">
                    {typeof group.args === 'string' ? group.args : JSON.stringify(group.args, null, 2)}
                  </pre>
                </div>
              )}
              {group.result && (
                <div>
                  <h5 className="text-[10px] font-medium text-slate-500 uppercase mb-1">Result</h5>
                  <pre className="text-xs text-slate-600 dark:text-gray-400 bg-white dark:bg-gray-900/50 rounded p-2 overflow-x-auto max-h-32">
                    {typeof group.result === 'string' 
                      ? (group.result.length > 500 ? group.result.slice(0, 500) + '...' : group.result)
                      : JSON.stringify(group.result, null, 2)}
                  </pre>
                </div>
              )}
              {group.error && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded p-2">
                  {group.error}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Tool call expandable item - enhanced for MCP tools
function ToolCallItem({ tool, index }) {
  const [expanded, setExpanded] = useState(false);
  const [showFullResult, setShowFullResult] = useState(false);
  
  const toolName = tool.name || tool.tool || 'unknown';
  const hasArgs = tool.args && Object.keys(tool.args || {}).length > 0;
  const hasResult = tool.result && (typeof tool.result === 'string' ? tool.result.length > 0 : true);
  const resultText = typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2);
  const resultPreview = resultText?.slice(0, 400);
  const hasMoreResult = resultText?.length > 400;
  
  // Determine tool category for icon/color
  const getToolStyle = (name) => {
    const n = name.toLowerCase();
    if (n.includes('search') || n.includes('web') || n.includes('duckduckgo')) {
      return { icon: '🔍', color: 'blue', label: 'Search' };
    }
    if (n.includes('file') || n.includes('read') || n.includes('write') || n.includes('fs')) {
      return { icon: '📁', color: 'amber', label: 'File' };
    }
    if (n.includes('python') || n.includes('exec') || n.includes('code') || n.includes('run')) {
      return { icon: '🐍', color: 'green', label: 'Execute' };
    }
    if (n.includes('database') || n.includes('sql') || n.includes('db')) {
      return { icon: '🗃️', color: 'purple', label: 'Database' };
    }
    if (n.includes('memory') || n.includes('store') || n.includes('cache')) {
      return { icon: '💾', color: 'cyan', label: 'Memory' };
    }
    if (n.includes('github') || n.includes('git')) {
      return { icon: '🐙', color: 'slate', label: 'Git' };
    }
    return { icon: '🔧', color: 'amber', label: 'Tool' };
  };
  
  const style = getToolStyle(toolName);
  
  return (
    <div className={clsx(
      'rounded-lg border overflow-hidden transition-all',
      expanded ? 'bg-white dark:bg-gray-800' : 'bg-slate-50 dark:bg-gray-800/50',
      'border-slate-200 dark:border-gray-700'
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-gray-700/30 transition-colors"
      >
        <span className="text-base flex-shrink-0">{style.icon}</span>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-slate-700 dark:text-gray-200 truncate">
            {toolName}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-gray-500">
            <span className={clsx(
              'px-1.5 py-0.5 rounded font-medium',
              style.color === 'blue' && 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
              style.color === 'amber' && 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
              style.color === 'green' && 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
              style.color === 'purple' && 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
              style.color === 'cyan' && 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400',
              style.color === 'slate' && 'bg-slate-200 text-slate-600 dark:bg-gray-600 dark:text-gray-300',
            )}>
              {style.label}
            </span>
            {tool.duration && (
              <span className="font-mono">
                {tool.duration < 1000 ? `${tool.duration}ms` : `${(tool.duration / 1000).toFixed(2)}s`}
              </span>
            )}
          </div>
        </div>
        {tool.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
        {tool.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
        {!tool.status && hasResult && <CheckCircle className="w-4 h-4 text-emerald-500/50 flex-shrink-0" />}
        <ChevronDown className={clsx(
          'w-4 h-4 text-slate-400 transition-transform flex-shrink-0',
          expanded && 'rotate-180'
        )} />
      </button>
      
      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-200 dark:border-gray-700"
          >
            <div className="p-3 space-y-3">
              {/* Arguments section */}
              {hasArgs && (
                <div>
                  <h5 className="text-[10px] font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <ArrowDownToLine className="w-3 h-3" />
                    Input Arguments
                  </h5>
                  <pre className="text-xs text-slate-600 dark:text-gray-400 bg-slate-50 dark:bg-gray-900/50 rounded-lg p-3 overflow-x-auto font-mono">
                    {typeof tool.args === 'string' ? tool.args : JSON.stringify(tool.args, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* Result section */}
              {hasResult && (
                <div>
                  <h5 className="text-[10px] font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <ArrowUpFromLine className="w-3 h-3" />
                    Execution Result
                  </h5>
                  <pre className={clsx(
                    'text-xs bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap',
                    'text-emerald-800 dark:text-emerald-300'
                  )}>
                    {showFullResult ? resultText : resultPreview}
                    {hasMoreResult && !showFullResult && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowFullResult(true); }}
                        className="text-emerald-600 dark:text-emerald-400 hover:underline ml-1"
                      >
                        ... Show more ({resultText.length.toLocaleString()} chars)
                      </button>
                    )}
                  </pre>
                </div>
              )}
              
              {/* No result message */}
              {!hasResult && !hasArgs && (
                <div className="text-xs text-slate-500 dark:text-gray-500 text-center py-4">
                  No arguments or results recorded
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Language/type configuration for beautiful icons
const ARTIFACT_CONFIG = {
  python: { icon: '🐍', color: 'blue', label: 'Python' },
  javascript: { icon: '📜', color: 'yellow', label: 'JavaScript' },
  typescript: { icon: '💠', color: 'blue', label: 'TypeScript' },
  html: { icon: '🌐', color: 'orange', label: 'HTML' },
  css: { icon: '🎨', color: 'pink', label: 'CSS' },
  json: { icon: '📋', color: 'green', label: 'JSON' },
  sql: { icon: '🗃️', color: 'cyan', label: 'SQL' },
  markdown: { icon: '📝', color: 'slate', label: 'Markdown' },
  bash: { icon: '💻', color: 'green', label: 'Bash' },
  shell: { icon: '💻', color: 'green', label: 'Shell' },
  yaml: { icon: '⚙️', color: 'red', label: 'YAML' },
  text: { icon: '📄', color: 'slate', label: 'Text' },
  image: { icon: '🖼️', color: 'purple', label: 'Image' },
  data: { icon: '📊', color: 'emerald', label: 'Data' },
  code: { icon: '💻', color: 'violet', label: 'Code' },
};

const getArtifactConfig = (artifact) => {
  const lang = artifact.language?.toLowerCase();
  const type = artifact.type?.toLowerCase();
  const name = artifact.name?.toLowerCase() || '';
  
  // Check by language first
  if (lang && ARTIFACT_CONFIG[lang]) return ARTIFACT_CONFIG[lang];
  
  // Check by file extension
  if (name.endsWith('.py')) return ARTIFACT_CONFIG.python;
  if (name.endsWith('.js') || name.endsWith('.jsx')) return ARTIFACT_CONFIG.javascript;
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return ARTIFACT_CONFIG.typescript;
  if (name.endsWith('.html')) return ARTIFACT_CONFIG.html;
  if (name.endsWith('.css')) return ARTIFACT_CONFIG.css;
  if (name.endsWith('.json')) return ARTIFACT_CONFIG.json;
  if (name.endsWith('.sql')) return ARTIFACT_CONFIG.sql;
  if (name.endsWith('.md')) return ARTIFACT_CONFIG.markdown;
  if (name.endsWith('.sh') || name.endsWith('.bash')) return ARTIFACT_CONFIG.bash;
  if (name.endsWith('.yaml') || name.endsWith('.yml')) return ARTIFACT_CONFIG.yaml;
  if (name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return ARTIFACT_CONFIG.image;
  
  // Check by type
  if (type?.includes('image')) return ARTIFACT_CONFIG.image;
  if (type?.includes('data') || type?.includes('json')) return ARTIFACT_CONFIG.data;
  if (type?.includes('code')) return ARTIFACT_CONFIG.code;
  
  return { icon: '📦', color: 'slate', label: 'File' };
};

// Artifact item - beautiful clickable card
function ArtifactItem({ artifact, index }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const config = getArtifactConfig(artifact);
  const fileName = artifact.name || artifact.title || `Artifact ${index + 1}`;
  const content = typeof artifact.content === 'string' 
    ? artifact.content 
    : JSON.stringify(artifact.content || artifact, null, 2);
  
  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/30',
    yellow: 'bg-yellow-100 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/30',
    orange: 'bg-orange-100 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/30',
    pink: 'bg-pink-100 dark:bg-pink-500/20 border-pink-200 dark:border-pink-500/30',
    green: 'bg-green-100 dark:bg-green-500/20 border-green-200 dark:border-green-500/30',
    cyan: 'bg-cyan-100 dark:bg-cyan-500/20 border-cyan-200 dark:border-cyan-500/30',
    red: 'bg-red-100 dark:bg-red-500/20 border-red-200 dark:border-red-500/30',
    slate: 'bg-slate-100 dark:bg-gray-700 border-slate-200 dark:border-gray-600',
    purple: 'bg-purple-100 dark:bg-purple-500/20 border-purple-200 dark:border-purple-500/30',
    emerald: 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/30',
    violet: 'bg-violet-100 dark:bg-violet-500/20 border-violet-200 dark:border-violet-500/30',
  };
  
  const badgeClasses = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    yellow: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
    slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={clsx(
        'rounded-xl border-2 overflow-hidden transition-all duration-200',
        colorClasses[config.color],
        expanded && 'shadow-lg'
      )}
    >
      {/* Header - clickable */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/50 dark:hover:bg-black/20 transition-colors cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
      >
        {/* Large emoji icon */}
        <span className="text-2xl flex-shrink-0">{config.icon}</span>
        
        {/* File info */}
        <div className="flex-1 text-left min-w-0">
          <div className="font-medium text-slate-800 dark:text-gray-100 truncate">
            {fileName}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={clsx(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded',
              badgeClasses[config.color]
            )}>
              {config.label}
            </span>
            {artifact.path && (
              <span className="text-[10px] text-slate-500 dark:text-gray-500 truncate">
                {artifact.path}
              </span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-white/70 dark:hover:bg-black/30 transition-colors"
            title="Copy content"
          >
            {copied ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <FileText className="w-4 h-4 text-slate-500 dark:text-gray-400" />
            )}
          </button>
          <ChevronDown className={clsx(
            'w-4 h-4 text-slate-500 dark:text-gray-400 transition-transform',
            expanded && 'rotate-180'
          )} />
        </div>
      </div>
      
      {/* Content - expandable */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-inherit"
          >
            <div className="p-3 bg-white/50 dark:bg-black/20">
              <pre className="text-xs text-slate-700 dark:text-gray-300 bg-slate-50 dark:bg-gray-900/50 rounded-lg p-3 overflow-x-auto max-h-72 whitespace-pre-wrap font-mono">
                {content}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AgentDetailPanel;