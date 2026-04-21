import React from 'react';
import { ArrowUp } from 'lucide-react';

interface UpvoteButtonProps {
  count: number;
  isUpvoted: boolean;
  onUpvote: () => void;
  size?: 'sm' | 'md';
}

export const UpvoteButton: React.FC<UpvoteButtonProps> = ({
  count,
  isUpvoted,
  onUpvote,
  size = 'md'
}) => {
  const sizeClasses = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 14 : 16;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onUpvote();
      }}
      className={`flex flex-col items-center gap-1 rounded-2xl border px-3 py-3 transition-all ${
        isUpvoted
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white'
      }`}
    >
      <ArrowUp
        size={iconSize}
        className={`${isUpvoted ? 'fill-blue-700' : ''}`}
      />
      <span className={`font-medium ${sizeClasses}`}>{count}</span>
    </button>
  );
};
