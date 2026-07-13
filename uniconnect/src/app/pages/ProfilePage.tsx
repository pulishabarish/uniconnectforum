import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Clock,
  Edit2,
  FileText,
  Mail,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext.tsx';
import { Category, NotificationPreferences, User } from '../types';
import { CategoryTag } from '../components/CategoryTag.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { categoryNameToSlug, getRoleBadgeColor } from '../utils/helpers.ts';
import {
  defaultNotificationPreferences,
  mergeUserWithStoredMeta,
  parseCategoryList,
  parseTagList,
} from '../utils/userMeta.ts';

interface ProfileTopic {
  id: string;
  title: string;
  content: string;
  proof?: string;
  category: Category;
  createdAt: Date;
  upvotes: number;
  replyCount: number;
  status?: string;
  rejectionFeedback?: string;
  timeline?: Array<{ id: string; eventType: string; eventMessage: string; createdAt: Date }>;
}

interface ProfileReply {
  id: string;
  topicId: string;
  topicTitle: string;
  content: string;
  createdAt: Date;
  upvotes: number;
  replyCount: number;
}

interface EditProfileFormState {
  name: string;
  phoneNumber: string;
  bio: string;
  department: string;
  officeAddress: string;
  officeHours: string;
  interestsInput: string;
  academicInterestsInput: string;
  notificationPreferences: NotificationPreferences;
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams<{ userId: string }>();
  const { currentUser, updateUserProfile, startConversation } = useApp();

  const [viewedUser, setViewedUser] = useState<User | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [profileTopics, setProfileTopics] = useState<ProfileTopic[]>([]);
  const [profileReplies, setProfileReplies] = useState<ProfileReply[]>([]);
  const [upvotesGiven, setUpvotesGiven] = useState(0);
  const [editForm, setEditForm] = useState<EditProfileFormState>({
    name: '',
    phoneNumber: '',
    bio: '',
    department: '',
    officeAddress: '',
    officeHours: '',
    interestsInput: '',
    academicInterestsInput: '',
    notificationPreferences: defaultNotificationPreferences(),
  });

  const displayUser = userId ? viewedUser : currentUser;
  const isOwnProfile = !userId || userId === currentUser?.id;

  useEffect(() => {
    if (!currentUser) return;

    if (!userId || String(userId) === String(currentUser.id)) {
      setViewedUser(mergeUserWithStoredMeta(currentUser));
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);

    fetch('http://localhost:8000/api/users/')
      .then(res => res.json())
      .then(data => {
        const matchedUser = (Array.isArray(data) ? data : []).find(
          (user: any) => String(user.id ?? user.USER_ID) === String(userId)
        );

        if (!matchedUser) {
          setViewedUser(null);
          return;
        }

        setViewedUser(mergeUserWithStoredMeta({
          id: String(matchedUser.id ?? matchedUser.USER_ID),
          firstName: matchedUser.firstName ?? matchedUser.FIRST_NAME,
          lastName: matchedUser.lastName ?? matchedUser.LAST_NAME,
          name: matchedUser.name ?? `${matchedUser.firstName ?? matchedUser.FIRST_NAME} ${matchedUser.lastName ?? matchedUser.LAST_NAME}`.trim(),
          email: matchedUser.email ?? matchedUser.EMAIL,
          role: matchedUser.role ?? matchedUser.ROLE,
          phoneNumber: matchedUser.phoneNumber ?? (matchedUser.CONTACT_INFO || ''),
          bio: matchedUser.bio,
          department: matchedUser.department,
          officeAddress: matchedUser.officeAddress,
          officeHours: matchedUser.officeHours,
          interests: matchedUser.interests,
          academicInterests: matchedUser.academicInterests,
          notificationPreferences: matchedUser.notificationPreferences,
          verifiedRole: matchedUser.verifiedRole,
          verifiedDepartment: matchedUser.verifiedDepartment,
          followedTopics: [],
        }));
      })
      .catch(error => {
        console.error(error);
        setViewedUser(null);
      })
      .finally(() => {
        setIsProfileLoading(false);
      });
  }, [currentUser, userId]);

