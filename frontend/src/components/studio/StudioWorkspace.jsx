/**
 * StudioWorkspace — workflow-first navigation:
 * 1) list of workflows
 * 2) open one → chat + visual flow + actions inside
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WorkflowList from './WorkflowList';
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
      name: liveWorkflow.name || 'Live run',
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
  const [view, setView] = useState('list'); // 'list' | 'detail'
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

  // When a new live pipeline appears, open it automatically
  useEffect(() => {
    if (!liveWorkflow) return;
    if (liveWorkflow.id === liveIdRef.current) {
      // Keep open workflow synced with live status if we're inside it
      if (view === 'detail' && openWorkflow?.id === liveWorkflow.id) {
        setOpenWorkflow(mergeLiveIntoWorkflow(liveWorkflow, currentExecution));
      }
      return;
    }
    liveIdRef.current = liveWorkflow.id;
    setOpenWorkflow(mergeLiveIntoWorkflow(liveWorkflow, currentExecution));
    setView('detail');
  }, [liveWorkflow, currentExecution, view, openWorkflow?.id]);

  // Demo modes: land inside the demo workflow
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
    const wf = emptyWorkflow('Untitled workflow');
    const next = saveWorkflowToLibrary(wf);
    setSaved(next);
    setOpenWorkflow(wf);
    setView('detail');
  }, []);

  const handleBack = useCallback(() => {
    setView('list');
    // Refresh library in case detail saved
    setSaved(loadWorkflowLibrary());
  }, []);

  const handleSaved = useCallback((library, draft) => {
    setSaved(library);
    if (draft) setOpenWorkflow(draft);
  }, []);

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
    <WorkflowList
      workflows={catalog}
      onOpen={handleOpen}
      onCreate={handleCreate}
    />
  );
}
