/**
 * Agent Flow Visualization - Real-time agent execution graph
 * Uses ReactFlow for graph rendering with barrier pattern for layer synchronization
 */
import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from 'reactflow';
import { motion } from 'framer-motion';
import {
  Search,
  Code,
  FileText,
  Brain,
  Zap,
  CheckCircle,
  Loader2,
  AlertCircle,
  X,
  Pause,
} from 'lucide-react';
import clsx from 'clsx';
import 'reactflow/dist/style.css';

// Role to icon mapping
const ROLE_ICONS = {
  researcher: Search,
  coder: Code,
  writer: FileText,
  analyzer: Brain,
  planner: Brain,
  critic: AlertCircle,
  synthesizer: Zap,
  coordinator: Zap,
  barrier: Pause,
  default: Brain,
};

// Role to color mapping (using Tailwind classes)
const ROLE_COLORS = {
  researcher: { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-400', hex: '#3b82f6' },
  coder: { bg: 'bg-green-500', border: 'border-green-400', text: 'text-green-400', hex: '#22c55e' },
  writer: { bg: 'bg-purple-500', border: 'border-purple-400', text: 'text-purple-400', hex: '#a855f7' },
  analyzer: { bg: 'bg-yellow-500', border: 'border-yellow-400', text: 'text-yellow-400', hex: '#eab308' },
  planner: { bg: 'bg-orange-500', border: 'border-orange-400', text: 'text-orange-400', hex: '#f97316' },
  critic: { bg: 'bg-red-500', border: 'border-red-400', text: 'text-red-400', hex: '#ef4444' },
  synthesizer: { bg: 'bg-cyan-500', border: 'border-cyan-400', text: 'text-cyan-400', hex: '#06b6d4' },
  coordinator: { bg: 'bg-pink-500', border: 'border-pink-400', text: 'text-pink-400', hex: '#ec4899' },
  barrier: { bg: 'bg-gray-600', border: 'border-gray-500', text: 'text-gray-400', hex: '#4b5563' },
  default: { bg: 'bg-gray-500', border: 'border-gray-400', text: 'text-gray-400', hex: '#6b7280' },
};

// Custom Agent Node - clean component using ReactFlow handles
function AgentNode({ data }) {
  const Icon = ROLE_ICONS[data.role] || ROLE_ICONS.default;
  const colors = ROLE_COLORS[data.role] || ROLE_COLORS.default;
  
  const statusIcon = useMemo(() => {
    switch (data.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  }, [data.status]);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, type: 'spring' }}
      className={clsx(
        'px-4 py-3 rounded-xl border-2 backdrop-blur-sm min-w-[160px]',
        colors.border,
        data.status === 'running' && 'ring-2 ring-blue-400/50 ring-offset-2 ring-offset-gray-900',
        data.status === 'completed' && 'opacity-80'
      )}
      style={{ background: 'rgba(17, 24, 39, 0.9)' }}
    >
      {/* ReactFlow handles for connections */}
      <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-2 !h-2" />
      
      <div className="flex items-center gap-3">
        <div className={clsx('p-2 rounded-lg', colors.bg, 'bg-opacity-20')}>
          <Icon className={clsx('w-5 h-5', colors.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white text-sm truncate">{data.label}</span>
            {statusIcon}
          </div>
          <span className={clsx('text-xs', colors.text)}>{data.role}</span>
        </div>
      </div>
      
      {data.task && (
        <p className="mt-2 text-xs text-gray-400 line-clamp-2">{data.task}</p>
      )}
      
      {data.status === 'running' && (
        <motion.div
          className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className={clsx('h-full rounded-full', colors.bg)}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}

// Barrier Node - diamond shape for layer synchronization
function BarrierNode({ data }) {
  const allComplete = data.completedAgents === data.totalAgents;
  
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className={clsx(
        'w-12 h-12 flex items-center justify-center rounded-lg rotate-45 border-2',
        allComplete ? 'border-green-500 bg-green-500/20' : 'border-gray-500 bg-gray-800'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-500 !w-2 !h-2 !-rotate-45" />
      <Handle type="source" position={Position.Right} className="!bg-gray-500 !w-2 !h-2 !-rotate-45" />
      
      <div className="-rotate-45">
        {allComplete ? (
          <CheckCircle className="w-5 h-5 text-green-400" />
        ) : (
          <Pause className="w-5 h-5 text-gray-400" />
        )}
      </div>
    </motion.div>
  );
}

const nodeTypes = {
  agent: AgentNode,
  barrier: BarrierNode,
};

function AgentFlowGraph({ execution, onClose }) {
  // Convert execution data to ReactFlow nodes and edges with barrier pattern
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!execution?.plan?.agents) {
      return { nodes: [], edges: [] };
    }

    const nodes = [];
    const edges = [];
    const layerWidth = 280;
    const nodeHeight = 100;
    const barrierWidth = 80;
    
    // Group agents by layer
    const layers = {};
    execution.plan.agents.forEach((agent) => {
      const layer = agent.layer || 0;
      if (!layers[layer]) layers[layer] = [];
      layers[layer].push(agent);
    });

    const layerNumbers = Object.keys(layers).map(Number).sort((a, b) => a - b);
    const totalLayers = layerNumbers.length;

    // Calculate position for each layer (accounting for barriers between layers)
    const getLayerX = (layerNum) => {
      // Each layer has agents + a barrier after it (except last layer)
      const layerIndex = layerNumbers.indexOf(layerNum);
      return layerIndex * (layerWidth + barrierWidth);
    };

    // Create agent nodes and barrier nodes
    layerNumbers.forEach((layerNum, layerIndex) => {
      const agents = layers[layerNum];
      const totalInLayer = agents.length;
      const layerX = getLayerX(layerNum);
      
      // Calculate vertical centering for this layer
      const layerHeight = totalInLayer * nodeHeight;
      const startY = -layerHeight / 2 + nodeHeight / 2;

      // Create agent nodes for this layer
      agents.forEach((agent, idx) => {
        const agentStatus = execution.agents?.find((a) => a.agent_id === agent.agent_id);
        
        nodes.push({
          id: agent.agent_id,
          type: 'agent',
          position: {
            x: layerX,
            y: startY + idx * nodeHeight,
          },
          data: {
            label: agent.agent_id,
            role: agent.role,
            task: agent.task,
            status: agentStatus?.status || 'pending',
            layer: layerNum,
          },
        });
      });

      // Add barrier node after this layer (except for the last layer)
      if (layerIndex < totalLayers - 1) {
        const barrierId = `barrier_${layerNum}`;
        const completedCount = agents.filter(agent => {
          const status = execution.agents?.find(a => a.agent_id === agent.agent_id);
          return status?.status === 'completed';
        }).length;

        nodes.push({
          id: barrierId,
          type: 'barrier',
          position: {
            x: layerX + layerWidth - 30,
            y: 0, // Center vertically
          },
          data: {
            layer: layerNum,
            completedAgents: completedCount,
            totalAgents: totalInLayer,
          },
        });

        // Edges: All agents in this layer → barrier
        agents.forEach((agent) => {
          const agentStatus = execution.agents?.find(a => a.agent_id === agent.agent_id);
          const isCompleted = agentStatus?.status === 'completed';
          const isRunning = agentStatus?.status === 'running';
          
          edges.push({
            id: `${agent.agent_id}-${barrierId}`,
            source: agent.agent_id,
            target: barrierId,
            type: 'smoothstep',
            animated: isRunning,
            style: { 
              stroke: isCompleted ? '#22c55e' : '#6b7280',
              strokeWidth: 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isCompleted ? '#22c55e' : '#6b7280',
            },
          });
        });

        // Edges: Barrier → all agents in next layer
        const nextLayerNum = layerNumbers[layerIndex + 1];
        const nextLayerAgents = layers[nextLayerNum] || [];
        const barrierComplete = completedCount === totalInLayer;

        nextLayerAgents.forEach((nextAgent) => {
          edges.push({
            id: `${barrierId}-${nextAgent.agent_id}`,
            source: barrierId,
            target: nextAgent.agent_id,
            type: 'smoothstep',
            animated: barrierComplete,
            style: { 
              stroke: barrierComplete ? '#a855f7' : '#374151',
              strokeWidth: 2,
              strokeDasharray: barrierComplete ? undefined : '5,5',
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: barrierComplete ? '#a855f7' : '#374151',
            },
          });
        });
      }
    });

    return { nodes, edges };
  }, [execution]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  if (!execution?.plan?.agents?.length) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-4 z-50 bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-purple-500/30 shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-purple-500/20">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-purple-400" />
          <div>
            <h2 className="font-semibold text-white">Agent Execution Flow</h2>
            <p className="text-xs text-gray-400">
              {execution.plan.total_agents} agents • {execution.plan.total_layers} layers
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Flow Graph */}
      <div className="w-full h-full pt-16">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultViewport={{ x: 50, y: 100, zoom: 0.8 }}
          minZoom={0.3}
          maxZoom={1.5}
        >
          <Background color="#374151" gap={20} />
          <Controls className="!bg-gray-800 !border-purple-500/30 !rounded-lg" />
          <MiniMap
            className="!bg-gray-800 !border-purple-500/30 !rounded-lg"
            nodeColor={(node) => {
              const colors = ROLE_COLORS[node.data?.role] || ROLE_COLORS.default;
              return colors.bg.replace('bg-', '#').replace('-500', '');
            }}
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 px-4 py-2 bg-gray-800/80 rounded-lg border border-gray-700">
        <span className="text-xs text-gray-400">Status:</span>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-xs text-gray-400">Pending</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs text-gray-400">Running</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-gray-400">Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs text-gray-400">Error</span>
        </div>
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-600">
          <div className="w-3 h-3 rotate-45 border border-gray-500 bg-gray-700" />
          <span className="text-xs text-gray-400">Barrier (sync)</span>
        </div>
      </div>
    </motion.div>
  );
}

export default AgentFlowGraph;
