/**
 * ChatInput component - message input area
 */

import React from 'react';
import { Send } from 'lucide-react';

function ChatInput({ value, onChange, onSend, disabled }) {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="bg-gray-900/80 backdrop-blur-lg border-t border-purple-500/20 px-6 py-4">
      <div className="flex gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me anything..."
          className="flex-1 bg-gray-800/50 border border-purple-500/30 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          disabled={disabled}
        />
        <button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-lg px-6 py-3 font-medium flex items-center gap-2 transition-all disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatInput;
