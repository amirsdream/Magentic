/**
 * WorkflowOrchestrator — loadable workflows, visual canvas, edit mode.
 * Replaces raw YAML with an orchestrator-style editor.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Workflow,
  Pencil,
  Eye,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  Layers,
} from 'lucide-react';
import WorkflowCanvas from './WorkflowCanvas';
import {
  workflowFromExecution,
  mergeLiveIntoWorkflow,
  emptyWorkflow,
  loadWorkflowLibrary,
  saveWorkflowToLibrary,
  removeWorkflowFromLibrary,
  createStep,
} from '../../utils/workflowModel';

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

function libraryEntries({ liveWorkflow, historyWorkflows, saved }) {
  const items = [];
  if (liveWorkflow) {
    items.push({ ...liveWorkflow, _bucket: 'live', name: liveWorkflow.name || 'Live run' });
  }
  historyWorkflows.forEach((w) => {
    if (!items.some((i) => i.id === w.id)) {
      items.push({ ...w, _bucket: 'history' });
    }
  });
  saved.forEach((w) => {
    if (!items.some((i) => i.id === w.id)) {
      items.push({ ...w, _bucket: 'saved' });
    }
  });
  return items;
}

export default function WorkflowOrchestrator({
  execution,
  executionHistory = [],
  selectedStepId,
  onSelectStep,
  onWorkflowChange,
  className = '',
}) {
  const [editMode, setEditMode] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saved, setSaved] = useState(() => loadWorkflowLibrary());
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(null);

  const liveWorkflow = useMemo(
    () => workflowFromExecution(execution, { source: 'live' }),
    [execution]
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
    () => libraryEntries({ liveWorkflow, historyWorkflows, saved }),
    [liveWorkflow, historyWorkflows, saved]
  );

  const liveIdRef = useRef(null);

  // Follow new live pipelines; allow loading other workflows without fighting live sync
  useEffect(() => {
    if (liveWorkflow && liveWorkflow.id !== liveIdRef.current) {
      liveIdRef.current = liveWorkflow.id;
      setActiveId(liveWorkflow.id);
      setDraft(mergeLiveIntoWorkflow(liveWorkflow, execution));
      setEditMode(false);
      return;
    }
    if (liveWorkflow && activeId === liveWorkflow.id && !editMode) {
      setDraft(mergeLiveIntoWorkflow(liveWorkflow, execution));
      return;
    }
    if (!liveWorkflow && !activeId && catalog.length) {
      setActiveId(catalog[0].id);
      setDraft(catalog[0]);
    }
  }, [liveWorkflow, execution, editMode, catalog, activeId]);

  const activeWorkflow = useMemo(() => {
    if (draft && draft.id === activeId) return draft;
    return catalog.find((w) => w.id === activeId) || draft || liveWorkflow || null;
  }, [draft, activeId, catalog, liveWorkflow]);

  useEffect(() => {
    onWorkflowChange?.(activeWorkflow);
  }, [activeWorkflow, onWorkflowChange]);

  const selectedStep = useMemo(() => {
    if (!activeWorkflow || !selectedStepId) return null;
    return activeWorkflow.steps.find((s) => s.id === selectedStepId) || null;
  }, [activeWorkflow, selectedStepId]);

  const loadWorkflow = useCallback(
    (id) => {
      const item = catalog.find((w) => w.id === id);
      if (!item) return;
      setActiveId(id);
      setDraft(
        item._bucket === 'live' ? mergeLiveIntoWorkflow(item, execution) : { ...item }
      );
      setEditMode(false);
      setLibraryOpen(false);
      onSelectStep?.(null);
    },
    [catalog, execution, onSelectStep]
  );

  const handleNew = useCallback(() => {
    const wf = emptyWorkflow('Draft workflow');
    setSaved(saveWorkflowToLibrary(wf));
    setActiveId(wf.id);
    setDraft(wf);
    setEditMode(true);
    setLibraryOpen(false);
    onSelectStep?.(wf.steps[0]?.id || null);
  }, [onSelectStep]);

  const handleSave = useCallback(() => {
    if (!draft) return;
    setSaved(saveWorkflowToLibrary(draft));
  }, [draft]);

  const handleDeleteSaved = useCallback(
    (id) => {
      const next = removeWorkflowFromLibrary(id);
      setSaved(next);
      if (activeId === id) {
        const fallback = liveWorkflow || next[0] || null;
        setActiveId(fallback?.id || null);
        setDraft(fallback);
      }
    },
    [activeId, liveWorkflow]
  );

  const updateStep = useCallback(
    (stepId, patch) => {
      setDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    []
  );

  const addStep = useCallback(() => {
    setDraft((prev) => {
      if (!prev) return prev;
      const step = createStep(prev.id, prev.steps.length);
      const next = {
        ...prev,
        steps: [...prev.steps, step],
        updatedAt: new Date().toISOString(),
      };
      onSelectStep?.(step.id);
      return next;
    });
    setEditMode(true);
  }, [onSelectStep]);

  const removeStep = useCallback(
    (stepId) => {
      setDraft((prev) => {
        if (!prev || prev.steps.length <= 1) return prev;
        const steps = prev.steps.filter((s) => s.id !== stepId);
        return { ...prev, steps, updatedAt: new Date().toISOString() };
      });
      if (selectedStepId === stepId) onSelectStep?.(null);
    },
    [selectedStepId, onSelectStep]
  );

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/70 dark:border-slate-800 px-3 py-2.5">
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setLibraryOpen((v) => !v)}
            className="flex w-full max-w-full items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-2.5 py-1.5 text-left hover:border-sky-400/50 transition-colors"
          >
            <Workflow className="h-3.5 w-3.5 flex-shrink-0 text-sky-600 dark:text-sky-400" />
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-800 dark:text-slate-100">
              {activeWorkflow?.name || 'No workflow'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          <AnimatePresence>
            {libraryOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl"
              >
                <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
                  <span className="text-[11px] font-medium text-slate-500">Load workflow</span>
                  <button
                    type="button"
                    onClick={handleNew}
                    className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    <Plus className="h-3 w-3" /> New
                  </button>
                </div>
                {catalog.length === 0 ? (
                  <p className="px-3 py-4 text-[12px] text-slate-500">
                    No workflows yet. Start a chat or create a draft.
                  </p>
                ) : (
                  <ul className="py-1">
                    {catalog.map((item) => (
                      <li key={`${item._bucket}-${item.id}`}>
                        <button
                          type="button"
                          onClick={() => loadWorkflow(item.id)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-slate-50 dark:hover:bg-slate-800 ${
                            item.id === activeId ? 'bg-sky-500/10 text-sky-800 dark:text-sky-200' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <Layers className="h-3 w-3 flex-shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate">{item.name}</span>
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">
                            {item._bucket}
                          </span>
                          {item._bucket === 'saved' && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSaved(item.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.stopPropagation();
                                  handleDeleteSaved(item.id);
                                }
                              }}
                              className="p-0.5 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium border transition-colors ${
            editMode
              ? 'border-amber-400/50 bg-amber-500/10 text-amber-800 dark:text-amber-200'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-sky-400/40'
          }`}
          title={editMode ? 'Switch to view mode' : 'Edit workflow steps'}
        >
          {editMode ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {editMode ? 'Editing' : 'View'}
        </button>

        {editMode && (
          <>
            <button
              type="button"
              onClick={addStep}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 hover:border-sky-400/40"
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

      {/* Canvas */}
      <div className="relative min-h-0 flex-1">
        <WorkflowCanvas
          workflow={activeWorkflow}
          selectedStepId={selectedStepId}
          onSelectStep={onSelectStep}
          editMode={editMode}
        />
      </div>

      {/* Step editor (edit mode + selection) */}
      <AnimatePresence>
        {editMode && selectedStep && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-200/70 dark:border-slate-800"
          >
            <div className="space-y-2 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Edit step
                </p>
                <button
                  type="button"
                  onClick={() => removeStep(selectedStep.id)}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 hover:underline"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] text-slate-500">
                  Role
                  <select
                    value={selectedStep.role}
                    onChange={(e) => updateStep(selectedStep.id, { role: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-[12px] text-slate-800 dark:text-slate-100"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    {!ROLE_OPTIONS.includes(selectedStep.role) && (
                      <option value={selectedStep.role}>{selectedStep.role}</option>
                    )}
                  </select>
                </label>
                <label className="block text-[11px] text-slate-500">
                  Layer
                  <input
                    type="number"
                    min={0}
                    value={selectedStep.layer ?? 0}
                    onChange={(e) =>
                      updateStep(selectedStep.id, { layer: Number(e.target.value) || 0 })
                    }
                    className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-[12px] text-slate-800 dark:text-slate-100"
                  />
                </label>
              </div>
              <label className="block text-[11px] text-slate-500">
                Task
                <textarea
                  value={selectedStep.task || ''}
                  onChange={(e) => updateStep(selectedStep.id, { task: e.target.value })}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-[12px] text-slate-800 dark:text-slate-100"
                />
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
