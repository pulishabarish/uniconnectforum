import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Bookmark, BookmarkCheck, ArrowRight } from 'lucide-react';
import { Topic } from '../types';
import { UpvoteButton } from './UpvoteButton.tsx';
import { CategoryTag } from './CategoryTag.tsx';
import { formatTimeAgo, getRoleBadgeColor } from '../utils/helpers.ts';
import { useApp } from '../context/AppContext.tsx';

interface TopicCardProps {
  topic: Topic;
  onUpvote?: (topicId: string) => void;
}

export const TopicCard: React.FC<TopicCardProps> = ({ topic, onUpvote }) => {
  const navigate = useNavigate();
  const { currentUser, followTopic, unfollowTopic } = useApp();

  const isUpvoted = currentUser ? topic.upvotedBy.includes(currentUser.id) : false;
  const isFollowing = currentUser ? (currentUser.followedTopics || []).includes(topic.id) : false;
  const isInactive = topic.isActive === false;

  const handleFollowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;

    if (isFollowing) {
      unfollowTopic(topic.id);
    } else {
      followTopic(topic.id);
    }
  };

  return (
    <article
      onClick={() => navigate(`/topic/${topic.id}`)}
      className={`university-panel group cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-38px_rgba(15,23,42,0.4)] ${
        isInactive ? 'border-slate-200' : 'hover:border-blue-200'
      }`}
    >
      {topic.imageUrl && (
        <div className="relative h-52 overflow-hidden bg-slate-100">
          <img
            src={topic.imageUrl}
            alt={topic.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" />
        </div>
      )}

      <div className="p-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <UpvoteButton
              count={topic.upvotes}
              isUpvoted={isUpvoted}
              onUpvote={() => onUpvote?.(topic.id)}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryTag category={topic.category} size="sm" />
                {isInactive && (
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Archived
                  </span>
                )}
              </div>

              {currentUser && (
                <button
                  onClick={handleFollowClick}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    isFollowing
                      ? 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {isFollowing ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                  <span>{isFollowing ? 'Following' : 'Follow'}</span>
                </button>
              )}
            </div>

            <h3 className="text-2xl font-semibold leading-tight text-slate-900 transition-colors group-hover:text-blue-800">
              {topic.title}
            </h3>

            <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">
              {topic.content}
            </p>

            {isInactive && (
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                This topic remains visible for reference. New replies are currently disabled.
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span>Posted by</span>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getRoleBadgeColor(topic.authorRole)}`}>
                  {topic.authorName}
                </span>
              </div>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <span>{formatTimeAgo(topic.createdAt)}</span>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <div className="flex items-center gap-1.5">
                <MessageSquare size={14} />
                <span>{topic.replyCount} {topic.replyCount === 1 ? 'reply' : 'replies'}</span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Academic community discussion
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 transition-colors group-hover:text-blue-900">
                View discussion
                <ArrowRight size={16} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
