import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUp,
  AlertCircle,
  Edit2,
  MessageSquare,
  Reply,
  Trash2
} from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { CategoryTag } from "../components/CategoryTag.tsx";
import { categoryNameToSlug, formatTimeAgo, getRoleBadgeColor } from "../utils/helpers.ts";
import type { Category, UserRole } from "../types";
import { toast } from "sonner";

type TopicApiResponse = {
  TOPIC_ID: string | number;
  TITLE: string;
  DESCRIPTION: string;
  STATUS?: string;
  CATEGORY_NAME?: string;
  COVER_IMAGE_PATH?: string | null;
  CREATED_BY?: string | number;
  FIRST_NAME?: string;
  LAST_NAME?: string;
  ROLE?: string;
  CREATED_AT?: string;
  REPLY_COUNT?: number | string;
  TOPIC_UPVOTES?: number | string;
};

type PostItem = {
  POST_ID: number;
  CREATED_BY: number;
  PARENT_POST_ID: number | null;
  IS_DELETED: number;
  UPVOTES: number;
  HAS_UPVOTED?: number;
  PENDING_REPORT_COUNT?: number;
  REPORT_REASON_SUMMARY?: string;
  REPORT_DETAILS_SUMMARY?: string;
  CONTENT: string;
  FIRST_NAME?: string;
  LAST_NAME?: string;
  ROLE?: string;
  CREATED_AT?: string;
  UPDATED_AT?: string | null;
};

const API_BASE = "https://uniconnectforum.onrender.com/api";

const normalizeRole = (role?: string): UserRole => {
  const lower = String(role || "student").toLowerCase();
  if (lower === "faculty" || lower === "admin") {
    return lower;
  }
  return "student";
};

const buildImageUrl = (path?: string | null) => {
  if (!path) return undefined;
  return String(path).startsWith("http") ? String(path) : `https://uniconnectforum.onrender.com${path}`;
};

const formatAbsoluteDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const toIdString = (value: string | number | null | undefined) => String(value ?? "");

