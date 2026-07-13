import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, MessageCircle, Pin, GraduationCap, Users, Send, UserX, LogOut, Calendar, Clock, MapPin, Trash2, BookOpen, Upload, ExternalLink, FileText, Paperclip } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { PopupDialog } from '../components/PopupDialog.tsx';
import { getRoleBadgeColor } from '../utils/helpers.ts';
import type { Class, ClassDiscussion, ClassDiscussionReply, ClassResource } from '../types';

const API_BASE = 'http://localhost:8000/api';

type EnrolledStudent = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const mapClass = (item: any): Class => ({
  id: String(item.id),
  code: item.code,
  name: item.name,
  department: item.department || 'General',
  instructorId: String(item.instructorId),
  instructorName: item.instructorName,
  semester: item.semester || 'Spring 2026',
  deliveryMode: item.deliveryMode || 'offline',
  description: item.description || '',
  enrolledStudents: Array.isArray(item.enrolledStudents) ? item.enrolledStudents : [],
  createdAt: new Date(item.createdAt),
  discussionCount: Number(item.discussionCount || 0),
  enrolledCount: Number(item.enrolledCount ?? item.enrolledStudents?.length ?? 0),
  isEnrolled: Boolean(item.isEnrolled),
  hasPendingRequest: Boolean(item.hasPendingRequest),
  days: Array.isArray(item.days) ? item.days : ['To Be Announced'],
  time: item.time || 'To Be Announced',
  location: item.location || '',
});

const mapDiscussion = (item: any): ClassDiscussion => ({
  id: String(item.id),
  classId: String(item.classId),
  title: item.title,
  content: item.content,
  authorId: String(item.authorId),
  authorName: item.authorName,
  authorRole: item.authorRole,
  createdAt: new Date(item.createdAt),
  upvotes: Number(item.upvotes || 0),
  replyCount: Number(item.replyCount || 0),
  upvotedBy: Array.isArray(item.upvotedBy) ? item.upvotedBy.map(String) : [],
  isPinned: Boolean(item.isPinned),
});

const mapReply = (item: any): ClassDiscussionReply => ({
  id: String(item.id),
  discussionId: String(item.discussionId),
  classId: String(item.classId),
  content: item.content,
  authorId: String(item.authorId),
  authorName: item.authorName,
  authorRole: item.authorRole,
  createdAt: new Date(item.createdAt),
  upvotes: Number(item.upvotes || 0),
  parentReplyId: item.parentReplyId ? String(item.parentReplyId) : undefined,
  upvotedBy: Array.isArray(item.upvotedBy) ? item.upvotedBy.map(String) : [],
});

const mapResource = (item: any): ClassResource => ({
  id: String(item.id),
  classId: String(item.classId),
  title: item.title,
  description: item.description || '',
  resourceType: item.resourceType || 'material',
  resourceUrl: item.resourceUrl || '',
  fileUrl: item.fileUrl || '',
  isPinned: Boolean(item.isPinned),
  createdBy: String(item.createdBy),
  createdByName: item.createdByName || 'Class staff',
  createdAt: new Date(item.createdAt),
});

const formatDiscussionDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

const getResourceTypeLabel = (resourceType: ClassResource['resourceType']) => {
  switch (resourceType) {
    case 'syllabus':
      return 'Syllabus';
    case 'assignment':
      return 'Assignment';
    case 'link':
      return 'Link';
    default:
      return 'Material';
  }
};

const resolveResourceHref = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `http://localhost:8000${url.startsWith('/') ? url : `/${url}`}`;
};

