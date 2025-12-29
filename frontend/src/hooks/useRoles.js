/**
 * Hook to fetch role configurations from backend
 * Falls back to default icons if backend is unavailable
 */
import { useState, useEffect } from 'react';
import {
  Search,
  Code,
  FileText,
  Brain,
  Zap,
  AlertCircle,
  Layers,
  Terminal,
  Wrench,
  CheckCircle2,
  Target,
  Database,
  GitBranch,
  MessageSquare,
  Sparkles,
  Bot,
  Activity,
} from 'lucide-react';

// Map icon names from YAML to Lucide React components
const ICON_MAP = {
  search: Search,
  code: Code,
  'file-text': FileText,
  brain: Brain,
  zap: Zap,
  'alert-circle': AlertCircle,
  layers: Layers,
  terminal: Terminal,
  wrench: Wrench,
  'check-circle': CheckCircle2,
  target: Target,
  database: Database,
  'git-branch': GitBranch,
  'message-square': MessageSquare,
  sparkles: Sparkles,
  bot: Bot,
  activity: Activity,
};

// Default fallback config when backend is unavailable
const DEFAULT_ROLE_CONFIG = {
  default: { icon: Bot, label: 'Agent' },
};

/**
 * Hook to fetch and manage role configurations
 * @param {string} apiUrl - Base API URL
 * @returns {Object} - { roles, loading, error, refetch }
 */
export function useRoles(apiUrl = 'http://localhost:8000') {
  const [roles, setRoles] = useState(DEFAULT_ROLE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiUrl}/roles`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch roles: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.roles) {
        // Convert backend roles to frontend format with icon components
        const convertedRoles = {};
        
        for (const [name, role] of Object.entries(data.roles)) {
          convertedRoles[name] = {
            icon: ICON_MAP[role.icon] || Bot,
            label: role.label || name,
            description: role.description,
            capabilities: role.capabilities,
            needsTools: role.needs_tools,
            canDelegate: role.can_delegate,
          };
        }

        // Always include default fallback
        convertedRoles.default = DEFAULT_ROLE_CONFIG.default;
        
        setRoles(convertedRoles);
      } else {
        throw new Error(data.error || 'Invalid response format');
      }
    } catch (err) {
      console.warn('Failed to fetch roles from backend, using defaults:', err.message);
      setError(err.message);
      // Keep default config on error
      setRoles(DEFAULT_ROLE_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [apiUrl]);

  /**
   * Get role config with fallback
   * @param {string} roleName - Role name to lookup
   * @returns {Object} - Role config with icon and label
   */
  const getRole = (roleName) => {
    const normalizedName = roleName?.toLowerCase().replace(/\s+/g, '_');
    return roles[normalizedName] || roles.default;
  };

  return {
    roles,
    loading,
    error,
    refetch: fetchRoles,
    getRole,
  };
}

// Static helper for places that can't use hooks
// Returns just the icon component based on icon name from backend
export function getIconComponent(iconName) {
  return ICON_MAP[iconName] || Bot;
}

export default useRoles;
