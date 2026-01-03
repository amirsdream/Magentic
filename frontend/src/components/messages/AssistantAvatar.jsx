/**
 * AssistantAvatar - Reusable AI avatar component
 */
import React from 'react';
import { Sparkles } from 'lucide-react';

export default function AssistantAvatar({ isAnimated = false }) {
  return (
    <div className="relative flex-shrink-0">
      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
        <Sparkles className={`w-4 h-4 text-white ${isAnimated ? 'animate-pulse' : ''}`} />
      </div>
      {isAnimated && (
        <div className="absolute inset-0 bg-purple-500/30 rounded-full blur-lg animate-pulse" />
      )}
    </div>
  );
}