export const TopicDetailPage: React.FC = () => {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useApp();

  const [topic, setTopic] = useState<TopicApiResponse | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isLoadingTopic, setIsLoadingTopic] = useState(true);
  const [topicLoadError, setTopicLoadError] = useState("");
  const [reply, setReply] = useState("");
  const [replyBox, setReplyBox] = useState<number | null>(null);
  const [inlineReply, setInlineReply] = useState("");
  const [editBox, setEditBox] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [reportTarget, setReportTarget] = useState<{ type: "topic" | "reply"; id: string; label: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [highlightedReplyId, setHighlightedReplyId] = useState<string | null>(null);
  const highlightedReplyTimeoutRef = useRef<number | null>(null);
  const lastFocusedReplyRef = useRef<string | null>(null);

  const focusedReplyId = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const replyId = searchParams.get("reply");
    return replyId ? String(replyId) : null;
  }, [location.search]);

  const loadTopic = useCallback((options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setIsLoadingTopic(true);
    }
    setTopicLoadError("");

    return fetch(`${API_BASE}/topics/`)
      .then(res => res.json())
      .then(data => {
        const selectedTopic = data.find(
          (item: TopicApiResponse) => String(item.TOPIC_ID) === String(topicId)
        );
        setTopic(selectedTopic || null);
        setIsLoadingTopic(false);
      })
      .catch(error => {
        console.error(error);
        if (!silent) {
          setTopic(null);
        }
        setTopicLoadError("Could not load this topic right now.");
        setIsLoadingTopic(false);
      });
  }, [topicId]);

  const loadPosts = useCallback(() => {
    const params = new URLSearchParams();
    if (currentUser?.id) {
      params.set("user_id", String(currentUser.id));
    }

    const query = params.toString();
    const url = query ? `${API_BASE}/posts/${topicId}/?${query}` : `${API_BASE}/posts/${topicId}/`;

    return fetch(url)
      .then(res => res.json())
      .then(data => {
        const normalized = data.map((post: any) => ({
          ...post,
          POST_ID: Number(post.POST_ID),
          CREATED_BY: Number(post.CREATED_BY),
          PARENT_POST_ID: post.PARENT_POST_ID === null ? null : Number(post.PARENT_POST_ID),
          IS_DELETED: Number(post.IS_DELETED),
          UPVOTES: Number(post.UPVOTES || 0),
          PENDING_REPORT_COUNT: Number(post.PENDING_REPORT_COUNT || 0),
          REPORT_REASON_SUMMARY: post.REPORT_REASON_SUMMARY || "",
          REPORT_DETAILS_SUMMARY: post.REPORT_DETAILS_SUMMARY || "",
          HAS_UPVOTED: Number(post.HAS_UPVOTED || 0),
          UPDATED_AT: post.UPDATED_AT || null
        }));
        setPosts(normalized);
      })
      .catch(error => {
        console.error(error);
      });
  }, [currentUser?.id, topicId]);

  useEffect(() => {
    loadTopic();
    loadPosts();
  }, [loadTopic, loadPosts]);

  useEffect(() => {
    const handleFocus = () => {
      loadTopic();
      loadPosts();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadTopic, loadPosts]);

  useEffect(() => {
    if (!focusedReplyId || posts.length === 0) {
      return;
    }

    const targetExists = posts.some(post => String(post.POST_ID) === focusedReplyId);
    if (!targetExists || lastFocusedReplyRef.current === focusedReplyId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const targetElement = document.getElementById(`reply-${focusedReplyId}`);
      if (!targetElement) {
        return;
      }

      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedReplyId(focusedReplyId);
      lastFocusedReplyRef.current = focusedReplyId;

      if (highlightedReplyTimeoutRef.current) {
        window.clearTimeout(highlightedReplyTimeoutRef.current);
      }

      highlightedReplyTimeoutRef.current = window.setTimeout(() => {
        setHighlightedReplyId(current => (current === focusedReplyId ? null : current));
      }, 3500);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [focusedReplyId, posts]);

  useEffect(() => {
    return () => {
      if (highlightedReplyTimeoutRef.current) {
        window.clearTimeout(highlightedReplyTimeoutRef.current);
      }
    };
  }, []);

  const submitReply = async (parent: number | null) => {
    if (!currentUser) return;

    const parentPost = posts.find(post => post.POST_ID === parent);
    if (parentPost && parentPost.IS_DELETED === 1) return;

    const text = parent === null ? reply.trim() : inlineReply.trim();
    if (!text) return;

    const res = await fetch(`${API_BASE}/add-reply/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic_id: topicId,
        user_id: currentUser.id,
        content: text,
        parent_id: parent
      })
    });

    const data = await res.json();

    if (!data.success) {
      toast.error(data.message || "Could not post reply");
      return;
    }

    setReply("");
    setInlineReply("");
    setReplyBox(null);
    setTopic(prevTopic => (
      prevTopic
        ? {
            ...prevTopic,
            REPLY_COUNT: Number(prevTopic.REPLY_COUNT || 0) + 1
          }
        : prevTopic
    ));
    await Promise.all([loadPosts(), loadTopic({ silent: true })]);
  };

  const deleteReply = async (postId: number) => {
    if (!currentUser) return;

    const res = await fetch(`${API_BASE}/delete-reply/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post_id: postId,
        user_id: currentUser.id,
        requester_role: currentUser.role
      })
    });

    const data = await res.json();

    if (!data.success) {
      toast.error(data.message || "Could not delete reply");
      return;
    }

    setEditBox(null);
    setReplyBox(null);
    setInlineReply("");
    await Promise.all([loadPosts(), loadTopic({ silent: true })]);
  };

  const updateReply = async (postId: number) => {
    const post = posts.find(item => item.POST_ID === postId);
    if (!post || post.IS_DELETED === 1) return;

    const content = editText.trim();
    if (!content) return;

    const res = await fetch(`${API_BASE}/update-reply/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post_id: postId,
        content
      })
    });

    const data = await res.json();
    if (!data.success) {
      toast.error(data.message || "Could not update reply");
      return;
    }

    setEditBox(null);
    setEditText("");
    await loadPosts();
  };

  const upvote = async (postId: number) => {
    if (!currentUser) return;

    const post = posts.find(item => item.POST_ID === postId);
    if (!post || post.IS_DELETED === 1) return;

    const previousPosts = posts;
    const hasUpvoted = Number(post.HAS_UPVOTED || 0) === 1;

    setPosts(prevPosts =>
      prevPosts.map(item =>
        item.POST_ID === postId
          ? {
              ...item,
              UPVOTES: Math.max(0, item.UPVOTES + (hasUpvoted ? -1 : 1)),
              HAS_UPVOTED: hasUpvoted ? 0 : 1
            }
          : item
      )
    );

    try {
      const res = await fetch(`${API_BASE}/upvote-reply/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: postId,
          user_id: currentUser.id
        })
      });

      const data = await res.json();

      if (!data.success) {
        setPosts(previousPosts);
        return;
      }

      setPosts(prevPosts =>
        prevPosts.map(item =>
          item.POST_ID === postId
            ? {
                ...item,
                HAS_UPVOTED: data.upvoted ? 1 : 0
              }
            : item
        )
      );
    } catch (error) {
      console.error(error);
      setPosts(previousPosts);
    }
  };

  const submitReport = async () => {
    if (!currentUser || !reportTarget || !reportReason.trim()) {
      toast.error("Please choose a reason for the report");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/report-content/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporter_id: currentUser.id,
          target_type: reportTarget.type,
          target_id: reportTarget.id,
          reason: reportReason.trim(),
          details: reportDetails.trim(),
        })
      });

      if (!res.ok) {
        throw new Error(`report-content failed with ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Could not submit report");
        return;
      }

      toast.success(`${reportTarget.label} reported for admin review`);
      setReportTarget(null);
      setReportReason("");
      setReportDetails("");
      await loadPosts();
    } catch (error) {
      console.error(error);
      toast.error("Could not submit report");
    }
  };

  const discussionCount = posts.filter(post => post.PARENT_POST_ID === null).length;

  const topLevelPosts = useMemo(
    () => posts.filter(post => post.PARENT_POST_ID === null),
    [posts]
  );

  const topicCategory = useMemo(() => {
    if (!topic?.CATEGORY_NAME) return "campus-events-general" as Category;
    return categoryNameToSlug[topic.CATEGORY_NAME] || "campus-events-general";
  }, [topic]);

  const topicImage = buildImageUrl(topic?.COVER_IMAGE_PATH);
  const topicRole = normalizeRole(topic?.ROLE);
  const topicAuthor = [topic?.FIRST_NAME, topic?.LAST_NAME].filter(Boolean).join(" ").trim() || "Unknown";
  const topicReplyCount = Number(topic?.REPLY_COUNT || posts.length || 0);
  const topicUpvotes = Number(topic?.TOPIC_UPVOTES || 0);
  const isTopicInactive = String(topic?.STATUS || "approved").toLowerCase() === "inactive";
  const currentUserId = toIdString(currentUser?.id);
  const topicOwnerId = toIdString(topic?.CREATED_BY);
  const canSeeReportedReplyState =
    currentUser?.role === "admin" ||
    currentUser?.role === "faculty" ||
    currentUserId === topicOwnerId;
  const canSeeReportedReplyDetails =
    currentUser?.role === "admin" || currentUserId === topicOwnerId;

  const renderReplies = (parent: number | null, level = 0) => {
    const items = posts.filter(post => post.PARENT_POST_ID === parent);

    return items.map(post => {
      const postOwnerId = toIdString(post.CREATED_BY);
      const canEdit =
        post.IS_DELETED !== 1 &&
        (currentUserId === postOwnerId || currentUser?.role === "admin");

      const canDelete =
        post.IS_DELETED !== 1 &&
        (currentUserId === postOwnerId ||
          currentUser?.role === "admin" ||
          currentUserId === topicOwnerId);

      const isEditing = editBox === post.POST_ID;
      const isReplying = replyBox === post.POST_ID;
      const hasChildren = posts.some(item => item.PARENT_POST_ID === post.POST_ID);
      const authorName = [post.FIRST_NAME, post.LAST_NAME].filter(Boolean).join(" ").trim() || "Unknown User";
      const authorRole = normalizeRole(post.ROLE);
      const hasUpvoted = Number(post.HAS_UPVOTED || 0) === 1;
      const isEdited = Boolean(post.UPDATED_AT);
      const isReported = Number(post.PENDING_REPORT_COUNT || 0) > 0;
      const reportCount = Number(post.PENDING_REPORT_COUNT || 0);

      return (
        <div
          key={post.POST_ID}
          id={`reply-${post.POST_ID}`}
          className={`${level === 0 ? "py-4" : "pt-4"} ${parent !== null ? "ml-3 border-l border-slate-200 pl-4" : ""}`}
        >
          <div className={`flex gap-3 rounded-3xl border p-4 shadow-[0_6px_24px_rgba(15,23,42,0.05)] transition-all duration-300 ${
            highlightedReplyId === String(post.POST_ID)
              ? "border-amber-300 bg-amber-50/90 ring-4 ring-amber-100"
              : "border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]"
          }`}>
            <button
              onClick={() => upvote(post.POST_ID)}
              disabled={post.IS_DELETED === 1 || isTopicInactive}
              className={`flex w-10 shrink-0 flex-col items-center justify-start rounded-2xl border border-slate-200 bg-white py-2 text-xs font-semibold transition-colors ${
                post.IS_DELETED === 1 || isTopicInactive
                  ? "cursor-not-allowed text-slate-300"
                  : hasUpvoted
                    ? "text-orange-600"
                    : "text-slate-400 hover:text-orange-600"
              }`}
              aria-label={`Upvote reply by ${authorName}`}
              aria-pressed={hasUpvoted}
            >
              <ArrowUp
                size={16}
                className={`mb-1 ${hasUpvoted ? "fill-orange-600" : ""}`}
              />
              <span className="text-[11px] leading-none">{post.UPVOTES}</span>
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => navigate(`/profile/${postOwnerId}`)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition hover:opacity-85 ${getRoleBadgeColor(authorRole)}`}
                >
                  {authorName}
                </button>
                {isReported && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                    {canSeeReportedReplyState
                      ? `Reported by ${reportCount} ${reportCount === 1 ? "user" : "users"}`
                      : "Reported • Under review"}
                  </span>
                )}
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500">
                  {formatAbsoluteDate(post.CREATED_AT) ||
                    (post.CREATED_AT ? formatTimeAgo(new Date(post.CREATED_AT)) : "")}
                </span>
                {isEdited && (
                  <>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs font-medium text-slate-500">Edited</span>
                  </>
                )}
              </div>

              <div className="mt-2 text-sm leading-7 text-slate-700">
                {post.IS_DELETED === 1 ? (
                  <span className="italic text-slate-400">This comment has been deleted.</span>
                ) : isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => updateReply(post.POST_ID)}
                        disabled={!editText.trim()}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => {
                          setEditBox(null);
                          setEditText("");
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-[15px]">{post.CONTENT}</p>
                )}
              </div>

              {isReported && canSeeReportedReplyDetails && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                    Report Summary
                  </p>
                  {post.REPORT_REASON_SUMMARY && (
                    <p className="mt-2 text-sm font-medium text-amber-950">
                      Reasons: {post.REPORT_REASON_SUMMARY}
                    </p>
                  )}
                  {post.REPORT_DETAILS_SUMMARY && (
                    <p className="mt-2 text-sm leading-7 text-amber-900">
                      Details: {post.REPORT_DETAILS_SUMMARY}
                    </p>
                  )}
                </div>
              )}

              {post.IS_DELETED !== 1 && !isEditing && (
                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs">
                  <button
                    onClick={() => {
                      if (isTopicInactive) return;
                      setReplyBox(isReplying ? null : post.POST_ID);
                      setInlineReply("");
                    }}
                    disabled={isTopicInactive}
                    className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition hover:text-slate-800"
                  >
                    <Reply size={14} />
                    <span>Reply</span>
                  </button>

                  {canEdit && (
                    <button
                      onClick={() => {
                        setEditBox(post.POST_ID);
                        setEditText(post.CONTENT);
                        setReplyBox(null);
                        setInlineReply("");
                      }}
                      className="inline-flex items-center gap-1.5 font-medium text-slate-500 transition hover:text-blue-700"
                    >
                      <Edit2 size={14} />
                      <span>Edit</span>
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => deleteReply(post.POST_ID)}
                      className="inline-flex items-center gap-1.5 font-medium text-red-500 transition hover:text-red-600"
                    >
                      <Trash2 size={14} />
                      <span>{isReported && canSeeReportedReplyState ? 'Remove Reported Reply' : 'Delete'}</span>
                    </button>
                  )}
                  {post.IS_DELETED !== 1 && currentUserId !== postOwnerId && !isReported && (
                    <button
                      onClick={() => setReportTarget({ type: "reply", id: String(post.POST_ID), label: "Reply" })}
                      className="inline-flex items-center gap-1.5 font-medium text-amber-600 transition hover:text-amber-700"
                    >
                      <AlertCircle size={14} />
                      <span>Report</span>
                    </button>
                  )}
                  {post.IS_DELETED !== 1 && currentUserId !== postOwnerId && isReported && !canSeeReportedReplyState && (
                    <span className="inline-flex items-center gap-1.5 font-medium text-amber-600">
                      <AlertCircle size={14} />
                      <span>Reported to admin</span>
                    </span>
                  )}
                </div>
              )}

              {isReplying && post.IS_DELETED !== 1 && !isTopicInactive && (
                <div className="mt-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
                  <textarea
                    value={inlineReply}
                    onChange={(event) => setInlineReply(event.target.value)}
                    rows={3}
                    placeholder={`Reply to ${authorName}...`}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      onClick={() => submitReply(post.POST_ID)}
                      disabled={!inlineReply.trim()}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Post Reply
                    </button>
                    <button
                      onClick={() => {
                        setReplyBox(null);
                        setInlineReply("");
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {hasChildren && <div className="mt-3">{renderReplies(post.POST_ID, level + 1)}</div>}
            </div>
          </div>
        </div>
      );
    });
  };

  if (isLoadingTopic) {
    return (
      <div className="bg-slate-50">
        <div className="mx-auto max-w-4xl p-6">
          <button
            onClick={() => navigate("/")}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft size={18} />
            <span>Go to Homepage</span>
          </button>

          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">Loading topic...</h1>
            <p className="mt-3 text-sm text-slate-600">
              Please wait while we load the discussion.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="bg-slate-50">
        <div className="mx-auto max-w-4xl p-6">
          <button
            onClick={() => navigate("/")}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft size={18} />
            <span>Go to Homepage</span>
          </button>

          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">Topic unavailable right now</h1>
            <p className="mt-3 text-sm text-slate-600">
              {topicLoadError || "This topic may be inactive at the moment. If an admin has reactivated it, refresh this page or return after switching back to the app."}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => {
                  loadTopic();
                  loadPosts();
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Refresh Topic
              </button>
              <button
                onClick={() => navigate("/")}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Back Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <button
          onClick={() => navigate("/")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft size={18} />
          <span>Return to Discussion Feed</span>
        </button>

        <div className="university-panel overflow-hidden">
          {topicImage && (
            <div className="relative h-[180px] w-full bg-slate-100 sm:h-[240px]">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.05)_0%,rgba(15,23,42,0.28)_100%)]" />
              <img
                src={topicImage}
                alt={topic.TITLE}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="p-6 sm:p-7">
            <div className="flex gap-4">
              <div className="flex h-fit w-12 shrink-0 flex-col items-center rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_100%)] px-2 py-3 text-orange-600 shadow-[0_4px_16px_rgba(249,115,22,0.08)]">
                <ArrowUp size={16} />
                <span className="mt-1.5 text-lg font-bold leading-none">
                  {topicUpvotes}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryTag category={topicCategory} />
                    {isTopicInactive && (
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  {currentUserId !== topicOwnerId && (
                    <button
                      onClick={() => setReportTarget({ type: "topic", id: String(topic?.TOPIC_ID || ""), label: "Topic" })}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      Report Topic
                    </button>
                  )}
                </div>

                <h1 className="max-w-3xl font-serif text-[24px] font-semibold tracking-tight text-slate-900 sm:text-[32px]">
                  {topic.TITLE}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-2.5 text-sm text-slate-500">
                  <span>Posted by</span>
                  <button
                    onClick={() => navigate(`/profile/${topicOwnerId}`)}
                    className={`rounded-md border px-2 py-0.5 text-sm font-semibold transition hover:opacity-85 ${getRoleBadgeColor(topicRole)}`}
                  >
                    {topicAuthor}
                  </button>
                  <span>•</span>
                  <span>
                    {formatAbsoluteDate(topic.CREATED_AT) ||
                      (topic.CREATED_AT ? formatTimeAgo(new Date(topic.CREATED_AT)) : "")}
                  </span>
                </div>

                <p className="mt-4 max-w-3xl whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
                  {topic.DESCRIPTION}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 text-slate-500">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <MessageSquare size={15} />
                    <span className="text-sm font-medium">
                      {topicReplyCount} {topicReplyCount === 1 ? "Reply" : "Replies"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="university-panel mt-6 overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eff6ff_100%)] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Join Discussion</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Add a Reply</h2>
              </div>
            </div>
          </div>
          <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm leading-7 text-slate-600">
                Add a thoughtful response to keep the discussion useful and professional.
              </p>
            </div>
          </div>
          {isTopicInactive && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This topic has been marked inactive. You can still read the discussion, but replying is disabled until an admin activates it again.
            </div>
          )}
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={4}
            placeholder={isTopicInactive ? "Replies are disabled for inactive topics." : "Share your thoughts..."}
            disabled={isTopicInactive}
            className={`mt-3 w-full rounded-xl border px-4 py-3 text-sm outline-none transition ${
              isTopicInactive
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-200 text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            }`}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {isTopicInactive
                ? "This topic is inactive, so new replies are disabled."
                : reply.trim()
                ? "Your reply is ready to post."
                : "Type a reply to enable the post button."}
            </p>
            <button
              onClick={() => submitReply(null)}
              disabled={isTopicInactive || !reply.trim()}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${
                !isTopicInactive && reply.trim()
                  ? "bg-blue-600 shadow-sm hover:bg-blue-700"
                  : "cursor-not-allowed bg-slate-300"
              }`}
            >
              Post Reply
            </button>
          </div>
          </div>
        </div>

        <div className="university-panel mt-6 overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Conversation</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Discussion
              </h2>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
              {discussionCount}
            </div>
          </div>
          </div>

          {topLevelPosts.length === 0 ? (
            <div className="m-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500 sm:m-6">
              No discussion yet. Start the conversation with the first reply.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 px-5 py-2 sm:px-6">
              {renderReplies(null)}
            </div>
          )}
        </div>

        {reportTarget && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4">
            <div className="university-panel w-full max-w-lg p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Report {reportTarget.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Submit this report so UniConnect admins can review the content.</p>
                </div>
              </div>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="mt-5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Select a reason</option>
                <option value="Spam or misleading">Spam or misleading</option>
                <option value="Harassment or abuse">Harassment or abuse</option>
                <option value="Inappropriate content">Inappropriate content</option>
                <option value="False information">False information</option>
              </select>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={4}
                placeholder="Add any supporting details for the admin team..."
                className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setReportTarget(null);
                    setReportReason("");
                    setReportDetails("");
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReport}
                  className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                >
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
