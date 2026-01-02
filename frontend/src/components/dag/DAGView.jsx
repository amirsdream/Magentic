/**
 * DAGView - Pipeline visualization with proper node-to-node connections
 * Inspired by GitLab CI / GitHub Actions with SVG wire connections
 */
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import JobCard from './JobCard';
import AgentDetailPanel from './AgentDetailPanel';

// Layout constants
const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;  // Increased to accommodate task + tokens rows
const NODE_GAP_Y = 24;    // More breathing room between parallel nodes
const LAYER_GAP_X = 100;
const BARRIER_SIZE = 20;
const PADDING = 24;

function DAGView({ agents, selectedAgent: externalSelectedAgent, onSelectAgent, getRole }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  
  // Selection state
  const [internalSelectedAgent, setInternalSelectedAgent] = useState(null);
  const selectedAgent = externalSelectedAgent !== undefined ? externalSelectedAgent : internalSelectedAgent;
  const handleSelectAgent = onSelectAgent || setInternalSelectedAgent;

  // Group agents by layer
  const layerData = useMemo(() => {
    if (!agents || agents.length === 0) return [];
    
    const layerMap = new Map();
    agents.forEach(agent => {
      const layer = agent.layer ?? 0;
      if (!layerMap.has(layer)) {
        layerMap.set(layer, []);
      }
      layerMap.get(layer).push(agent);
    });
    
    return Array.from(layerMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([layer, layerAgents]) => ({ layer, agents: layerAgents }));
  }, [agents]);

  // Calculate node positions
  const { nodes, barriers, connections, totalWidth, totalHeight } = useMemo(() => {
    if (layerData.length === 0) return { nodes: [], barriers: [], connections: [], totalWidth: 0, totalHeight: 0 };

    const nodePositions = [];
    const barrierPositions = [];
    const connectionLines = [];
    
    let maxHeight = 0;
    
    // Calculate positions for each layer
    layerData.forEach(({ layer, agents: layerAgents }, layerIdx) => {
      const layerHeight = layerAgents.length * NODE_HEIGHT + (layerAgents.length - 1) * NODE_GAP_Y;
      maxHeight = Math.max(maxHeight, layerHeight);
    });

    // Position nodes
    layerData.forEach(({ layer, agents: layerAgents }, layerIdx) => {
      const x = PADDING + layerIdx * (NODE_WIDTH + LAYER_GAP_X);
      const layerHeight = layerAgents.length * NODE_HEIGHT + (layerAgents.length - 1) * NODE_GAP_Y;
      const startY = PADDING + (maxHeight - layerHeight) / 2;

      layerAgents.forEach((agent, agentIdx) => {
        const y = startY + agentIdx * (NODE_HEIGHT + NODE_GAP_Y);
        nodePositions.push({
          agent,
          x,
          y,
          centerX: x + NODE_WIDTH / 2,
          centerY: y + NODE_HEIGHT / 2,
          rightX: x + NODE_WIDTH,
          rightY: y + NODE_HEIGHT / 2,
          leftX: x,
          leftY: y + NODE_HEIGHT / 2,
          layerIdx,
        });
      });

      // Add barrier between layers (except after last layer)
      if (layerIdx < layerData.length - 1) {
        const barrierX = x + NODE_WIDTH + (LAYER_GAP_X - BARRIER_SIZE) / 2;
        const barrierY = PADDING + maxHeight / 2 - BARRIER_SIZE / 2;
        
        // Check layer statuses
        const allComplete = layerAgents.every(a => a.status === 'completed' || a.status === 'complete');
        const hasRunning = layerAgents.some(a => a.status === 'running');
        
        barrierPositions.push({
          x: barrierX,
          y: barrierY,
          centerX: barrierX + BARRIER_SIZE / 2,
          centerY: barrierY + BARRIER_SIZE / 2,
          status: allComplete ? 'completed' : hasRunning ? 'running' : 'pending',
          fromLayerIdx: layerIdx,
        });
      }
    });

    // Create connections: nodes -> barrier -> nodes
    barrierPositions.forEach((barrier, barrierIdx) => {
      const fromLayerIdx = barrier.fromLayerIdx;
      const toLayerIdx = fromLayerIdx + 1;
      
      // Get nodes from source layer
      const fromNodes = nodePositions.filter(n => n.layerIdx === fromLayerIdx);
      // Get nodes from target layer
      const toNodes = nodePositions.filter(n => n.layerIdx === toLayerIdx);
      
      // Connect each source node to barrier
      fromNodes.forEach(fromNode => {
        connectionLines.push({
          from: { x: fromNode.rightX, y: fromNode.rightY },
          to: { x: barrier.centerX - BARRIER_SIZE / 2, y: barrier.centerY },
          status: fromNode.agent.status,
          type: 'node-to-barrier',
        });
      });
      
      // Connect barrier to each target node
      toNodes.forEach(toNode => {
        const fromStatus = fromNodes.every(n => n.agent.status === 'completed' || n.agent.status === 'complete')
          ? 'completed' : fromNodes.some(n => n.agent.status === 'running') ? 'running' : 'pending';
        connectionLines.push({
          from: { x: barrier.centerX + BARRIER_SIZE / 2, y: barrier.centerY },
          to: { x: toNode.leftX, y: toNode.leftY },
          status: fromStatus,
          type: 'barrier-to-node',
        });
      });
    });

    // If only one layer, no barriers needed - but still might have single node
    if (layerData.length === 1) {
      // No connections needed for single layer
    }

    const totalWidth = PADDING * 2 + layerData.length * NODE_WIDTH + (layerData.length - 1) * LAYER_GAP_X;
    const totalHeight = PADDING * 2 + maxHeight;

    return { 
      nodes: nodePositions, 
      barriers: barrierPositions, 
      connections: connectionLines,
      totalWidth,
      totalHeight: Math.max(totalHeight, 200),
    };
  }, [layerData]);

  // Update dimensions
  useEffect(() => {
    setDimensions({ width: totalWidth, height: totalHeight });
  }, [totalWidth, totalHeight]);

  if (!agents || agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 dark:text-gray-500 text-sm">
        No agents in execution
      </div>
    );
  }

  // Get connection color
  const getConnectionColor = (status) => {
    if (status === 'completed' || status === 'complete') return '#10b981'; // emerald
    if (status === 'running') return '#3b82f6'; // blue
    return '#9ca3af'; // gray
  };

  // Generate curved path between two points
  const getCurvedPath = (from, to) => {
    const midX = (from.x + to.x) / 2;
    return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
  };

  return (
    <div className="flex flex-col min-h-[200px]">
      {/* Pipeline container with scroll */}
      <div className="overflow-x-auto pb-4">
        <div 
          ref={containerRef}
          className="relative"
          style={{ width: dimensions.width, height: dimensions.height, minWidth: '100%' }}
        >
          {/* SVG Layer for connections */}
          <svg 
            className="absolute inset-0 pointer-events-none"
            width={dimensions.width}
            height={dimensions.height}
          >
            <defs>
              {/* Gradient definitions for flowing effect */}
              <linearGradient id="grad-completed" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="grad-running" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
              </linearGradient>
              <linearGradient id="grad-pending" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#9ca3af" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#9ca3af" stopOpacity="0.7" />
              </linearGradient>
              {/* Soft glow filters */}
              <filter id="glow-running" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Connection lines */}
            {connections.map((conn, idx) => {
              const status = conn.status === 'completed' || conn.status === 'complete' ? 'completed' 
                : conn.status === 'running' ? 'running' : 'pending';
              const isRunning = conn.status === 'running';
              
              return (
                <g key={idx}>
                  {/* Background track - subtle */}
                  <path
                    d={getCurvedPath(conn.from, conn.to)}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="2"
                    className="dark:stroke-gray-700/50"
                  />
                  {/* Gradient line - smooth connection without arrows */}
                  <motion.path
                    d={getCurvedPath(conn.from, conn.to)}
                    fill="none"
                    stroke={`url(#grad-${status})`}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    filter={isRunning ? 'url(#glow-running)' : undefined}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: idx * 0.03, ease: 'easeOut' }}
                  />
                  {/* Running pulse dot */}
                  {isRunning && (
                    <motion.circle
                      r="3"
                      fill="#3b82f6"
                      filter="drop-shadow(0 0 3px rgba(59, 130, 246, 0.5))"
                      initial={{ offsetDistance: '0%' }}
                      animate={{ offsetDistance: '100%' }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                      style={{ offsetPath: `path("${getCurvedPath(conn.from, conn.to)}")` }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Barrier nodes */}
          {barriers.map((barrier, idx) => (
            <motion.div
              key={`barrier-${idx}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className={clsx(
                'absolute flex items-center justify-center',
                'rotate-45 rounded-sm border-2 shadow-lg',
                barrier.status === 'completed' && 'border-emerald-500 bg-emerald-100 dark:bg-emerald-900/50',
                barrier.status === 'running' && 'border-blue-500 bg-blue-100 dark:bg-blue-900/50',
                barrier.status === 'pending' && 'border-slate-400 bg-slate-100 dark:border-gray-500 dark:bg-gray-700',
              )}
              style={{
                left: barrier.x,
                top: barrier.y,
                width: BARRIER_SIZE,
                height: BARRIER_SIZE,
              }}
            >
              <div className={clsx(
                '-rotate-45 w-2 h-2 rounded-full',
                barrier.status === 'completed' && 'bg-emerald-500',
                barrier.status === 'running' && 'bg-blue-500 animate-pulse',
                barrier.status === 'pending' && 'bg-slate-400 dark:bg-gray-500',
              )} />
            </motion.div>
          ))}

          {/* Job cards */}
          {nodes.map((node, idx) => (
            <div
              key={node.agent.agent_id || idx}
              className="absolute"
              style={{
                left: node.x,
                top: node.y,
                width: NODE_WIDTH,
              }}
            >
              <JobCard
                agent={node.agent}
                isSelected={selectedAgent?.agent_id === node.agent.agent_id}
                onClick={() => handleSelectAgent(node.agent)}
                roleConfig={getRole?.(node.agent.role)}
                index={idx}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Detail panel */}
      {selectedAgent && (
        <AgentDetailPanel 
          agent={selectedAgent} 
          onClose={() => handleSelectAgent(null)}
          getRole={getRole}
        />
      )}
    </div>
  );
}

export default DAGView;
