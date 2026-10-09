/**
 * StudioWorkspace — chat-first home to create workflows,
 * then open a pipeline (flow + chat + actions) from Ropex YAML.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StudioHome from './StudioHome';
import WorkflowDetail from './WorkflowDetail';
import {
  workflowFromExecution,
  mergeLiveIntoWorkflow,
  emptyWorkflow,
  loadWorkflowLibrary,
  saveWorkflowToLibrary,
} from '../../utils/workflowModel';

function buildCatalog({ liveWorkflow, historyWorkflows, saved }) {
  const items = [];
  if (liveWorkflow) {
    items.push({
      ...liveWorkflow,
      _bucket: 'live',
      name: liveWorkflow.name || 'Live pipeline',
    });
  }
  historyWorkflows.forEach((w) => {
    if (!items.some((i) => i.id === w.id)) {
      items.push({ ...w, _bucket: 'history' });
    }
  });
  saved.forEach((w) => {
    if (!items.some((i) => i.id === w.id)) {
      items.push({ ...w, _bucket: w.source === 'draft' ? 'draft' : 'saved' });
    }
  });
  return items;
}

export default function StudioWorkspace({
  messages,
  currentExecution,
  executionHistory = [],
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
  const [view, setView] = useState('home'); // 'home' | 'detail'
  const [saved, setSaved] = useState(() => loadWorkflowLibrary());
  const [openWorkflow, setOpenWorkflow] = useState(null);
  const liveIdRef = useRef(null);
  const demoEnteredRef = useRef(false);

  const liveWorkflow = useMemo(
    () => workflowFromExecution(currentExecution, { source: 'live' }),
    [currentExecution]
  );

  const historyWorkflows = useMemo(
    () =>
      (executionHistory || [])
        .map((ex, idx) =>
          workflowFromExecution(ex, {
            id: ex.pipelineId || ex.session_id || `hist_${idx}`,
            name: ex.query || ex.plan?.description || `Run ${idx + 1}`,
            source: 'history',
          })
        )
        .filter(Boolean),
    [executionHistory]
  );

  const catalog = useMemo(
    () => buildCatalog({ liveWorkflow, historyWorkflows, saved }),
    [liveWorkflow, historyWorkflows, saved]
  );

  // New live pipeline → open detail automatically
  useEffect(() => {
    if (!liveWorkflow) return;
    if (liveWorkflow.id === liveIdRef.current) {
      if (view === 'detail' && openWorkflow?.id === liveWorkflow.id) {
        setOpenWorkflow(mergeLiveIntoWorkflow(liveWorkflow, currentExecution));
      }
      return;
    }
    liveIdRef.current = liveWorkflow.id;
    setOpenWorkflow(mergeLiveIntoWorkflow(liveWorkflow, currentExecution));
    setView('detail');
  }, [liveWorkflow, currentExecution, view, openWorkflow?.id]);

  useEffect(() => {
    if (demoEnteredRef.current) return;
    if (typeof window === 'undefined') return;
    const demo = new URLSearchParams(window.location.search).get('demo');
    if ((demo === 'hitl' || demo === 'loop') && liveWorkflow) {
      demoEnteredRef.current = true;
      setOpenWorkflow(mergeLiveIntoWorkflow(liveWorkflow, currentExecution));
      setView('detail');
    }
  }, [liveWorkflow, currentExecution]);

  const handleOpen = useCallback(
    (item) => {
      const wf =
        item._bucket === 'live'
          ? mergeLiveIntoWorkflow(item, currentExecution)
          : { ...item };
      setOpenWorkflow(wf);
      setView('detail');
    },
    [currentExecution]
  );

  const handleCreate = useCallback(() => {
    const wf = emptyWorkflow('Untitled pipeline');
    setSaved(saveWorkflowToLibrary(wf));
    setOpenWorkflow(wf);
    setView('detail');
  }, []);

  const handleBack = useCallback(() => {
    setView('home');
    setSaved(loadWorkflowLibrary());
  }, []);

  const handleSaved = useCallback((library, draft) => {
    setSaved(library);
    if (draft) setOpenWorkflow(draft);
  }, []);

  /** From home chat: send creates a live pipeline; we auto-enter on plan. */
  const handleHomeSend = useCallback(
    async (content) => {
      await onSend?.(content);
    },
    [onSend]
  );

  if (view === 'detail' && openWorkflow) {
    return (
      <WorkflowDetail
        workflow={openWorkflow}
        onWorkflowChange={setOpenWorkflow}
        onBack={handleBack}
        onSaved={handleSaved}
        currentExecution={
          liveWorkflow && openWorkflow.id === liveWorkflow.id
            ? currentExecution
            : openWorkflow.source === 'live'
              ? currentExecution
              : null
        }
        messages={messages}
        onRetry={onRetry}
        onPreviewArtifact={onPreviewArtifact}
        showExecutionDetails={showExecutionDetails}
        onSend={onSend}
        onStop={onStop}
        onApprove={onApprove}
        onReject={onReject}
        isConnected={isConnected}
        isProcessing={isProcessing}
        disabled={disabled}
        disabledMessage={disabledMessage}
      />
    );
  }

  return (
    <StudioHome
      workflows={catalog}
      onOpen={handleOpen}
      onCreate={handleCreate}
      onSend={handleHomeSend}
      onStop={onStop}
      isConnected={isConnected}
      isProcessing={isProcessing}
      disabled={disabled}
      disabledMessage={disabledMessage}
    />
  );
}