  useEffect(() => {
    if (!isOwnProfile || !currentUser) return;

    const loadProfileActivity = async () => {
      try {
        const [topicsRes, repliesRes, notificationsRes, engagementRes, timelineRes] = await Promise.all([
          fetch(`http://localhost:8000/api/user-topics/${currentUser.id}/`),
          fetch(`http://localhost:8000/api/user-replies/${currentUser.id}/`),
          fetch(`http://localhost:8000/api/notifications/${currentUser.id}/`),
          fetch(`http://localhost:8000/api/user-engagement-summary/${currentUser.id}/`),
          fetch(`http://localhost:8000/api/topic-request-timelines/${currentUser.id}/`),
        ]);

        const [topicsData, repliesData, notificationsData, engagementData, timelineData] = await Promise.all([
          topicsRes.ok ? topicsRes.json() : Promise.resolve([]),
          repliesRes.ok ? repliesRes.json() : Promise.resolve([]),
          notificationsRes.ok ? notificationsRes.json() : Promise.resolve([]),
          engagementRes.ok ? engagementRes.json() : Promise.resolve({ upvotesGiven: 0 }),
          timelineRes.ok ? timelineRes.json() : Promise.resolve([]),
        ]);

        const timelineByTopicId = new Map<string, Array<{ id: string; eventType: string; eventMessage: string; createdAt: Date }>>();
        (Array.isArray(timelineData) ? timelineData : []).forEach((item: any) => {
          const topicId = String(item.TOPIC_ID);
          const existing = timelineByTopicId.get(topicId) || [];
          existing.push({
            id: String(item.TIMELINE_ID),
            eventType: item.EVENT_TYPE,
            eventMessage: item.EVENT_MESSAGE,
            createdAt: new Date(item.CREATED_AT),
          });
          timelineByTopicId.set(topicId, existing);
        });

        const rejectionFeedbackByTopicId = new Map<string, string>();
        const moreInfoFeedbackByTopicId = new Map<string, string>();
        (Array.isArray(notificationsData) ? notificationsData : []).forEach((notification: any) => {
          if (notification.type === 'topic_request_rejected' && notification.relatedId) {
            rejectionFeedbackByTopicId.set(String(notification.relatedId), notification.message);
          }
          if (notification.type === 'topic_request_more_info' && notification.relatedId) {
            moreInfoFeedbackByTopicId.set(String(notification.relatedId), notification.message);
          }
        });

        setProfileTopics(
          (Array.isArray(topicsData) ? topicsData : []).map((topic: any) => ({
            id: String(topic.TOPIC_ID),
            title: topic.TITLE,
            content: topic.DESCRIPTION || '',
            proof: topic.PROOF_TEXT || '',
            category: categoryNameToSlug[topic.CATEGORY_NAME] || 'campus-events-general',
            createdAt: new Date(topic.CREATED_AT),
            upvotes: Number(topic.TOPIC_UPVOTES || 0),
            replyCount: Number(topic.REPLY_COUNT || 0),
            status: topic.STATUS,
            rejectionFeedback:
              rejectionFeedbackByTopicId.get(String(topic.TOPIC_ID)) ||
              moreInfoFeedbackByTopicId.get(String(topic.TOPIC_ID)) ||
              topic.ADMIN_FEEDBACK,
            timeline: timelineByTopicId.get(String(topic.TOPIC_ID)) || [],
          }))
        );

        setProfileReplies(
          (Array.isArray(repliesData) ? repliesData : []).map((reply: any) => ({
            id: String(reply.POST_ID),
            topicId: String(reply.TOPIC_ID),
            topicTitle: reply.TOPIC_TITLE,
            content: reply.CONTENT,
            createdAt: new Date(reply.CREATED_AT),
            upvotes: Number(reply.UPVOTES || 0),
            replyCount: Number(reply.REPLY_COUNT || 0),
          }))
        );

        setUpvotesGiven(Number(engagementData.upvotesGiven || 0));
        if (!topicsRes.ok || !repliesRes.ok || !notificationsRes.ok || !engagementRes.ok || !timelineRes.ok) {
          console.warn('Partial profile activity load failure', {
            topics: topicsRes.status,
            replies: repliesRes.status,
            notifications: notificationsRes.status,
            engagement: engagementRes.status,
            timeline: timelineRes.status,
          });
        }
      } catch (error) {
        console.error(error);
        toast.error('Could not load your profile activity');
      }
    };

    loadProfileActivity();

    const handleFocus = () => {
      loadProfileActivity();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isOwnProfile, currentUser, location.pathname]);

  useEffect(() => {
    if (!displayUser) return;

    setEditForm({
      name: displayUser.name || '',
      phoneNumber: displayUser.phoneNumber || '',
      bio: displayUser.bio || '',
      department: displayUser.department || '',
      officeAddress: displayUser.officeAddress || '',
      officeHours: displayUser.officeHours || '',
      interestsInput: (displayUser.interests || []).join(', '),
      academicInterestsInput: (displayUser.academicInterests || []).join(', '),
      notificationPreferences: displayUser.notificationPreferences || defaultNotificationPreferences(),
    });
  }, [displayUser]);

  const userStats = useMemo(() => {
    if (!displayUser) return null;

    const recentContributions = [...profileTopics, ...profileReplies].filter((item) => {
      return Date.now() - item.createdAt.getTime() <= 1000 * 60 * 60 * 24 * 30;
    }).length;
    const totalContributions = profileTopics.length + profileReplies.length;
    const contributionScore = profileTopics.length * 8 + profileReplies.length * 4 + upvotesGiven * 2;
    const activityScore = Math.min(100, recentContributions * 12 + Math.min(upvotesGiven, 10) * 2);

    return {
      userTopics: profileTopics,
      userReplies: profileReplies,
      totalUpvotes: upvotesGiven,
      contributionScore,
      activityScore,
      totalContributions,
    };
  }, [displayUser, profileTopics, profileReplies, upvotesGiven]);

  if (!currentUser) {
    navigate('/');
    return null;
  }

  if (isProfileLoading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-sm text-gray-500">
          Loading profile...
        </div>
      </div>
    );
  }

