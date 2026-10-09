/**
 * StudioWorkspace — three-pane Magentic studio:
 * chat | workflow YAML | steps (+ HITL gate in chat column)
 */

import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileCode2, ListOrdered, MessageSquare } from 'lucide-react';
import ChatArea from '../ChatArea';
import EnhancedChatInput from '../EnhancedChatInput';
import HitlApprovalCard from './HitlApprovalCard';
import WorkflowYamlPanel from './WorkflowYamlPanel';
import StepsRail from './StepsRail';

const MOBILE_TABS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'yaml', label: 'YAML', icon: FileCode2 },
  { id: 'steps', label: 'Steps', icon: ListOrdered },
];

export default function StudioWorkspace({
  messages,
  currentExecution,
  onRetry,
  onPreviewArtifact,
  showExecutionDetails,
  onSend,
  onStop,
  onApprove,
  onReject,
  isConnected,
  isProcessing,
  disabled,
  disabledMessage,
  showSuggestions,
}) {
  const [mobileTab, setMobileTab] = useState('chat');
  const approval = currentExecution?.approval || null;
  const awaitingApproval =
    currentExecution?.stage === 'awaiting_approval' || Boolean(approval?.pipeline_id);

  const handleApprove = useCallback(
    (pipelineId) => {
      onApprove?.(pipelineId);
    },
    [onApprove]
  );

  const handleReject = useCallback(
    (pipelineId) => {
      onReject?.(pipelineId);
    },
    [onReject]
  );

  const chatColumn = (
    <div className="flex h-full min-w-0 flex-col">
      <ChatArea
        messages={messages}
        currentExecution={currentExecution}
        onRetry={onRetry}
        onPreviewArtifact={onPreviewArtifact}
        showExecutionDetails={showExecutionDetails}
        studioMode
      />

      <AnimatePresence>
        {awaitingApproval && (
          <HitlApprovalCard
            approval={approval}
            onApprove={handleApprove}
            onReject={handleReject}
            disabled={!isConnected}
          />
        )}
      </AnimatePresence>

      <EnhancedChatInput
        onSend={onSend}
        onStop={onStop}
        isConnected={isConnected}
        disabled={disabled || awaitingApproval}
        isProcessing={isProcessing}
        showSuggestions={showSuggestions}
        disabledMessage={
          awaitingApproval
            ? 'Approve or reject the workflow to continue…'
            : disabledMessage
        }
      />
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Mobile tab bar */}
      <div className="flex lg:hidden border-b border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm">
        {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
          const active = mobileTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium transition-colors ${
                active
                  ? 'text-sky-700 dark:text-sky-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {active && (
                <motion.span
                  layoutId="studio-mobile-tab"
                  className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-sky-500"
                />
              )}
              {id === 'chat' && awaitingApproval && (
                <span className="absolute top-1.5 right-[18%] h-1.5 w-1.5 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop three-pane / mobile single pane */}
      <div className="flex flex-1 min-h-0">
        <div
          className={`min-w-0 flex-1 flex-col ${
            mobileTab === 'chat' ? 'flex' : 'hidden'
          } lg:flex`}
        >
          {chatColumn}
        </div>

        <div
          className={`w-full lg:w-[min(340px,32%)] lg:min-w-[260px] border-l border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 backdrop-blur-[2px] flex-col ${
            mobileTab === 'yaml' ? 'flex' : 'hidden'
          } lg:flex`}
        >
          <WorkflowYamlPanel execution={currentExecution} />
        </div>

        <div
          className={`w-full lg:w-[min(300px,28%)] lg:min-w-[240px] border-l border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex-col ${
            mobileTab === 'steps' ? 'flex' : 'hidden'
          } lg:flex`}
        >
          <StepsRail execution={currentExecution} />
        </div>
      </div>
    </div>
  );
}
