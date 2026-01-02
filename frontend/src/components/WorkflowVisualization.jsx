/**
 * WorkflowVisualization - Re-export from dag module
 * 
 * This file maintains backward compatibility.
 * The component has been refactored into smaller, maintainable pieces in ./dag/
 * 
 * Components:
 * - WorkflowPanel - Main workflow visualization panel
 * - CollapsedView - Minimized panel view
 * - WorkflowHeader - Header with controls
 * - HistoryView - Execution history list
 * - EmptyState - Empty state display
 * - StatusLegend - Status indicators legend
 * - ListView - List-based workflow view
 * - DAGView - DAG visualization
 */

export { WorkflowPanel as default } from './dag/WorkflowPanel';
export { WorkflowPanel } from './dag/WorkflowPanel';

// Re-export all dag components for convenience
export * from './dag';
