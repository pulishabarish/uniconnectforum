import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Mail, Trash2 } from 'lucide-react';
import { Reply } from '../types.tsx';
import { UpvoteButton } from './UpvoteButton.tsx';
import { formatTimeAgo, getRoleBadgeColor } from '../utils/helpers.ts';

interface ReplyCardProps {
  reply: Reply;
  depth?: number;
  onReply: (parentReplyId: string) => void;
  allReplies: Reply[];
  topicAuthorId?: string;
  isTopicInactive?: boolean;
}

export const ReplyCard: React.FC<ReplyCardProps> = ({
  reply,
  depth = 0,
  onReply,
  allReplies,
  topicAuthorId,
  isTopicInactive = false
}) => {
  const { currentUser, upvoteReply, users, startConversation, deleteReply } = useApp();
  const navigate = useNavigate();
  const [showReplies, setShowReplies] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isUpvoted = currentUser ? reply.upvotedBy.includes(currentUser.id) : false;
  const childReplies = allReplies.filter(r => r.parentReplyId === reply.id);
  const maxDepth = 5;
  const replyAuthor = users.find(u => u.id === reply.authorId);
  
  // Check if current user can delete this reply
  const canDelete = currentUser && (
    currentUser.role === 'admin' || // Admins can delete any reply
    currentUser.id === reply.authorId || // Reply author can delete their own reply
    currentUser.id === topicAuthorId // Topic creator can delete replies on their topic
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleMessageUser = () => {
    if (!currentUser || !replyAuthor) return;
    startConversation(replyAuthor.id);
    navigate('/messages');
    setShowUserMenu(false);
  };

  const handleDeleteReply = () => {
    if (!currentUser) return;
    
    const childCount = childReplies.length;
    const confirmMessage = childCount > 0 
      ? `Are you sure you want to delete this reply and its ${childCount} ${childCount === 1 ? 'reply' : 'replies'}? This action cannot be undone.`
      : 'Are you sure you want to delete this reply? This action cannot be undone.';
    
    if (window.confirm(confirmMessage)) {
      deleteReply(reply.id, reply.topicId);
    }
  };

  return (
    <div className={`${depth > 0 ? 'ml-8 mt-3' : 'mt-4'}`}>
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <UpvoteButton
            count={reply.upvotes}
            isUpvoted={isUpvoted}
            onUpvote={() => upvoteReply(reply.id)}
            size="sm"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`px-2 py-0.5 rounded border text-xs font-medium ${getRoleBadgeColor(reply.authorRole)} hover:opacity-80 transition-opacity cursor-pointer`}
              >
                {reply.authorName}
              </button>
              
              {showUserMenu && replyAuthor && currentUser && currentUser.id !== reply.authorId && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-48">
                  <div className="p-2">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="font-medium text-sm text-gray-900">{replyAuthor.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{replyAuthor.role}</p>
                    </div>
                    <button
                      onClick={handleMessageUser}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors mt-1"
                    >
                      <Send size={14} />
                      <span>Send Message</span>
                    </button>
                    <div className="px-3 py-2 border-t border-gray-100 mt-1">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Mail size={12} />
                        <span className="truncate">{replyAuthor.email}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <span className="text-xs text-gray-500">{formatTimeAgo(reply.createdAt)}</span>
          </div>

          <p className="text-gray-800 text-sm mb-2">{reply.content}</p>

          <div className="flex items-center gap-3">
            {!isTopicInactive && (
              <button
                onClick={() => onReply(reply.id)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 transition-colors"
              >
                <MessageSquare size={14} />
                <span>Reply</span>
              </button>
            )}
            
            {canDelete && (
              <button
                onClick={handleDeleteReply}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 transition-colors"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            )}
          </div>

          {childReplies.length > 0 && depth < maxDepth && (
            <div className={`${showReplies ? '' : 'hidden'}`}>
              {childReplies.map(childReply => (
                <ReplyCard
                  key={childReply.id}
                  reply={childReply}
                  depth={depth + 1}
                  onReply={onReply}
                  allReplies={allReplies}
                  topicAuthorId={topicAuthorId}
                  isTopicInactive={isTopicInactive}
                />
              ))}
            </div>
          )}

          {childReplies.length > 0 && depth < maxDepth && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="text-xs text-blue-600 hover:text-blue-700 mt-2"
            >
              {showReplies ? 'Hide' : 'Show'} {childReplies.length} {childReplies.length === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};