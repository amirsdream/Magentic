/**
 * ExecutionView - Unified component for showing execution progress, workflow, and response
 * Handles: workflow visualization, streaming response, and final output
 */

import React, { useState } from 'react';
import { CheckCircle, Sparkles, Brain, Zap, ChevronUp, ChevronDown, Coins, DollarSign, StopCircle, FileCode, FileText, FileImage, File, Globe, BookOpen, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WorkflowVisualization from './WorkflowVisualization';
import MarkdownRenderer from './MarkdownRenderer';

// Inline reference badge with tooltip
const ReferenceTooltip = ({ reference, index, isWeb }) => {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = isWeb ? Globe : BookOpen;
  
  const handleClick = () => {
    if (reference.url) {
      window.open(reference.url, '_blank', 'noopener,noreferrer');
    }
  };
  
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1 text-[10px] font-semibold rounded transition-all duration-200 ${
          isWeb 
            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/30' 
            : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30'
        } ${reference.url ? 'cursor-pointer' : 'cursor-default'}`}
      >
        [{index}]
      </button>
      
      {/* Tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-slate-200 dark:border-gray-700"
            style={{ pointerEvents: 'none' }}
          >
            {/* Arrow */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-white dark:bg-gray-800 border-r border-b border-slate-200 dark:border-gray-700" />
            
            <div className="relative">
              <div className="flex items-start gap-2">
                <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isWeb ? 'text-blue-500' : 'text-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-gray-200 line-clamp-2">
                    {reference.title || reference.source || 'Unknown source'}
                  </p>
                  {reference.snippet && (
                    <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {reference.snippet}
                    </p>
                  )}
                  {reference.url && (
                    <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-1 truncate">
                      {new URL(reference.url).hostname}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Get icon for artifact based on type/extension
const getArtifactIcon = (artifact) => {
  const ext = artifact.path?.split('.').pop()?.toLowerCase() || '';
  const type = artifact.type?.toLowerCase() || '';
  
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'sh', 'bash', 'sql'].includes(ext) || type === 'code') {
    return FileCode;
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext) || type === 'image') {
    return FileImage;
  }
  if (['md', 'txt', 'doc', 'docx', 'pdf'].includes(ext) || type === 'document' || type === 'text') {
    return FileText;
  }
  return File;
};

function ExecutionView({ 
  execution, 
  variant = 'auto', // 'auto' | 'live' | 'summary' | 'compact'
  defaultExpanded = null, // null means auto-detect
  showAvatar = null, // null means auto-detect
  messageId = 'current',
  onRetry = null, // callback to retry execution with same query
  onPreviewArtifact = null, // callback to open artifact preview panel
  showDetails = true, // controlled by header toggle - true = show workflow, false = message only
}) {
  // Determine execution state
  const isStopped = execution?.stage === 'stopped';
  
  const isComplete =
    execution?.stage === 'complete' ||
    (execution?.plan &&
      execution?.agents &&
      execution?.plan?.agents?.length > 0 &&
      execution?.agents?.length === execution?.plan?.agents?.length &&
      execution?.agents?.every((a) => a.status === 'complete' || a.status === 'completed'));

  // Auto-detect settings based on variant and completion state
  const isLive = variant === 'live' || (variant === 'auto' && !isComplete && !isStopped);
  const isSummary = variant === 'summary' || variant === 'compact' || (variant === 'auto' && (isComplete || isStopped));
  const isCompact = variant === 'compact';
  
  // Local state for expanding/collapsing workflow within the details view
  const [showFlow, setShowFlow] = useState(
    defaultExpanded !== null ? defaultExpanded : true
  );

  // Determine if we should show avatar (only for live view in chat)
  const shouldShowAvatar = showAvatar !== null ? showAvatar : isLive;

  // Get token usage
  const tokenUsage = execution?.token_usage;
  const hasTokens = tokenUsage?.total?.total_tokens > 0;
  const hasCost = tokenUsage?.total?.total_cost > 0;
  const costFormatted = tokenUsage?.total?.cost_formatted || '$0.00';

  // Count agents (default to 1 for coordinator if no agents yet)
  const agentCount = execution?.agents?.length || 1;
  const completedAgents = execution?.agents?.filter(a => a.status === 'complete' || a.status === 'completed').length || 0;
  const stoppedAgents = execution?.agents?.filter(a => a.status === 'stopped').length || 0;
  const pendingAgents = execution?.agents?.filter(a => a.status === 'pending').length || 0;
  const totalAgents = execution?.plan?.total_agents || agentCount;
  const runningAgents = execution?.agents?.filter(a => a.status === 'running').length || 0;
  const totalLayers = execution?.plan?.total_layers || 1;

  // Check if we have workflow data (plan/agents) - historical messages might only have output
  const hasWorkflowData = execution?.plan || execution?.agents?.length > 0;

  // No execution data at all
  if (!execution) {
    return null;
  }

  // Theme colors based on state - stopped (orange), complete (green), or running (purple)
  const theme = isStopped
    ? {
        border: 'border-orange-500/30',
        bg: isCompact ? 'bg-white/30 dark:bg-gray-800/30' : 'bg-white/70 dark:bg-gray-800/50',
        icon: 'text-orange-500 dark:text-orange-400',
        title: 'text-orange-600 dark:text-orange-400',
        accent: 'bg-orange-500/20',
        hoverBg: 'hover:bg-orange-500/5'
      }
    : isComplete 
      ? {
          border: 'border-green-500/30',
          bg: isCompact ? 'bg-white/30 dark:bg-gray-800/30' : 'bg-white/70 dark:bg-gray-800/50',
          icon: 'text-green-500 dark:text-green-400',
          title: 'text-green-600 dark:text-green-400',
          accent: 'bg-green-500/20',
          hoverBg: 'hover:bg-green-500/5'
        }
      : {
          border: 'border-slate-200/80 dark:border-purple-500/30',
          bg: 'bg-white/70 dark:bg-gray-800/50',
          icon: 'text-violet-600 dark:text-purple-300',
          title: 'text-violet-600 dark:text-purple-300',
          accent: 'bg-violet-500/20 dark:bg-purple-500/20',
          hoverBg: 'hover:bg-slate-50/50 dark:hover:bg-gray-700/30'
        };

  // Check if we have response content
  const hasResponse = execution?.streamingContent || execution?.output;
  const hasArtifacts = execution?.artifacts?.length > 0;

  const content = (
    <div className={`${theme.bg} border ${theme.border} ${isCompact ? 'rounded-lg' : 'rounded-2xl rounded-tl-sm'} overflow-hidden ${isCompact ? '' : 'max-w-4xl'} shadow-sm`}>
      
      {/* Workflow View - Header, token breakdown, and DAG (controlled by showDetails from header) */}
      {showDetails && (
        <>
          {/* Header - Clickable to expand/collapse workflow visualization */}
          <button
            onClick={() => hasWorkflowData && setShowFlow(!showFlow)}
            className={`w-full ${isCompact ? 'p-3' : 'p-4'} flex items-center justify-between ${hasWorkflowData ? theme.hoverBg : ''} transition-colors ${hasWorkflowData ? 'cursor-pointer' : ''}`}
          >
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className="relative">
            {isStopped ? (
              <>
                <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <StopCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="absolute inset-0 bg-orange-400/20 dark:bg-orange-400/20 rounded-full blur-md" />
              </>
            ) : isComplete ? (
              <>
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-green-400" />
                </div>
                <div className="absolute inset-0 bg-emerald-400/20 dark:bg-green-400/20 rounded-full blur-md" />
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-purple-600 dark:to-pink-600 flex items-center justify-center">
                  <Brain className="w-3 h-3 text-white animate-pulse" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-violet-400/50 dark:border-purple-400/50"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
              </>
            )}
          </div>

          {/* Title and status */}
          <div className="text-left">
            <h3 className={`font-semibold ${theme.title} flex items-center gap-2`}>
              <span>
                {isStopped
                  ? 'Execution Stopped'
                  : isComplete 
                    ? 'Execution Complete' 
                    : 'Executing Workflow'}
              </span>
              {!isComplete && !isStopped && (
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-violet-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-violet-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-violet-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-600 dark:text-gray-400">
              {isStopped
                ? `${completedAgents} completed${stoppedAgents > 0 ? ` • ${stoppedAgents} stopped` : ''}${pendingAgents > 0 ? ` • ${pendingAgents} skipped` : ''}`
                : `${completedAgents}/${totalAgents} agents${runningAgents > 0 ? ` • ${runningAgents} running` : ''} • ${totalLayers} layer${totalLayers !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Token and cost badges */}
          {hasTokens && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-full shadow-sm">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                  {tokenUsage.total.total_tokens.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-full shadow-sm">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {costFormatted}
                </span>
              </div>
            </div>
          )}

          {/* Plan info badge (when no tokens yet) */}
          {execution?.plan && !hasTokens && (
            <div className="text-xs text-slate-500 dark:text-gray-500 flex items-center gap-2">
              <Zap className="w-3 h-3 text-amber-500 dark:text-yellow-400" />
              {totalAgents} agents
            </div>
          )}

          {/* Expand/collapse chevron - only show if we have workflow data */}
          {hasWorkflowData && (
            <div className="p-1 rounded-full bg-slate-100 dark:bg-gray-700/50">
              {showFlow ? (
                <ChevronUp className="w-4 h-4 text-slate-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500 dark:text-gray-400" />
              )}
            </div>
          )}
        </div>
      </button>

      {/* Token breakdown - only show when complete and has tokens */}
      {isComplete && hasTokens && (
        <div className="relative mx-4 mb-4">
          {/* Glow effects underneath */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute left-[12%] top-1/2 -translate-y-1/2 w-14 h-10 bg-violet-500/15 dark:bg-violet-500/25 rounded-full blur-2xl"></div>
            <div className="absolute left-[37%] top-1/2 -translate-y-1/2 w-14 h-10 bg-blue-500/15 dark:bg-blue-500/25 rounded-full blur-2xl"></div>
            <div className="absolute left-[62%] top-1/2 -translate-y-1/2 w-14 h-10 bg-emerald-500/15 dark:bg-emerald-500/25 rounded-full blur-2xl"></div>
            <div className="absolute right-[8%] top-1/2 -translate-y-1/2 w-14 h-10 bg-amber-500/15 dark:bg-amber-500/25 rounded-full blur-2xl"></div>
          </div>
          
          {/* Glass container */}
          <div className="relative px-5 py-3.5 backdrop-blur-sm bg-white/50 dark:bg-gray-900/50 rounded-xl border border-white/60 dark:border-gray-700/40 shadow-sm">
            <div className="flex items-center justify-around">
              {/* Planning */}
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-2 h-2 rounded-full bg-violet-400 shadow-sm shadow-violet-400/50 flex-shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 font-medium leading-none mb-1">Planning</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 leading-none tabular-nums">
                    {tokenUsage.planning?.total_tokens?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
              
              <div className="h-10 w-px bg-gradient-to-b from-transparent via-slate-200/60 dark:via-gray-600/40 to-transparent flex-shrink-0"></div>
              
              {/* Input */}
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50 flex-shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 font-medium leading-none mb-1">Input</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 leading-none tabular-nums">
                    {tokenUsage.total.prompt_tokens?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
              
              <div className="h-10 w-px bg-gradient-to-b from-transparent via-slate-200/60 dark:via-gray-600/40 to-transparent flex-shrink-0"></div>
              
              {/* Output */}
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 flex-shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 font-medium leading-none mb-1">Output</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 leading-none tabular-nums">
                    {tokenUsage.total.completion_tokens?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
              
              <div className="h-10 w-px bg-gradient-to-b from-transparent via-slate-200/60 dark:via-gray-600/40 to-transparent flex-shrink-0"></div>
              
              {/* Cost */}
              <div className="flex items-center gap-2.5 px-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 flex-shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-gray-500 font-medium leading-none mb-1">Cost</p>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 leading-none tabular-nums">
                    {costFormatted}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Workflow Visualization - only if we have workflow data */}
      {hasWorkflowData && (
        <AnimatePresence>
          {showFlow && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`border-t ${isStopped ? 'border-orange-500/20' : isComplete ? 'border-green-500/20' : 'border-slate-200/50 dark:border-purple-500/20'}`}
            >
              {/* Auto height - content determines size, with max constraint */}
              <div className="max-h-[500px] overflow-y-auto">
                <WorkflowVisualization
                  execution={execution}
                  isPanel={true}
                  isLive={!isComplete && !isStopped}
                  onRetry={onRetry}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
        </>
      )}

      {/* Response content - streaming or final */}
      {(execution?.streamingContent || execution?.output) && (
        <div className={`${showDetails ? 'border-t' : ''} ${isStopped ? 'border-orange-500/20' : isComplete ? 'border-green-500/20' : 'border-slate-200/50 dark:border-purple-500/20'} p-4`}>
          <div className="prose prose-slate dark:prose-invert prose-sm max-w-none">
            <MarkdownRenderer 
              content={execution.streamingContent || execution.output} 
              references={execution?.references || []}
            />
            {execution.stage === 'streaming' && (
              <span className="inline-block w-2 h-4 bg-violet-500 dark:bg-purple-400 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        </div>
      )}

      {/* Artifacts - clickable to open preview panel */}
      {execution?.artifacts?.length > 0 && (
        <div className={`border-t ${isStopped ? 'border-orange-500/20' : isComplete ? 'border-green-500/20' : 'border-slate-200/50 dark:border-purple-500/20'} p-4`}>
          <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-2">
            {execution.artifacts.length} artifact{execution.artifacts.length !== 1 ? 's' : ''} created
          </p>
          <div className="flex flex-wrap gap-2">
            {execution.artifacts.map((artifact, idx) => {
              const Icon = getArtifactIcon(artifact);
              const filename = artifact.path?.split('/').pop() || artifact.name || `artifact-${idx}`;
              return (
                <button
                  key={artifact.path || idx}
                  onClick={() => onPreviewArtifact?.(artifact)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-gray-700/50 hover:bg-slate-200 dark:hover:bg-gray-600/50 rounded-lg transition-colors text-sm text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-600"
                >
                  <Icon className="w-4 h-4 text-violet-500 dark:text-purple-400" />
                  <span className="truncate max-w-[200px]">{filename}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* References - Compact inline list */}
      {execution?.references?.length > 0 && (
        <div className={`border-t ${isStopped ? 'border-orange-500/20' : isComplete ? 'border-green-500/20' : 'border-slate-200/50 dark:border-purple-500/20'} px-4 py-2.5`}>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wide mt-0.5">Sources</span>
            <div className="flex-1 flex flex-wrap gap-x-3 gap-y-1">
              {execution.references.map((ref, idx) => {
                const isWeb = ref.type === 'web' || ref.url;
                return (
                  <a
                    key={ref.url || ref.source || idx}
                    href={ref.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
                  >
                    <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${
                      isWeb 
                        ? 'bg-blue-100/70 dark:bg-blue-500/15 text-blue-500 dark:text-blue-400' 
                        : 'bg-amber-100/70 dark:bg-amber-500/15 text-amber-500 dark:text-amber-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-[180px] group-hover:underline">
                      {ref.title || (ref.url ? new URL(ref.url).hostname : ref.source) || 'Source'}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Wrap with avatar for live view
  if (shouldShowAvatar) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-3"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div className="absolute inset-0 bg-violet-500/20 dark:bg-purple-500/30 rounded-full blur-lg animate-pulse" />
        </div>

        {/* Content */}
        <div className="flex-1">
          {content}
        </div>
      </motion.div>
    );
  }

  return content;
}

export default ExecutionView;
