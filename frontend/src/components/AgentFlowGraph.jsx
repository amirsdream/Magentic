/**
 * Agent Flow Visualization - Real-time agent execution graph
 */
import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
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
  default: Brain,
};

// Role to color mapping
const ROLE_COLORS = {
  researcher: { bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-blue-400' },
  coder: { bg: 'bg-green-500', border: 'border-green-400', text: 'text-green-400' },
  writer: { bg: 'bg-purple-500', border: 'border-purple-400', text: 'text-purple-400' },
  analyzer: { bg: 'bg-yellow-500', border: 'border-yellow-400', text: 'text-yellow-400' },
  planner: { bg: 'bg-orange-500', border: 'border-orange-400', text: 'text-orange-400' },
  critic: { bg: 'bg-red-500', border: 'border-red-400', text: 'text-red-400' },
  synthesizer: { bg: 'bg-cyan-500', border: 'border-cyan-400', text: 'text-cyan-400' },
  coordinator: { bg: 'bg-pink-500', border: 'border-pink-400', text: 'text-pink-400' },
  default: { bg: 'bg-gray-500', border: 'border-gray-400', text: 'text-gray-400' },
};

// Custom Agent Node
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
      style={{
        background: 'rgba(17, 24, 39, 0.9)',
      }}
    >
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

const nodeTypes = {
  agent: AgentNode,
};

function AgentFlowGraph({ execution, onClose }) {
  // Convert execution data to ReactFlow nodes and edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!execution?.plan?.agents) {
      return { nodes: [], edges: [] };
    }

    const nodes = [];
    const edges = [];
    const layerWidth = 280;
    const nodeHeight = 120;
    
    // Group agents by layer
    const layers = {};
    execution.plan.agents.forEach((agent) => {
      const layer = agent.layer || 0;
      if (!layers[layer]) layers[layer] = [];
      layers[layer].push(agent);
    });

    // Create nodes
    Object.entries(layers).forEach(([layer, agents]) => {
      const layerNum = parseInt(layer);
      agents.forEach((agent, idx) => {
        const agentStatus = execution.agents?.find((a) => a.agent_id === agent.agent_id);
        
        nodes.push({
          id: agent.agent_id,
          type: 'agent',
          position: {
            x: layerNum * layerWidth,
            y: idx * nodeHeight + (layerNum % 2 === 0 ? 0 : nodeHeight / 2),
          },
          data: {
            label: agent.agent_id,
            role: agent.role,
            task: agent.task,
            status: agentStatus?.status || 'pending',
          },
        });

        // Create edges from dependencies
        if (agent.dependencies) {
          agent.dependencies.forEach((dep) => {
            edges.push({
              id: `${dep}-${agent.agent_id}`,
              source: dep,
              target: agent.agent_id,
              type: 'smoothstep',
              animated: agentStatus?.status === 'running',
              style: { stroke: '#a855f7', strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#a855f7',
              },
            });
          });
        }
      });
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
      </div>
    </motion.div>
  );
}

export default AgentFlowGraph;
