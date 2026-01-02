/**
 * DAG Constants and Configuration
 */
import {
  Clock,
  Loader2,
  CheckCircle,
  AlertCircle,
  Square,
  Bot,
  Layers,
} from 'lucide-react';

export const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'gray', label: 'Pending', animate: false },
  running: { icon: Loader2, color: 'blue', label: 'Running', animate: true },
  completed: { icon: CheckCircle, color: 'green', label: 'Completed', animate: false },
  complete: { icon: CheckCircle, color: 'green', label: 'Completed', animate: false },
  error: { icon: AlertCircle, color: 'red', label: 'Failed', animate: false },
  stopped: { icon: Square, color: 'orange', label: 'Stopped', animate: false },
};

export const COLOR_MAP = {
  blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-400', ring: 'ring-blue-500/50' },
  green: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-400', ring: 'ring-green-500/50' },
  emerald: { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/50' },
  purple: { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-400', ring: 'ring-purple-500/50' },
  yellow: { bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-400', ring: 'ring-yellow-500/50' },
  orange: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-400', ring: 'ring-orange-500/50' },
  red: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-400', ring: 'ring-red-500/50' },
  cyan: { bg: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-400', ring: 'ring-cyan-500/50' },
  pink: { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-400', ring: 'ring-pink-500/50' },
  gray: { bg: 'bg-gray-500', border: 'border-gray-500', text: 'text-gray-400', ring: 'ring-gray-500/50' },
  amber: { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-400', ring: 'ring-amber-500/50' },
  indigo: { bg: 'bg-indigo-500', border: 'border-indigo-500', text: 'text-indigo-400', ring: 'ring-indigo-500/50' },
};

// Default role configuration
export const DEFAULT_ROLE_CONFIG = {
  coordinator: { icon: Layers, label: 'Coordinator' },
  default: { icon: Bot, label: 'Agent' },
};

export function getColorClasses(color, type = 'bg') {
  return COLOR_MAP[color]?.[type] || COLOR_MAP.gray[type];
}

// Format duration helper
export function formatDuration(ms) {
  if (!ms || ms < 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Format time ago (relative time)
export function formatTimeAgo(timestamp) {
  if (!timestamp) return null;
  const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (isNaN(time)) return null;
  
  const now = Date.now();
  const diff = now - time;
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return new Date(time).toLocaleDateString();
}
