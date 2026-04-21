import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  User,
  LogOut,
  Plus,
  Settings,
  MessageCircle,
  Shield,
  BookOpen,
  Bell,
  Check,
  Reply,
  Trash2,
  X,
  AlertCircle,
  UserCheck,
  Building2
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatTimeAgo } from '../utils/helpers.ts';
import { toast } from 'sonner';
import { PopupDialog } from './PopupDialog.tsx';
import { Notification } from '../types';
import { defaultNotificationPreferences } from '../utils/userMeta.ts';

interface FacultyRequest {
  USER_ID: number;
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL: string;
}

type NotificationFilter = 'all' | 'unread' | 'approvals' | 'reports' | 'classes';

const notificationGroupMeta: Record<string, { label: string; tone: string }> = {
  approvals: { label: 'Approvals & Requests', tone: 'text-emerald-700' },
  replies: { label: 'Replies & Discussion', tone: 'text-blue-700' },
  classes: { label: 'Class Activity', tone: 'text-indigo-700' },
  moderation: { label: 'Moderation Notices', tone: 'text-amber-700' },
  general: { label: 'General Updates', tone: 'text-slate-700' },
};

const getNotificationGroupKey = (type: Notification['type']) => {
  if (type === 'topic_request_approved' || type === 'topic_request_rejected' || type === 'topic_request_more_info') {
    return 'approvals';
  }
  if (type === 'topic_comment_posted' || type === 'comment_reply_posted' || type === 'new_topic_in_followed_category') {
    return 'replies';
  }
  if (type === 'class_topic_posted' || type === 'class_reply_posted') {
    return 'classes';
  }
  if (type === 'reported_reply_notice' || type === 'reported_topic_notice') {
    return 'moderation';
  }
  return 'general';
};

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    currentUser,
    setCurrentUser,
    setNotifications,
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showFacultyRequests, setShowFacultyRequests] = useState(false);
  const [facultyRequests, setFacultyRequests] = useState<FacultyRequest[]>([]);
  const [pendingTopicRequestsCount, setPendingTopicRequestsCount] = useState(0);
  const [classCounter, setClassCounter] = useState(0);
  const [messageCounter, setMessageCounter] = useState(0);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all');

  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    setCurrentUser(null);
    setShowLogoutDialog(false);
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const loadNotifications = useCallback(() => {
    if (!currentUser) return;

    fetch(`https://uniconnectforum.onrender.com/api/notifications/${currentUser.id}/`)
      .then(res => res.json())
      .then(data => setNotifications(
        data.map((notification: any) => ({
          ...notification,
          createdAt: new Date(notification.createdAt)
        }))
      ))
      .catch(err => console.error('NOTIFICATION LOAD ERROR:', err));
  }, [currentUser, setNotifications]);

  const loadClassCounter = useCallback(() => {
    if (!currentUser || currentUser.role === 'admin') {
      setClassCounter(0);
      return;
    }

    const params = new URLSearchParams({
      user_id: String(currentUser.id),
      role: currentUser.role,
    });

    fetch(`https://uniconnectforum.onrender.com/api/class-join-requests/?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        const requests = Array.isArray(data) ? data : [];
        setClassCounter(
          requests.filter((request: any) => request.status === 'pending').length
        );
      })
      .catch(err => {
        console.error('CLASS COUNTER LOAD ERROR:', err);
        setClassCounter(0);
      });
  }, [currentUser]);

  const loadMessageCounter = useCallback(() => {
    if (!currentUser) {
      setMessageCounter(0);
      return;
    }

    fetch(`https://uniconnectforum.onrender.com/api/messages/conversations/${currentUser.id}/`)
      .then(res => res.json())
      .then(data => {
        const conversations = Array.isArray(data) ? data : [];
        const unreadTotal = conversations.reduce(
          (total: number, conversation: any) => total + Number(conversation.unreadCount || 0),
          0
        );
        setMessageCounter(unreadTotal);
      })
      .catch(err => {
        console.error('MESSAGE COUNTER LOAD ERROR:', err);
        setMessageCounter(0);
      });
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadNotifications();
      loadClassCounter();
      loadMessageCounter();
    }

    if (currentUser?.role === 'admin') {
      loadFacultyRequests();
      loadPendingTopicRequestsCount();
    }

    const handleFocus = () => {
      if (currentUser) {
        loadNotifications();
        loadClassCounter();
        loadMessageCounter();
      }
    };

    const intervalId = window.setInterval(() => {
      if (currentUser) {
        loadNotifications();
        loadClassCounter();
        loadMessageCounter();
      }
    }, 10000);

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser, loadNotifications, loadClassCounter, loadMessageCounter]);

  const loadFacultyRequests = () => {
    fetch('https://uniconnectforum.onrender.com/api/faculty_requests/')
      .then(res => res.json())
      .then(data => setFacultyRequests(data))
      .catch(err => console.error('FACULTY REQUEST LOAD ERROR:', err));
  };

  const loadPendingTopicRequestsCount = () => {
    fetch('https://uniconnectforum.onrender.com/api/pending-topic-requests/')
      .then(res => res.json())
      .then(data => setPendingTopicRequestsCount(data.length))
      .catch(err => console.error('TOPIC REQUEST LOAD ERROR:', err));
  };

  const approveFaculty = async (userId: number) => {
    try {
      const res = await fetch('https://uniconnectforum.onrender.com/api/approve_faculty/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();

      if (data.success) {
        setFacultyRequests(prev => prev.filter(req => req.USER_ID !== userId));
        toast.success('Faculty request approved');
      } else {
        toast.error('Could not approve faculty request');
      }
    } catch (err) {
      console.error('APPROVE FACULTY ERROR:', err);
      toast.error('Could not approve faculty request');
    }
  };

  if (!currentUser || location.pathname === '/login') {
    return null;
  }

  const pendingRequestsCount = currentUser.role === 'admin' ? pendingTopicRequestsCount : 0;
  const notificationPreferences = currentUser.notificationPreferences || defaultNotificationPreferences();
  const userNotifications = getNotifications()
    .filter(n => String(n.userId) === String(currentUser.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const isNotificationVisible = (notification: Notification) => {
    const groupKey = getNotificationGroupKey(notification.type);
    if (groupKey === 'approvals') return notificationPreferences.approvals;
    if (groupKey === 'replies') return notificationPreferences.replies;
    if (groupKey === 'classes') return notificationPreferences.classActivity;
    if (groupKey === 'moderation') return notificationPreferences.moderation;
    return true;
  };
  const visibleNotifications = userNotifications.filter(isNotificationVisible);
  const filteredNotifications = visibleNotifications.filter((notification) => {
    if (notificationFilter === 'all') return true;
    if (notificationFilter === 'unread') return !notification.read;
    if (notificationFilter === 'approvals') return getNotificationGroupKey(notification.type) === 'approvals';
    if (notificationFilter === 'reports') return getNotificationGroupKey(notification.type) === 'moderation';
    if (notificationFilter === 'classes') return getNotificationGroupKey(notification.type) === 'classes';
    return true;
  });
  const unreadCount = visibleNotifications.filter(notification => !notification.read).length;
  const notificationGroups = Object.entries(
    filteredNotifications.reduce((groups, notification) => {
      const key = getNotificationGroupKey(notification.type);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(notification);
      return groups;
    }, {} as Record<string, Notification[]>)
  );

  const digestItems = notificationGroups
    .slice(0, 3)
    .map(([groupKey, notifications]) => {
      const latest = notifications[0];
      return `${notificationGroupMeta[groupKey]?.label || 'Update'}: ${notifications.length} item${notifications.length === 1 ? '' : 's'}${latest ? `, latest ${formatTimeAgo(latest.createdAt)}` : ''}`;
    });

  const renderNotificationIcon = (type: Notification['type']) => {
    if (type === 'topic_request_approved') {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
          <Check size={16} />
        </div>
      );
    }
    if (type === 'topic_request_rejected') {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600">
          <X size={16} />
        </div>
      );
    }
    if (type === 'topic_request_more_info' || type === 'reported_reply_notice' || type === 'reported_topic_notice') {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <AlertCircle size={16} />
        </div>
      );
    }
    if (type === 'class_topic_posted' || type === 'class_reply_posted') {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <BookOpen size={16} />
        </div>
      );
    }
    if (type === 'comment_reply_posted') {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600">
          <Reply size={16} />
        </div>
      );
    }
    if (type === 'topic_comment_posted') {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <MessageCircle size={16} />
        </div>
      );
    }
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <Bell size={16} />
      </div>
    );
  };

  const getNotificationReason = (notification: Notification) => {
    if (notification.type === 'topic_request_approved') return 'You requested this topic and it was approved.';
    if (notification.type === 'topic_request_rejected') return 'You requested this topic and it was rejected.';
    if (notification.type === 'topic_request_more_info') return 'An admin needs more information from you.';
    if (notification.type === 'topic_comment_posted') return 'Someone commented on a topic you created.';
    if (notification.type === 'comment_reply_posted') return 'Someone replied in a discussion you participated in.';
    if (notification.type === 'new_topic_in_followed_category') return 'This matches a discussion category you follow.';
    if (notification.type === 'class_topic_posted' || notification.type === 'class_reply_posted') return 'This came from one of your classes.';
    if (notification.type === 'reported_reply_notice' || notification.type === 'reported_topic_notice') return 'Content you own was reported and sent for review.';
    return 'This is part of your UniConnect activity feed.';
  };

  const getNotificationJumpLabel = (notification: Notification) => {
    if (notification.type === 'class_topic_posted' || notification.type === 'class_reply_posted') return 'Jump to class';
    if (notification.type === 'topic_request_rejected' || notification.type === 'topic_request_more_info') return 'Jump to profile';
    return 'Jump to item';
  };

  const handleNotificationClick = (notificationId: string, relatedId?: string) => {
    markNotificationAsRead(notificationId);
    setShowNotifications(false);

    if (relatedId) {
      const notification = userNotifications.find(n => n.id === notificationId);
      if (
        notification?.type === 'topic_request_approved' ||
        notification?.type === 'new_topic_in_followed_category' ||
        notification?.type === 'topic_comment_posted' ||
        notification?.type === 'comment_reply_posted'
      ) {
        navigate(`/topic/${relatedId}`);
      } else if (notification?.type === 'reported_reply_notice') {
        const [topicId, replyId] = String(relatedId).split(':');
        if (topicId && replyId) {
          navigate(`/topic/${topicId}?reply=${replyId}`);
        } else if (topicId) {
          navigate(`/topic/${topicId}`);
        }
      } else if (notification?.type === 'reported_topic_notice') {
        navigate(`/topic/${relatedId}`);
      } else if (
        notification?.type === 'class_topic_posted' ||
        notification?.type === 'class_reply_posted'
      ) {
        navigate(`/class/${relatedId}`);
      } else if (
        notification?.type === 'topic_request_rejected' ||
        notification?.type === 'topic_request_more_info'
      ) {
        navigate('/profile');
      }
    }
  };

  const handleMarkAllAsRead = () => {
    markAllNotificationsAsRead();
    setShowNotifications(false);
  };

  const handleDeleteNotification = (notificationId: string) => {
    deleteNotification(notificationId);
  };

  const actionButtonBase = 'hidden lg:flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors';
  const iconButtonBase = 'relative rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900';

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/70 bg-slate-950/95 text-white shadow-[0_20px_40px_-32px_rgba(15,23,42,0.95)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div
            onClick={() => navigate('/')}
            className="flex min-w-0 cursor-pointer items-center gap-3 transition-opacity hover:opacity-90 sm:gap-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <GraduationCap className="text-white" size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">UniConnect</p>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  <Building2 size={11} />
                  Campus Platform
                </span>
              </div>
              <h1 className="truncate font-serif text-lg font-semibold text-white sm:text-xl">UniConnect</h1>
              <p className="hidden text-xs text-slate-300 lg:block">Professional campus discussions for students, faculty, and administrators</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser.role === 'student' && (
              <button
                onClick={() => navigate('/submit-request')}
                className={`${actionButtonBase} bg-white text-slate-900 hover:bg-slate-100`}
              >
                <Plus size={16} />
                <span>Submit Topic Request</span>
              </button>
            )}

            {(currentUser.role === 'faculty' || currentUser.role === 'admin') && (
              <button
                onClick={() => navigate('/create-topic')}
                className={`${actionButtonBase} bg-blue-600 text-white hover:bg-blue-700`}
              >
                <Plus size={16} />
                <span>Create Topic</span>
              </button>
            )}

            {currentUser.role === 'admin' && (
              <>
                <button
                  onClick={() => navigate('/admin')}
                  className={`${actionButtonBase} bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25 hover:bg-emerald-500/25`}
                >
                  <Settings size={16} />
                  <span>Admin Dashboard</span>
                  {pendingRequestsCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold text-slate-900">
                      {pendingRequestsCount}
                    </span>
                  )}
                </button>

                <div className="relative hidden lg:block">
                  <button
                    onClick={() => {
                      if (!showFacultyRequests) {
                        loadFacultyRequests();
                      }
                      loadNotifications();
                      setShowFacultyRequests(!showFacultyRequests);
                      setShowNotifications(false);
                    }}
                    className={`${iconButtonBase} border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white`}
                    title="Faculty Requests"
                  >
                    <UserCheck size={20} />
                    {facultyRequests.length > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white">
                        {facultyRequests.length}
                      </span>
                    )}
                  </button>

                  {showFacultyRequests && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowFacultyRequests(false)} />
                      <div className="university-panel absolute right-0 top-full z-50 mt-3 w-[calc(100vw-2rem)] max-w-96 overflow-hidden sm:w-96">
                        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">Faculty Requests</h3>
                            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{facultyRequests.length} pending</span>
                          </div>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {facultyRequests.length === 0 ? (
                            <div className="px-6 py-10 text-center text-slate-500">
                              <UserCheck size={32} className="mx-auto mb-3 opacity-40" />
                              <p className="text-sm">No pending faculty requests</p>
                            </div>
                          ) : (
                            facultyRequests.map((req) => (
                              <div key={req.USER_ID} className="border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-slate-50/70">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">{req.FIRST_NAME} {req.LAST_NAME}</p>
                                    <p className="text-xs text-slate-500 break-all">{req.EMAIL}</p>
                                  </div>
                                  <button
                                    onClick={() => approveFaculty(req.USER_ID)}
                                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                                  >
                                    Approve
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => navigate('/admin')}
                  className="relative rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 transition-colors hover:bg-white/10 lg:hidden"
                  title="Admin Dashboard"
                >
                  <Shield size={20} />
                  {pendingRequestsCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white">
                      {pendingRequestsCount}
                    </span>
                  )}
                </button>
              </>
            )}

            {currentUser.role !== 'admin' && (
              <button onClick={() => navigate('/classes')} className={iconButtonBase} title="Classes">
                <BookOpen size={20} />
                {classCounter > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white">
                    {classCounter}
                  </span>
                )}
              </button>
            )}

            <button onClick={() => navigate('/messages')} className={iconButtonBase} title="Messages">
              <MessageCircle size={20} />
              {messageCounter > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white">
                  {messageCounter}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  loadNotifications();
                  setShowNotifications(!showNotifications);
                  setShowFacultyRequests(false);
                  setNotificationFilter('all');
                }}
                className={iconButtonBase}
                title="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="university-panel absolute right-0 top-full z-50 mt-3 w-[calc(100vw-2rem)] max-w-96 overflow-hidden sm:w-96">
                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">Notifications</h3>
                        {visibleNotifications.length > 0 && (
                          <button onClick={handleMarkAllAsRead} className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 hover:text-blue-900">
                            Mark all read
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-[30rem] overflow-y-auto">
                      <div className="border-b border-slate-200 bg-white px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          {([
                            ['all', 'All'],
                            ['unread', 'Unread'],
                            ['reports', 'Reports'],
                            ['approvals', 'Approvals'],
                            ['classes', 'Classes'],
                          ] as Array<[NotificationFilter, string]>).map(([value, label]) => (
                            <button
                              key={value}
                              onClick={() => setNotificationFilter(value)}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                notificationFilter === value
                                  ? 'bg-slate-900 text-white'
                                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {notificationPreferences.emailStyleSummary && digestItems.length > 0 && (
                        <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Notification Summary</p>
                          <div className="mt-3 space-y-2">
                            {digestItems.map((item) => (
                              <p key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                {item}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      {filteredNotifications.length === 0 ? (
                        <div className="px-6 py-10 text-center text-slate-500">
                          <Bell size={32} className="mx-auto mb-3 opacity-40" />
                          <p className="text-sm">No notifications match this filter</p>
                        </div>
                      ) : (
                        notificationGroups.map(([groupKey, notifications]) => (
                          <div key={groupKey} className="border-b border-slate-100 last:border-b-0">
                            <div className="flex items-center justify-between bg-slate-50/80 px-5 py-3">
                              <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${notificationGroupMeta[groupKey]?.tone || 'text-slate-700'}`}>
                                {notificationGroupMeta[groupKey]?.label || 'Updates'}
                              </p>
                              <span className="text-xs text-slate-500">{notifications.length}</span>
                            </div>
                            {notifications.map(notification => (
                              <div
                                key={notification.id}
                                className={`cursor-pointer border-t border-slate-100 px-5 py-4 transition-colors hover:bg-slate-50 ${!notification.read ? 'bg-blue-50/70' : ''}`}
                                onClick={() => handleNotificationClick(notification.id, notification.relatedId)}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-1 flex-shrink-0">
                                    {renderNotificationIcon(notification.type)}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <p className="mb-1 text-sm font-semibold text-slate-900">{notification.title}</p>
                                    <p className="mb-2 text-sm leading-6 text-slate-600">{notification.message}</p>
                                    <p className="mb-2 text-xs text-slate-500">Why am I seeing this? {getNotificationReason(notification)}</p>
                                    <p className="text-xs font-medium text-blue-700">{getNotificationJumpLabel(notification)}</p>
                                    <p className="text-xs text-slate-500">{formatTimeAgo(notification.createdAt)}</p>
                                  </div>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteNotification(notification.id);
                                    }}
                                    className="flex-shrink-0 p-1 text-slate-400 transition-colors hover:text-red-600"
                                    title="Delete notification"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => navigate('/profile')}
              className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 sm:flex"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <User size={16} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900">{currentUser.name}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{currentUser.role}</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/profile')}
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:hidden"
              title="Profile"
            >
              <User size={16} />
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="border-t border-white/10 px-4 py-3 sm:hidden">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto">
            {currentUser.role === 'student' && (
              <button
                onClick={() => navigate('/submit-request')}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-slate-900"
              >
                <Plus size={15} />
                Request Topic
              </button>
            )}
            {(currentUser.role === 'faculty' || currentUser.role === 'admin') && (
              <button
                onClick={() => navigate('/create-topic')}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-medium text-white"
              >
                <Plus size={15} />
                Create Topic
              </button>
            )}
            {currentUser.role !== 'admin' && (
              <button
                onClick={() => navigate('/classes')}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-white"
              >
                <BookOpen size={15} />
                Classes
              </button>
            )}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/15 px-3.5 py-2 text-sm font-medium text-emerald-100"
              >
                <Settings size={15} />
                Admin
              </button>
            )}
            <button
              onClick={() => navigate('/messages')}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-white"
            >
              <MessageCircle size={15} />
              Messages
            </button>
          </div>
        </div>
      </header>

      <PopupDialog
        isOpen={showLogoutDialog}
        title="Log out of UniConnect?"
        message="You will need to sign in again to access your topics, messages, and classes. Any unsaved changes on the current page may be lost."
        confirmLabel="Yes, Log Out"
        cancelLabel="Stay Signed In"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutDialog(false)}
      />
    </>
  );
};