  if (!displayUser || !userStats) {
    navigate('/');
    return null;
  }

  const persistProfile = async (nextUser: User) => {
    const res = await fetch('http://localhost:8000/api/update-user-profile/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: nextUser.id,
        firstName: nextUser.firstName,
        lastName: nextUser.lastName,
        phoneNumber: nextUser.phoneNumber,
        bio: nextUser.bio,
        department: nextUser.department,
        verifiedRole: nextUser.verifiedRole,
        verifiedDepartment: nextUser.verifiedDepartment,
        officeAddress: nextUser.officeAddress,
        officeHours: nextUser.officeHours,
        interests: nextUser.interests,
        academicInterests: nextUser.academicInterests,
        notificationPreferences: nextUser.notificationPreferences,
      }),
    });

    const data = await res.json();
    if (!data.success || !data.user) {
      throw new Error(data.message || 'Could not save profile');
    }

    return mergeUserWithStoredMeta(data.user);
  };

  const handleMessageUser = () => {
    startConversation(displayUser.id);
    navigate('/messages');
  };

  const handleEditChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePreferenceToggle = (key: keyof Omit<NotificationPreferences, 'digestFrequency'>) => {
    setEditForm(prev => ({
      ...prev,
      notificationPreferences: {
        ...prev.notificationPreferences,
        [key]: !prev.notificationPreferences[key],
      },
    }));
  };

  const handleDigestFrequencyChange = (digestFrequency: NotificationPreferences['digestFrequency']) => {
    setEditForm(prev => ({
      ...prev,
      notificationPreferences: {
        ...prev.notificationPreferences,
        digestFrequency,
      },
    }));
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const [firstName = '', ...rest] = editForm.name.trim().split(' ');
    const nextUser: User = {
      ...displayUser,
      firstName: firstName || displayUser.firstName,
      lastName: rest.join(' ') || displayUser.lastName,
      name: editForm.name.trim() || displayUser.name,
      phoneNumber: editForm.phoneNumber.trim(),
      bio: editForm.bio.trim(),
      department: editForm.department.trim(),
      verifiedRole: true,
      verifiedDepartment: Boolean(editForm.department.trim()),
      officeAddress: editForm.officeAddress.trim(),
      officeHours: editForm.officeHours.trim(),
      interests: parseCategoryList(editForm.interestsInput),
      academicInterests: parseTagList(editForm.academicInterestsInput),
      notificationPreferences: editForm.notificationPreferences,
    };

    try {
      const savedUser = await persistProfile(nextUser);
      await updateUserProfile(savedUser);
      if (isOwnProfile) {
        setViewedUser(savedUser);
      }
      toast.success('Profile updated successfully');
      setIsEditOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update profile. Please try again.');
    }
  };

  const quickSaveNotificationPreferences = (updates: Partial<NotificationPreferences>) => {
    const nextUser: User = {
      ...displayUser,
      notificationPreferences: {
        ...(displayUser.notificationPreferences || defaultNotificationPreferences()),
        ...updates,
      },
    };

    persistProfile(nextUser)
      .then((savedUser) => {
        updateUserProfile(savedUser);
        setViewedUser(savedUser);
        toast.success('Notification preferences updated');
      })
      .catch((error) => {
        console.error(error);
        toast.error('Could not update notification preferences');
      });
  };

  const detailCards = [
    { label: 'Topics', value: userStats.userTopics.length, icon: FileText, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Replies', value: userStats.userReplies.length, icon: MessageSquare, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Contribution Score', value: userStats.contributionScore, icon: Sparkles, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Activity Score', value: `${userStats.activityScore}%`, icon: TrendingUp, tone: 'bg-violet-50 text-violet-700' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <button
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        <span>Return to Discussion Feed</span>
      </button>

      <section className="university-panel p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-900 text-2xl font-bold text-white shadow-sm">
            {getInitials(displayUser.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">University Profile</p>
            <h1 className="mt-3 university-section-title">{displayUser.name}</h1>
            <p className="mt-2 text-sm text-slate-600">{displayUser.email}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 font-medium ${getRoleBadgeColor(displayUser.role)}`}>
                {displayUser.role.charAt(0).toUpperCase() + displayUser.role.slice(1)}
              </span>
              {displayUser.verifiedRole && (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  <ShieldCheck size={14} />
                  Verified role
                </span>
              )}
              {displayUser.department && (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  <BadgeCheck size={14} />
                  {displayUser.department}
                  {displayUser.verifiedDepartment ? ' verified' : ''}
                </span>
              )}
            </div>
            {displayUser.bio && (
              <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600">{displayUser.bio}</p>
            )}
            {displayUser.role === 'faculty' && (displayUser.officeAddress || displayUser.officeHours) && (
              <div className="mt-4 space-y-1 text-sm text-slate-600">
                {displayUser.officeAddress && (
                  <p><span className="font-medium text-slate-700">Office:</span> {displayUser.officeAddress}</p>
                )}
                {displayUser.officeHours && (
                  <p><span className="font-medium text-slate-700">Available:</span> {displayUser.officeHours}</p>
                )}
              </div>
            )}
            {displayUser.interests && displayUser.interests.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-slate-700">Interests</p>
                <div className="flex flex-wrap gap-2">
                  {displayUser.interests.map(interest => (
                    <CategoryTag key={interest} category={interest} size="sm" />
                  ))}
                </div>
              </div>
            )}
            {displayUser.academicInterests && displayUser.academicInterests.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-slate-700">Academic focus</p>
                <div className="flex flex-wrap gap-2">
                  {displayUser.academicInterests.map((interest) => (
                    <span key={interest} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            {isOwnProfile ? (
              <button
                onClick={() => setIsEditOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Edit2 size={16} />
                Edit Profile
              </button>
            ) : (
              <button
                onClick={handleMessageUser}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <Mail size={16} />
                Send Message
              </button>
            )}
          </div>
        </div>

        {isOwnProfile && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {detailCards.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${tone}`}><Icon size={18} /></div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {isOwnProfile && (
        <section className="university-panel mt-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Notification Preferences</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Fine-tune which updates appear in your notification center and how often your notification summary is framed.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Digest</p>
              <p className="mt-1 text-sm font-semibold capitalize text-slate-900">
                {(displayUser.notificationPreferences?.digestFrequency || 'daily').replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { key: 'approvals', label: 'Approvals & requests' },
              { key: 'replies', label: 'Replies & discussion' },
              { key: 'classActivity', label: 'Class activity' },
              { key: 'moderation', label: 'Moderation notices' },
            ].map((item) => {
              const enabled = Boolean(displayUser.notificationPreferences?.[item.key as keyof Omit<NotificationPreferences, 'digestFrequency'>]);
              return (
                <button
                  key={item.key}
                  onClick={() => quickSaveNotificationPreferences({ [item.key]: !enabled } as Partial<NotificationPreferences>)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    enabled ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${enabled ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {enabled ? 'On' : 'Off'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {(['instant', 'daily', 'weekly'] as const).map((frequency) => (
              <button
                key={frequency}
                onClick={() => quickSaveNotificationPreferences({ digestFrequency: frequency })}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  (displayUser.notificationPreferences?.digestFrequency || 'daily') === frequency
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {frequency.charAt(0).toUpperCase() + frequency.slice(1)} summary
              </button>
            ))}
            <button
              onClick={() => quickSaveNotificationPreferences({
                emailStyleSummary: !displayUser.notificationPreferences?.emailStyleSummary,
              })}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                displayUser.notificationPreferences?.emailStyleSummary !== false
                  ? 'bg-amber-100 text-amber-800'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Bell size={14} />
                {displayUser.notificationPreferences?.emailStyleSummary !== false ? 'Summary card on' : 'Summary card off'}
              </span>
            </button>
          </div>
        </section>
      )}

      {isOwnProfile && userStats.userTopics.length > 0 && (
        <section className="university-panel mt-6 p-6">
          <h2 className="text-2xl font-semibold text-slate-900">My Topics</h2>
          <div className="space-y-3">
            {userStats.userTopics.map(topic => (
              <div
                key={topic.id}
                onClick={() => topic.status === 'approved' && navigate(`/topic/${topic.id}`)}
                className={`mt-4 rounded-2xl border border-slate-200 p-5 transition-colors ${
                  topic.status === 'approved' ? 'cursor-pointer bg-white hover:bg-slate-50' : 'bg-white'
                }`}
              >
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-2">
                    <CategoryTag category={topic.category} size="sm" />
                    <span className={`rounded-2xl px-3 py-1 text-sm font-semibold ${
                      topic.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : topic.status === 'needs_more_info'
                        ? 'bg-amber-100 text-amber-700'
                        : topic.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {(topic.status || 'pending').charAt(0).toUpperCase() + (topic.status || 'pending').slice(1)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{topic.createdAt.toLocaleDateString()}</span>
                </div>
                <h3 className="mb-2 font-semibold text-slate-900">{topic.title}</h3>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{topic.upvotes} upvotes</span>
                  <span>•</span>
                  <span>{topic.replyCount} replies</span>
                </div>
                {topic.status === 'needs_more_info' && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div>
                      <p className="mb-1 text-sm font-semibold text-amber-800">More information requested</p>
                      <p className="text-sm text-amber-700">{topic.rejectionFeedback || 'An administrator requested more supporting information for this topic.'}</p>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate('/submit-request', {
                          state: {
                            editRequest: {
                              id: topic.id,
                              title: topic.title,
                              content: topic.content,
                              category: topic.category,
                              proof: topic.proof,
                            }
                          }
                        });
                      }}
                      className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                    >
                      Update & Resubmit
                    </button>
                  </div>
                )}
                {topic.status === 'rejected' && topic.rejectionFeedback && (
                  <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p className="mb-1 text-sm font-semibold text-red-800">Rejection Reason</p>
                    <p className="text-sm text-red-700">{topic.rejectionFeedback}</p>
                  </div>
                )}
                {topic.timeline && topic.timeline.length > 0 && (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-sm font-semibold text-slate-900">Request Timeline</p>
                    <div className="mt-3 space-y-3">
                      {topic.timeline.map((item) => (
                        <div key={item.id} className="flex gap-3 text-sm">
                          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                          <div>
                            <p className="font-medium text-slate-800">{item.eventMessage}</p>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{item.createdAt.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {isOwnProfile && userStats.userReplies.length > 0 && (
        <section className="university-panel mt-6 p-6">
          <h2 className="text-2xl font-semibold text-slate-900">Recent Replies</h2>
          <div className="space-y-3">
            {userStats.userReplies.slice(0, 10).map(reply => (
              <div
                key={reply.id}
                onClick={() => navigate(`/topic/${reply.topicId}`)}
                className="mt-4 cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:bg-slate-50"
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">
                    Reply to: <span className="font-medium text-slate-700">{reply.topicTitle}</span>
                  </span>
                  <span className="text-xs text-slate-500">{reply.createdAt.toLocaleDateString()}</span>
                </div>
                <p className="line-clamp-2 text-sm text-slate-700">{reply.content}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <span>{reply.upvotes} upvotes</span>
                  <span>•</span>
                  <span>{reply.replyCount} {reply.replyCount === 1 ? 'reply' : 'replies'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:max-w-[700px]">
          <DialogHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Profile Settings</p>
            <DialogTitle className="mt-2 text-2xl font-semibold text-slate-900">Edit Profile</DialogTitle>
            <p className="text-sm leading-7 text-slate-600">
                      Update your public details, academic focus, and notification preferences so your profile feels complete and professional.
            </p>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="bg-white px-6 py-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-900">Name</label>
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-900">Bio</label>
                <textarea
                  name="bio"
                  value={editForm.bio}
                  onChange={handleEditChange}
                  rows={4}
                  placeholder="Tell your campus community what you focus on and how you contribute."
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2 block text-sm font-semibold text-slate-900">Phone Number</label>
                <input
                  type="text"
                  name="phoneNumber"
                  value={editForm.phoneNumber}
                  onChange={handleEditChange}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2 block text-sm font-semibold text-slate-900">Department</label>
                <input
                  type="text"
                  name="department"
                  value={editForm.department}
                  onChange={handleEditChange}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {currentUser.role === 'faculty' && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <label className="mb-2 block text-sm font-semibold text-slate-900">Office Address</label>
                  <input
                    type="text"
                    name="officeAddress"
                    value={editForm.officeAddress}
                    onChange={handleEditChange}
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <label className="mb-2 block text-sm font-semibold text-slate-900">Available Timing</label>
                  <input
                    type="text"
                    name="officeHours"
                    value={editForm.officeHours}
                    onChange={handleEditChange}
                    placeholder="e.g. Mon/Wed 2:00 PM - 4:00 PM"
                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2 block text-sm font-semibold text-slate-900">Category interests</label>
                <textarea
                  name="interestsInput"
                  value={editForm.interestsInput}
                  onChange={handleEditChange}
                  rows={3}
                  placeholder="Comma-separated category slugs, for example academics-datascience, research-stem"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-2 block text-sm font-semibold text-slate-900">Academic focus tags</label>
                <textarea
                  name="academicInterestsInput"
                  value={editForm.academicInterestsInput}
                  onChange={handleEditChange}
                  rows={3}
                  placeholder="Comma-separated topics, for example Machine Learning, Public Policy"
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-500" />
                <p className="text-sm font-semibold text-slate-900">Notification delivery</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(['instant', 'daily', 'weekly'] as const).map((frequency) => (
                  <button
                    type="button"
                    key={frequency}
                    onClick={() => handleDigestFrequencyChange(frequency)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      editForm.notificationPreferences.digestFrequency === frequency
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {frequency}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { key: 'approvals', label: 'Approvals & requests' },
                  { key: 'replies', label: 'Replies & discussion' },
                  { key: 'classActivity', label: 'Class activity' },
                  { key: 'moderation', label: 'Moderation notices' },
                  { key: 'emailStyleSummary', label: 'Notification summary card' },
                ].map((item) => {
                  const key = item.key as keyof Omit<NotificationPreferences, 'digestFrequency'>;
                  const enabled = Boolean(editForm.notificationPreferences[key]);
                  return (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => handlePreferenceToggle(key)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                        enabled ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
