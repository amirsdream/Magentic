/**
 * WorkflowCanvas — ReactFlow visual graph of workflow steps.
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import WorkflowStepNode from './WorkflowStepNode';
import { graphFromWorkflow } from '../../utils/workflowModel';

const nodeTypes = { workflowStep: WorkflowStepNode };

function WorkflowCanvasInner({
  workflow,
  selectedStepId,
  onSelectStep,
  editMode = false,
}) {
  const { nodes: builtNodes, edges: builtEdges } = useMemo(
    () => graphFromWorkflow(workflow),
    [workflow]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(builtNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(builtEdges);

  useEffect(() => {
    setNodes(
      builtNodes.map((n) => ({
        ...n,
        selected: n.id === selectedStepId,
      }))
    );
    setEdges(builtEdges);
  }, [builtNodes, builtEdges, selectedStepId, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_event, node) => {
      onSelectStep?.(node.id);
    },
    [onSelectStep]
  );

  const onPaneClick = useCallback(() => {
    onSelectStep?.(null);
  }, [onSelectStep]);

  if (!workflow?.steps?.length) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <p className="font-display text-2xl text-slate-800 dark:text-slate-100 mb-2">
            Workflow
          </p>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
            Load a workflow or wait for Ropex to plan steps. In edit mode you can
            add agents and shape the flow.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full studio-flow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={editMode ? onNodesChange : undefined}
        onEdgesChange={editMode ? onEdgesChange : undefined}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.28, maxZoom: 1.1 }}
        minZoom={0.35}
        maxZoom={1.6}
        nodesDraggable={editMode}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#94a3b8" gap={18} size={1} className="!bg-transparent" />
        <Controls
          showInteractive={false}
          className="!shadow-none !border-slate-200 dark:!border-slate-700 !rounded-lg !overflow-hidden !bg-white/90 dark:!bg-slate-900/90"
        />
        <MiniMap
          className="!bg-white/80 dark:!bg-slate-900/80 !border-slate-200 dark:!border-slate-700 !rounded-lg"
          nodeColor={(node) => {
            const s = node.data?.status;
            if (s === 'complete') return '#14b8a6';
            if (s === 'running') return '#0ea5e9';
            if (s === 'error') return '#f43f5e';
            return '#94a3b8';
          }}
          maskColor="rgba(15,23,42,0.08)"
        />
      </ReactFlow>
    </div>
  );
}

export default function WorkflowCanvas(props) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
