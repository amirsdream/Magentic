/**
 * Application constants
 */

export const API_CONFIG = {
  WS_URL: 'ws://localhost:8000/ws',
  HTTP_URL: 'http://localhost:8000',
};

export const WEBSOCKET_EVENTS = {
  STATUS: 'status',
  STAGE: 'stage',
  THINKING: 'thinking',  // Stream of thinking content from reasoning models
  PLAN: 'plan',
  AGENT_START: 'agent_start',
  AGENT_LOG: 'agent_log',
  AGENT_COMPLETE: 'agent_complete',
  COMPLETE: 'complete',
  STOPPED: 'stopped',
  ERROR: 'error',
};

export const AGENT_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETE: 'complete',
  STOPPED: 'stopped',
  ERROR: 'error',
};

export const RECONNECT_DELAY = 3000; // 3 seconds
