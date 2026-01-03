/**
 * UserAvatar - User avatar component
 */
import React from 'react';
import { User } from 'lucide-react';

export default function UserAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 dark:from-purple-500 dark:to-pink-500 flex items-center justify-center flex-shrink-0">
      <User className="w-4 h-4 text-white" />
    </div>
  );
}
