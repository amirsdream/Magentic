/**
 * WorkflowDetail — inside a selected workflow:
 * visual flow (main) + chat + step actions.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Pencil,
  Eye,
  Plus,
  Save,
  MessageSquare,
  GitBranch,
  ListTree,
} from 'lucide-react';
import ChatArea from '../ChatArea';
import EnhancedChatInput from '../EnhancedChatInput';
import HitlApprovalCard from './HitlApprovalCard';
import WorkflowCanvas from './WorkflowCanvas';
import AgentActionFlow from './AgentActionFlow';
import { createStep, saveWorkflowToLibrary } from '../../utils/workflowModel';

const ROLE_OPTIONS = [
  'coordinator',
  'researcher',
  'analyzer',
  'coder',
  'writer',
  'synthesizer',
  'critic',
  'planner',
];

const MOBILE_TABS = [
  { id: 'flow', label: 'Flow', icon: GitBranch },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'actions', label: 'Actions', icon: ListTree },
];

export default function WorkflowDetail({
  workflow,
  onWorkflowChange,
  onBack,
  onSaved,
  currentExecution,
  messages,
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
}) {
  const [editMode, setEditMode] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [mobileTab, setMobileTab] = useState('flow');
  const [draft, setDraft] = useState(workflow);

  useEffect(() => {
    setDraft(workflow);
  }, [workflow]);

  useEffect(() => {
    onWorkflowChange?.(draft);
  }, [draft, onWorkflowChange]);

  // Auto-focus running step
  useEffect(() => {
    const agents = currentExecution?.agents;
    if (!Array.isArray(agents)) return;
    const running = agents.find((a) => a.status === 'running');
    if (running?.agent_id) setSelectedStepId(running.agent_id);
  }, [currentExecution?.agents]);

  const selectedStep = useMemo(
    () => draft?.steps?.find((s) => s.id === selectedStepId) || null,
    [draft, selectedStepId]
  );

  const approval = currentExecution?.approval || null;
  const awaitingApproval =
    currentExecution?.stage === 'awaiting_approval' || Boolean(approval?.pipeline_id);

  const updateStep = useCallback((stepId, patch) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const addStep = useCallback(() => {
    setDraft((prev) => {
      if (!prev) return prev;
      const step = createStep(prev.id, prev.steps.length);
      setSelectedStepId(step.id);
      setEditMode(true);
      return {
        ...prev,
        steps: [...prev.steps, step],
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const removeStep = useCallback(
    (stepId) => {
      setDraft((prev) => {
        if (!prev || prev.steps.length <= 1) return prev;
        return {
          ...prev,
          steps: prev.steps.filter((s) => s.id !== stepId),
          updatedAt: new Date().toISOString(),
        };
      });
      if (selectedStepId === stepId) setSelectedStepId(null);
    },
    [selectedStepId]
  );

  const handleSave = useCallback(() => {
    if (!draft) return;
    const next = saveWorkflowToLibrary(draft);
    onSaved?.(next, draft);
  }, [draft, onSaved]);

  const stageLabel = (draft?.stage || 'idle').replace(/_/g, ' ');

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Detail header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 dark:border-slate-800 px-3 py-2.5 bg-white/60 dark:bg-slate-950/50">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Workflows
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-slate-900 dark:text-white">
            {draft?.name || 'Workflow'}
          </p>
          <p className="truncate text-[11px] capitalize text-slate-500 dark:text-slate-400">
            {stageLabel}
            {draft?.steps?.length != null ? ` · ${draft.steps.length} steps` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium border ${
            editMode
              ? 'border-amber-400/50 bg-amber-500/10 text-amber-800 dark:text-amber-200'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          {editMode ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {editMode ? 'Editing' : 'View'}
        </button>
        {editMode && (
          <>
            <button
              type="button"
              onClick={addStep}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-300"
            >
              <Plus className="h-3 w-3" /> Step
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-teal-500"
            >
              <Save className="h-3 w-3" /> Save
            </button>
          </>
        )}
      </div>

      {/* Mobile tabs */}
      <div className="flex lg:hidden border-b border-slate-200/80 dark:border-slate-800">
        {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
          const active = mobileTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium ${
                active ? 'text-sky-700 dark:text-sky-300' : 'text-slate-500'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {active && (
                <motion.span
                  layoutId="wf-detail-tab"
                  className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-sky-500"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Body: canvas + actions on top row, chat below on desktop;
          or stacked tabs on mobile */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Flow + edit */}
        <div
          className={`min-h-0 min-w-0 flex-1 flex-col ${
            mobileTab === 'flow' ? 'flex' : 'hidden'
          } lg:flex`}
        >
          <div className="relative min-h-0 flex-1">
            <WorkflowCanvas
              workflow={draft}
              selectedStepId={selectedStepId}
              onSelectStep={setSelectedStepId}
              editMode={editMode}
            />
          </div>

          <AnimatePresence>
            {editMode && selectedStep && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-slate-200/70 dark:border-slate-800"
              >
                <div className="space-y-2 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Edit step
                    </p>
                    <button
                      type="button"
                      onClick={() => removeStep(selectedStep.id)}
                      className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[11px] text-slate-500">
                      Role
                      <select
                        value={selectedStep.role}
                        onChange={(e) =>
                          updateStep(selectedStep.id, { role: e.target.value })
                        }
                        className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-[12px]"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[11px] text-slate-500">
                      Layer
                      <input
                        type="number"
                        min={0}
                        value={selectedStep.layer ?? 0}
                        onChange={(e) =>
                          updateStep(selectedStep.id, {
                            layer: Number(e.target.value) || 0,
                          })
                        }
                        className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-[12px]"
                      />
                    </label>
                  </div>
                  <label className="block text-[11px] text-slate-500">
                    Task
                    <textarea
                      value={selectedStep.task || ''}
                      onChange={(e) =>
                        updateStep(selectedStep.id, { task: e.target.value })
                      }
                      rows={2}
                      className="mt-1 w-full resize-none rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-[12px]"
                    />
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Desktop: chat docked under flow */}
          <div className="hidden lg:flex max-h-[38%] min-h-[200px] flex-col border-t border-slate-200/70 dark:border-slate-800 bg-white/40 dark:bg-slate-950/40">
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
                  onApprove={onApprove}
                  onReject={onReject}
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
              showSuggestions={false}
              disabledMessage={
                awaitingApproval
                  ? 'Approve or reject the workflow to continue…'
                  : disabledMessage
              }
            />
          </div>
        </div>

        {/* Actions rail */}
        <div
          className={`w-full lg:w-[min(280px,28%)] lg:min-w-[220px] border-l border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex-col ${
            mobileTab === 'actions' ? 'flex' : 'hidden'
          } lg:flex`}
        >
          <AgentActionFlow step={selectedStep} workflowName={draft?.name} />
        </div>

        {/* Mobile chat tab */}
        <div
          className={`min-h-0 flex-1 flex-col ${
            mobileTab === 'chat' ? 'flex' : 'hidden'
          } lg:hidden`}
        >
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
                onApprove={onApprove}
                onReject={onReject}
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
            showSuggestions={false}
            disabledMessage={
              awaitingApproval
                ? 'Approve or reject the workflow to continue…'
                : disabledMessage
            }
          />
        </div>
      </div>
    </div>
  );
}
