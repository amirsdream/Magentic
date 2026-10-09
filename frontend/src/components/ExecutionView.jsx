/**
 * ExecutionView - Unified component for showing execution progress, workflow, and response
 * Handles: workflow visualization, streaming response, and final output
 */

import React, { useState } from 'react';
import { Sparkles, FileCode, FileText, FileImage, File, Globe, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AgentLoopBar from './AgentLoopBar';
import MarkdownRenderer from './MarkdownRenderer';
import { ExecutionStatusHeader, TokenBreakdown } from './shared';

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

  // Get token usage (for TokenBreakdown component)
  const tokenUsage = execution?.token_usage;
  const hasTokens = tokenUsage?.total?.total_tokens > 0;
  const costFormatted = tokenUsage?.total?.cost_formatted || '$0.00';

  // Check if we have workflow data (plan/agents) - historical messages might only have output
  // Also show during initializing stage so user sees the DAG panel immediately
  const hasWorkflowData = execution?.plan || execution?.agents?.length > 0 || execution?.stage === 'initializing' || execution?.isLoading;

  // No execution data at all
  if (!execution) {
    return null;
  }

  // Clean Copilot-inspired theme — teal/sky, not purple
  const theme = isStopped
    ? {
        border: 'border-amber-400/30',
        bg: isCompact ? 'bg-white/40 dark:bg-slate-900/40' : 'bg-white/80 dark:bg-slate-900/60',
        icon: 'text-amber-600 dark:text-amber-400',
        title: 'text-amber-700 dark:text-amber-300',
        accent: 'bg-amber-500/15',
        hoverBg: 'hover:bg-amber-500/5',
      }
    : isComplete
      ? {
          border: 'border-teal-500/25',
          bg: isCompact ? 'bg-white/40 dark:bg-slate-900/40' : 'bg-white/80 dark:bg-slate-900/60',
          icon: 'text-teal-600 dark:text-teal-400',
          title: 'text-teal-700 dark:text-teal-300',
          accent: 'bg-teal-500/15',
          hoverBg: 'hover:bg-teal-500/5',
        }
      : {
          border: 'border-slate-200/90 dark:border-slate-700/80',
          bg: 'bg-white/85 dark:bg-slate-900/65',
          icon: 'text-sky-600 dark:text-sky-400',
          title: 'text-slate-800 dark:text-slate-100',
          accent: 'bg-sky-500/15',
          hoverBg: 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40',
        };

  // Check if we have response content
  const hasResponse = execution?.streamingContent || execution?.output;
  const hasArtifacts = execution?.artifacts?.length > 0;

  const divider = isStopped
    ? 'border-amber-400/20'
    : isComplete
      ? 'border-teal-500/20'
      : 'border-slate-200/70 dark:border-slate-700/70';

  const content = (
    <div
      className={`${theme.bg} border ${theme.border} ${
        isCompact ? 'rounded-xl' : 'rounded-2xl'
      } overflow-hidden ${isCompact ? '' : 'max-w-3xl'} shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-sm`}
    >
      {/* Agent loop — Copilot-style vertical progress */}
      {showDetails && (
        <>
          <ExecutionStatusHeader
            execution={execution}
            isComplete={isComplete}
            isStopped={isStopped}
            hasWorkflowData={hasWorkflowData}
            showFlow={showFlow}
            onToggleFlow={() => setShowFlow(!showFlow)}
            isCompact={isCompact}
            theme={theme}
          />

          {isComplete && hasTokens && (
            <TokenBreakdown tokenUsage={tokenUsage} costFormatted={costFormatted} />
          )}

          {hasWorkflowData && (
            <AnimatePresence>
              {showFlow && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className={`border-t ${divider}`}
                >
                  <div className="max-h-[480px] overflow-y-auto">
                    <AgentLoopBar
                      execution={execution}
                      compact={isCompact}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </>
      )}

      {(execution?.streamingContent || execution?.output) && (
        <div className={`${showDetails ? `border-t ${divider}` : ''} p-4`}>
          <div className="prose prose-slate dark:prose-invert prose-sm max-w-none">
            <MarkdownRenderer
              content={execution.streamingContent || execution.output}
              references={execution?.references || []}
            />
            {execution.stage === 'streaming' && (
              <span className="inline-block w-1.5 h-4 bg-sky-500 dark:bg-sky-400 animate-pulse ml-0.5 align-middle rounded-sm" />
            )}
          </div>
        </div>
      )}

      {execution?.artifacts?.length > 0 && (
        <div className={`border-t ${divider} p-4`}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            {execution.artifacts.length} artifact
            {execution.artifacts.length !== 1 ? 's' : ''} created
          </p>
          <div className="flex flex-wrap gap-2">
            {execution.artifacts.map((artifact, idx) => {
              const Icon = getArtifactIcon(artifact);
              const filename =
                artifact.path?.split('/').pop() || artifact.name || `artifact-${idx}`;
              return (
                <button
                  key={artifact.path || idx}
                  onClick={() => onPreviewArtifact?.(artifact)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-200/80 dark:hover:bg-slate-700/60 rounded-lg transition-colors text-sm text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
                >
                  <Icon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span className="truncate max-w-[200px]">{filename}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {execution?.references?.length > 0 && (
        <div className={`border-t ${divider} px-4 py-2.5`}>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-0.5">
              Sources
            </span>
            <div className="flex-1 flex flex-wrap gap-x-3 gap-y-1">
              {execution.references.map((ref, idx) => {
                const isWeb = ref.type === 'web' || ref.url;
                return (
                  <a
                    key={ref.url || ref.source || idx}
                    href={ref.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors group"
                  >
                    <span
                      className={`text-[9px] font-semibold px-1 py-0.5 rounded ${
                        isWeb
                          ? 'bg-sky-100/70 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400'
                          : 'bg-amber-100/70 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-[180px] group-hover:underline">
                      {ref.title ||
                        (ref.url ? new URL(ref.url).hostname : ref.source) ||
                        'Source'}
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
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
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