export const ClassDetailPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useApp();

  const [classItem, setClassItem] = useState<Class | null>(null);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [classDiscussions, setClassDiscussions] = useState<ClassDiscussion[]>([]);
  const [classDiscussionReplies, setClassDiscussionReplies] = useState<ClassDiscussionReply[]>([]);
  const [classResources, setClassResources] = useState<ClassResource[]>([]);
  const [newDiscussionTitle, setNewDiscussionTitle] = useState('');
  const [newDiscussionContent, setNewDiscussionContent] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceType, setResourceType] = useState<ClassResource['resourceType']>('material');
  const [resourceLink, setResourceLink] = useState('');
  const [resourcePinned, setResourcePinned] = useState(false);
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showNewDiscussionForm, setShowNewDiscussionForm] = useState(false);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [showStudentList, setShowStudentList] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [popupMessage, setPopupMessage] = useState('');

  const loadClassDetail = useCallback(async () => {
    if (!currentUser || !classId) return;

    const res = await fetch(`${API_BASE}/classes/${classId}/?user_id=${currentUser.id}`);
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || 'Could not load class');
    }

    setClassItem(mapClass(data.class));
  }, [currentUser, classId]);

  const loadStudents = useCallback(async () => {
    if (!classId) return;

    const res = await fetch(`${API_BASE}/class-students/${classId}/`);
    const data = await res.json();
    setStudents(Array.isArray(data) ? data : []);
  }, [classId]);

  const loadConversations = useCallback(async () => {
    if (!currentUser || !classId) return;

    const res = await fetch(`${API_BASE}/class-conversations/${classId}/?user_id=${currentUser.id}`);
    const data = await res.json();
    setClassDiscussions(Array.isArray(data.discussions) ? data.discussions.map(mapDiscussion) : []);
    setClassDiscussionReplies(Array.isArray(data.replies) ? data.replies.map(mapReply) : []);
  }, [currentUser, classId]);

  const loadResources = useCallback(async () => {
    if (!classId) return;

    const res = await fetch(`${API_BASE}/class-resources/${classId}/`);
    const data = await res.json();
    setClassResources(Array.isArray(data) ? data.map(mapResource) : []);
  }, [classId]);

  const refreshClassPage = useCallback(async () => {
    await Promise.all([loadClassDetail(), loadStudents(), loadConversations(), loadResources()]);
  }, [loadClassDetail, loadStudents, loadConversations, loadResources]);

  useEffect(() => {
    if (!currentUser || !classId) {
      navigate('/classes');
      return;
    }

    refreshClassPage().catch((error) => {
      console.error('LOAD CLASS DETAIL ERROR:', error);
      navigate('/classes');
    });
  }, [currentUser, classId, navigate, refreshClassPage]);

  const isInstructor = classItem?.instructorId === String(currentUser?.id);
  const canManageResources = Boolean(isInstructor || currentUser?.role === 'admin');
  const isEnrolled = Boolean(classItem && (isInstructor || classItem.isEnrolled));

  const discussions = useMemo(() => (
    [...classDiscussions].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
  ), [classDiscussions]);

  const resources = useMemo(() => (
    [...classResources].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
  ), [classResources]);

  const getRepliesForDiscussion = (discussionId: string): ClassDiscussionReply[] => (
    classDiscussionReplies
      .filter(r => r.discussionId === discussionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  );

  const showWarning = (message: string) => {
    setPopupMessage(message);
  };

  const handleCreateDiscussion = async () => {
    if (!currentUser || !classItem) return;

    if (!newDiscussionTitle.trim()) {
      showWarning('Topic title field should be filled');
      return;
    }

    if (!newDiscussionContent.trim()) {
      showWarning('Topic content field should be filled');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/create-class-discussion/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: classItem.id,
          user_id: currentUser.id,
          title: newDiscussionTitle.trim(),
          content: newDiscussionContent.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Could not create class topic.');
        return;
      }

      setNewDiscussionTitle('');
      setNewDiscussionContent('');
      setShowNewDiscussionForm(false);
      setStatusMessage('Class topic posted.');
      await refreshClassPage();
    } catch (error) {
      console.error('CREATE CLASS DISCUSSION ERROR:', error);
      setErrorMessage('Could not create class topic.');
    }
  };

  const handleReply = async (discussionId: string) => {
    if (!currentUser || !classItem || !replyContent.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/create-class-discussion-reply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: classItem.id,
          discussion_id: discussionId,
          user_id: currentUser.id,
          content: replyContent.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Could not post reply.');
        return;
      }

      setReplyContent('');
      setReplyingTo(null);
      setStatusMessage('Reply posted.');
      await refreshClassPage();
    } catch (error) {
      console.error('CREATE CLASS REPLY ERROR:', error);
      setErrorMessage('Could not post reply.');
    }
  };

  const handleUpvoteDiscussion = async (discussionId: string) => {
    if (!currentUser) return;

    try {
      await fetch(`${API_BASE}/upvote-class-discussion/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discussion_id: discussionId,
          user_id: currentUser.id,
        }),
      });
      await loadConversations();
    } catch (error) {
      console.error('UPVOTE CLASS DISCUSSION ERROR:', error);
    }
  };

  const handleUpvoteReply = async (replyId: string) => {
    if (!currentUser) return;

    try {
      await fetch(`${API_BASE}/upvote-class-discussion-reply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply_id: replyId,
          user_id: currentUser.id,
        }),
      });
      await loadConversations();
    } catch (error) {
      console.error('UPVOTE CLASS REPLY ERROR:', error);
    }
  };

  const handleUploadResource = async () => {
    if (!currentUser || !classItem || !canManageResources) return;

    if (!resourceTitle.trim()) {
      showWarning('Resource title field should be filled');
      return;
    }

    if (!resourceFile && !resourceLink.trim()) {
      showWarning('Add a file or link for this class resource');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('class_id', classItem.id);
      formData.append('user_id', currentUser.id);
      formData.append('title', resourceTitle.trim());
      formData.append('description', resourceDescription.trim());
      formData.append('resource_type', resourceType);
      formData.append('resource_url', resourceLink.trim());
      formData.append('is_pinned', String(resourcePinned));
      if (resourceFile) {
        formData.append('file', resourceFile);
      }

      const res = await fetch(`${API_BASE}/upload-class-resource/`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Could not upload class resource.');
        return;
      }

      setResourceTitle('');
      setResourceDescription('');
      setResourceType('material');
      setResourceLink('');
      setResourcePinned(false);
      setResourceFile(null);
      setShowResourceForm(false);
      setStatusMessage('Class resource uploaded.');
      await loadResources();
    } catch (error) {
      console.error('UPLOAD CLASS RESOURCE ERROR:', error);
      setErrorMessage('Could not upload class resource.');
    }
  };

  const handleTogglePin = async (discussionId: string) => {
    if (!currentUser) return;

    try {
      const res = await fetch(`${API_BASE}/toggle-pin-class-discussion/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discussion_id: discussionId,
          user_id: currentUser.id,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Could not pin class topic.');
        return;
      }

      await loadConversations();
    } catch (error) {
      console.error('TOGGLE PIN CLASS DISCUSSION ERROR:', error);
      setErrorMessage('Could not pin class topic.');
    }
  };

  const handleLeaveClass = async () => {
    if (!currentUser || !classItem) return;
    if (!window.confirm('Are you sure you want to leave this class? You will need to request to join again.')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/leave-class/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: classItem.id,
          user_id: currentUser.id,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Could not leave class.');
        return;
      }

      navigate('/classes');
    } catch (error) {
      console.error('LEAVE CLASS ERROR:', error);
      setErrorMessage('Could not leave class.');
    }
  };

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!currentUser || !classItem) return;
    if (!window.confirm(`Are you sure you want to remove ${studentName} from this class?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/remove-student-from-class/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: classItem.id,
          student_id: studentId,
          user_id: currentUser.id,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Could not remove student.');
        return;
      }

      setStatusMessage('Student removed from class.');
      await Promise.all([loadStudents(), loadClassDetail()]);
    } catch (error) {
      console.error('REMOVE STUDENT ERROR:', error);
      setErrorMessage('Could not remove student.');
    }
  };

  const handleDeleteDiscussion = async (discussionId: string) => {
    if (!currentUser) return;
    if (!window.confirm('Are you sure you want to delete this class topic and all its replies?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/delete-class-discussion/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discussion_id: discussionId,
          user_id: currentUser.id,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Could not delete class topic.');
        return;
      }

      setStatusMessage('Class topic deleted.');
      await refreshClassPage();
    } catch (error) {
      console.error('DELETE CLASS DISCUSSION ERROR:', error);
      setErrorMessage('Could not delete class topic.');
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!currentUser) return;
    if (!window.confirm('Are you sure you want to delete this class comment?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/delete-class-discussion-reply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply_id: replyId,
          user_id: currentUser.id,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Could not delete class comment.');
        return;
      }

      setStatusMessage('Class comment deleted.');
      await refreshClassPage();
    } catch (error) {
      console.error('DELETE CLASS REPLY ERROR:', error);
      setErrorMessage('Could not delete class comment.');
    }
  };

  if (!currentUser || !classId || !classItem || !isEnrolled) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <button
          onClick={() => navigate('/classes')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
        >
          <ArrowLeft size={18} />
          <span>Back to Classes</span>
        </button>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {statusMessage && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {statusMessage}
          </div>
        )}

        <section className="university-panel mb-8 overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eff6ff_100%)] px-8 py-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between mb-4">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">{classItem.code}</p>
              <h1 className="mb-4 font-serif text-4xl font-semibold leading-tight text-slate-900">{classItem.name}</h1>
              <p className="mb-6 max-w-4xl text-[17px] leading-8 text-slate-600">{classItem.description}</p>

              <div className="space-y-3 mb-6">
                {classItem.deliveryMode && (
                  <div className="flex items-center gap-3 text-[16px] text-slate-600">
                    <BookOpen size={18} className="text-slate-400" />
                    <span className="capitalize">{classItem.deliveryMode}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-[16px] text-slate-600">
                  <Calendar size={18} className="text-slate-400" />
                  <span>{classItem.days.join(', ')}</span>
                </div>
                <div className="flex items-center gap-3 text-[16px] text-slate-600">
                  <Clock size={18} className="text-slate-400" />
                  <span>{classItem.time}</span>
                </div>
                {classItem.location && (
                  <div className="flex items-center gap-3 text-[16px] text-slate-600">
                    <MapPin size={18} className="text-slate-400" />
                    <span>{classItem.location}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[16px] text-slate-500">
                <div className="flex items-center gap-2">
                  <GraduationCap size={16} />
                  <span>{classItem.instructorName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={16} />
                  <span>{classItem.enrolledCount ?? students.length} students</span>
                </div>
                <span>{classItem.semester}</span>
                <span>{classItem.department}</span>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {!showNewDiscussionForm && (
                  <button
                    onClick={() => setShowNewDiscussionForm(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    <MessageCircle size={18} />
                    Start New Discussion
                  </button>
                )}
                {canManageResources && !showResourceForm && (
                  <button
                    onClick={() => setShowResourceForm(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Upload size={18} />
                    Upload Resource
                  </button>
                )}
              </div>
            </div>
            {isInstructor && (
              <button
                onClick={() => setShowStudentList(!showStudentList)}
                className="flex min-w-[176px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-slate-800"
              >
                <Users size={18} />
                Manage Students
              </button>
            )}
          </div>
          </div>

          {showNewDiscussionForm && (
            <div className="border-t border-slate-200 bg-white px-8 py-6">
            <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_6px_24px_rgba(15,23,42,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Start Discussion</p>
              <h3 className="mb-3 mt-2 text-lg font-semibold text-slate-900">New Class Topic</h3>
              <input
                type="text"
                placeholder="Topic Title"
                value={newDiscussionTitle}
                onChange={(e) => setNewDiscussionTitle(e.target.value)}
                className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
              <textarea
                placeholder="Post assignment details, announcements, resources, or discussion points for this class..."
                value={newDiscussionContent}
                onChange={(e) => setNewDiscussionContent(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleCreateDiscussion}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Post Topic
                </button>
                <button
                  onClick={() => {
                    setShowNewDiscussionForm(false);
                    setNewDiscussionTitle('');
                    setNewDiscussionContent('');
                  }}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
            </div>
          )}

          {showResourceForm && canManageResources && (
            <div className="border-t border-slate-200 bg-slate-50/60 px-8 py-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_6px_24px_rgba(15,23,42,0.05)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Class Resources</p>
                <h3 className="mb-3 mt-2 text-lg font-semibold text-slate-900">Upload file, syllabus, or pinned material</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Resource title"
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                  <select
                    value={resourceType}
                    onChange={(e) => setResourceType(e.target.value as ClassResource['resourceType'])}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="material">Pinned Material</option>
                    <option value="syllabus">Syllabus</option>
                    <option value="assignment">Assignment Post</option>
                    <option value="link">File Link</option>
                  </select>
                </div>
                <textarea
                  placeholder="Add short context so students know when to use this resource..."
                  value={resourceDescription}
                  onChange={(e) => setResourceDescription(e.target.value)}
                  rows={3}
                  className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input
                    type="url"
                    placeholder="Optional external link"
                    value={resourceLink}
                    onChange={(e) => setResourceLink(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                  <input
                    type="file"
                    onChange={(e) => setResourceFile(e.target.files?.[0] || null)}
                    className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:border-blue-300"
                  />
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={resourcePinned}
                    onChange={(e) => setResourcePinned(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Pin this resource at the top for the class
                </label>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleUploadResource}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Upload Resource
                  </button>
                  <button
                    onClick={() => {
                      setShowResourceForm(false);
                      setResourceTitle('');
                      setResourceDescription('');
                      setResourceType('material');
                      setResourceLink('');
                      setResourcePinned(false);
                      setResourceFile(null);
                    }}
                    className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {showStudentList && (
          <section className="university-panel mb-8 p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Enrolled Students</h3>
            <div className="space-y-2">
              {students.length === 0 && (
                <p className="text-sm text-slate-500">No approved students in this class yet.</p>
              )}
              {students.map(student => (
                <div key={student.id} className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Users size={16} />
                    <div>
                      <span className="text-gray-900 font-medium">{student.name}</span>
                      <p className="text-xs text-gray-500">{student.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getRoleBadgeColor(student.role as any)}`}>
                      {student.role}
                    </span>
                  </div>
                  {isInstructor && (
                    <button
                      onClick={() => handleRemoveStudent(student.id, student.name)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm"
                    >
                      <UserX size={14} />
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="university-panel mb-8 overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-8 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Class Resources</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Files, syllabus, assignments, and pinned materials</h2>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600">
                {resources.length}
              </div>
            </div>
          </div>

          {resources.length === 0 ? (
            <div className="p-12 text-center">
              <Paperclip className="mx-auto mb-3 text-slate-400" size={48} />
              <p className="font-medium text-slate-600">No class resources yet</p>
              <p className="mt-1 text-sm text-slate-500">Upload the syllabus, assignment sheets, or reference materials so the class has one shared library.</p>
            </div>
          ) : (
            <div className="grid gap-4 p-6 lg:grid-cols-2">
              {resources.map((resource) => (
                <div key={resource.id} className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_6px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {resource.isPinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            <Pin size={12} />
                            Pinned
                          </span>
                        )}
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {getResourceTypeLabel(resource.resourceType)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-slate-900">{resource.title}</h3>
                      <p className="mt-2 text-sm text-slate-500">
                        Added by {resource.createdByName} on {formatDiscussionDate(resource.createdAt)}
                      </p>
                    </div>
                    <FileText className="text-slate-300" size={24} />
                  </div>

                  {resource.description && (
                    <p className="mt-4 text-sm leading-7 text-slate-600">{resource.description}</p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {resource.fileUrl && (
                      <a
                        href={resolveResourceHref(resource.fileUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                      >
                        <Paperclip size={15} />
                        Open File
                      </a>
                    )}
                    {resource.resourceUrl && (
                      <a
                        href={resolveResourceHref(resource.resourceUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <ExternalLink size={15} />
                        Open Link
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="university-panel overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-8 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Class Discussion</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Discussion Board</h2>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600">
                {discussions.length}
              </div>
            </div>
          </div>
          {discussions.length === 0 && (
            <div className="p-12 text-center">
              <MessageCircle className="mx-auto text-slate-400 mb-3" size={48} />
              <p className="text-slate-600 font-medium">No class topics yet</p>
              <p className="text-sm text-slate-500 mt-1">Post assignments, material updates, or class-specific questions here.</p>
            </div>
          )}

          {discussions.map(discussion => {
            const replies = getRepliesForDiscussion(discussion.id);
            const hasUpvoted = discussion.upvotedBy.includes(String(currentUser.id));

            return (
              <div key={discussion.id} className="border-b border-slate-100 px-8 py-8 last:border-b-0">
                {discussion.isPinned && (
                  <div className="flex items-center gap-2 text-blue-600 mb-5 text-sm font-semibold">
                    <Pin size={14} />
                    <span>Pinned by Instructor</span>
                  </div>
                )}

                <div className="flex items-start gap-4 rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_6px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex min-w-[44px] flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white px-1.5 py-2">
                    <button
                      onClick={() => handleUpvoteDiscussion(discussion.id)}
                      className={`rounded-xl p-2 transition-colors ${
                        hasUpvoted ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <ThumbsUp size={16} fill={hasUpvoted ? 'currentColor' : 'none'} />
                    </button>
                    <span className="text-lg leading-none font-semibold text-slate-700">{discussion.upvotes}</span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-semibold text-slate-900 text-[18px]">{discussion.authorName}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${getRoleBadgeColor(discussion.authorRole)}`}>
                        {discussion.authorRole}
                      </span>
                      <span className="text-sm text-slate-500">• {formatDiscussionDate(discussion.createdAt)}</span>
                      {isInstructor && (
                        <div className="ml-auto flex items-center gap-3">
                          <button
                            onClick={() => handleTogglePin(discussion.id)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                          >
                            {discussion.isPinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button
                            onClick={() => handleDeleteDiscussion(discussion.id)}
                            className="text-sm text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                      {!isInstructor && discussion.authorId === String(currentUser.id) && (
                        <button
                          onClick={() => handleDeleteDiscussion(discussion.id)}
                          className="ml-auto text-sm text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      )}
                    </div>

                    <h3 className="mb-3 text-[22px] font-semibold leading-snug text-slate-900">{discussion.title}</h3>
                    <p className="mb-5 whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{discussion.content}</p>

                    {replies.length > 0 && (
                      <div className="mt-5 space-y-3 border-l-2 border-slate-200 pl-5">
                        {replies.map(reply => {
                          const hasUpvotedReply = reply.upvotedBy.includes(String(currentUser.id));

                          return (
                            <div key={reply.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => handleUpvoteReply(reply.id)}
                                  className={`p-1 rounded transition-colors ${
                                    hasUpvotedReply ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  <ThumbsUp size={14} fill={hasUpvotedReply ? 'currentColor' : 'none'} />
                                </button>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm text-slate-900">{reply.authorName}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getRoleBadgeColor(reply.authorRole)}`}>
                                      {reply.authorRole}
                                    </span>
                                    <span className="text-xs text-slate-500">• {formatDiscussionDate(reply.createdAt)}</span>
                                    <span className="text-xs text-slate-500">• {reply.upvotes} upvotes</span>
                                    {(isInstructor || reply.authorId === String(currentUser.id)) && (
                                      <button
                                        onClick={() => handleDeleteReply(reply.id)}
                                        className="ml-auto text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                                      >
                                        <Trash2 size={12} />
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-7">{reply.content}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {replyingTo === discussion.id ? (
                      <div className="mt-4">
                        <textarea
                          placeholder="Write your reply..."
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => handleReply(discussion.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm"
                          >
                            <Send size={14} />
                            Post Reply
                          </button>
                          <button
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyContent('');
                            }}
                            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-gray-50 transition-colors text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReplyingTo(discussion.id)}
                        className="mt-4 flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium"
                      >
                        <MessageCircle size={16} />
                        Reply ({replies.length})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {!isInstructor && (
          <div className="mt-6">
            <button
              onClick={handleLeaveClass}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              <LogOut size={16} />
              Leave Class
            </button>
          </div>
        )}

        <PopupDialog
          isOpen={Boolean(popupMessage)}
          title="Missing Information"
          message={popupMessage}
          onConfirm={() => setPopupMessage('')}
        />
    </div>
  );
};
