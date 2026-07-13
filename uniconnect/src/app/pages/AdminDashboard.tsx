import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Users, FileClock, Activity, Clock3, Flag, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { CategoryTag } from '../components/CategoryTag.tsx';
import { formatTimeAgo, categoryNameToSlug } from '../utils/helpers.ts';
import { AdminActivityLogItem, AdminInsights, AdminTrendPoint, Category, ContentReport } from '../types';
import { toast } from 'sonner';

type TabType = 'requests' | 'topics' | 'reports' | 'activity';

interface TopicRequestItem {
  id: string;
  title: string;
  content: string;
  category: Category;
  studentName: string;
  submittedAt: Date;
  status: 'pending' | 'needs_more_info';
  proof?: string;
  adminFeedback?: string;
}

interface TopicItem {
  id: string;
  title: string;
  authorName: string;
  createdAt: Date;
  status: 'approved' | 'inactive' | 'hidden';
}

interface UserItem {
  id: string;
  isActive: boolean;
}

const trendSeries = [
  { key: 'posts', label: 'Posts', color: '#2563eb' },
  { key: 'replies', label: 'Replies', color: '#14b8a6' },
  { key: 'reports', label: 'Reports', color: '#ef4444' },
  { key: 'approvals', label: 'Approvals', color: '#f59e0b' },
  { key: 'activeUsers', label: 'Active Users', color: '#7c3aed' },
] as const;

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();

  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showMoreInfoModal, setShowMoreInfoModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TopicRequestItem | null>(null);
  const [rejectionFeedback, setRejectionFeedback] = useState('');
  const [moreInfoFeedback, setMoreInfoFeedback] = useState('');
  const [pendingRequests, setPendingRequests] = useState<TopicRequestItem[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [activityLog, setActivityLog] = useState<AdminActivityLogItem[]>([]);
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [insights, setInsights] = useState<AdminInsights | null>(null);
  const [trends, setTrends] = useState<AdminTrendPoint[]>([]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      navigate('/');
      return;
    }

    loadPendingRequests();
    loadTopics();
    loadUsers();
    loadReports();
    loadActivityLog();
    loadInsights();
    loadTrends();
  }, [currentUser, navigate]);

  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  const loadPendingRequests = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/pending-topic-requests/');
      const data = await res.json();

      const mapped = data.map((request: any) => ({
        id: String(request.TOPIC_ID),
        title: request.TITLE,
        content: request.DESCRIPTION,
        category: categoryNameToSlug[request.CATEGORY_NAME] || 'campus-events-general',
        studentName: `${request.FIRST_NAME} ${request.LAST_NAME}`,
        submittedAt: new Date(request.CREATED_AT),
        status: request.STATUS === 'needs_more_info' ? 'needs_more_info' : 'pending',
        proof: request.PROOF_TEXT || '',
        adminFeedback: request.ADMIN_FEEDBACK || ''
      }));

      setPendingRequests(mapped);
    } catch (error) {
      console.error(error);
      toast.error('Could not load topic requests');
    }
  };

  const loadTopics = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin-topics/');
      const data = await res.json();

      const mapped = data.map((topic: any) => ({
        id: String(topic.TOPIC_ID),
        title: topic.TITLE,
        authorName: `${topic.FIRST_NAME} ${topic.LAST_NAME}`,
        createdAt: new Date(topic.CREATED_AT),
        status: topic.STATUS === 'hidden' ? 'hidden' : topic.STATUS === 'inactive' ? 'inactive' : 'approved'
      }));

      setTopics(mapped);
    } catch (error) {
      console.error(error);
      toast.error('Could not load topics');
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/users/');
      const data = await res.json();

      setUsers(
        (Array.isArray(data) ? data : []).map((user: any) => ({
          id: String(user.id ?? user.USER_ID),
          isActive: user.IS_ACTIVE !== undefined ? Number(user.IS_ACTIVE) === 1 : Boolean(user.isActive),
        }))
      );
    } catch (error) {
      console.error(error);
      toast.error('Could not load users');
    }
  };

  const loadReports = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin-reports/');
      if (!res.ok) {
        throw new Error(`admin-reports failed with ${res.status}`);
      }
      const data = await res.json();
      setReports(
        (Array.isArray(data) ? data : []).map((report: any) => {
          const normalizedStatus = String(report.STATUS || 'pending').toLowerCase() === 'reviewed'
            ? 'action_taken'
            : String(report.STATUS || 'pending').toLowerCase();

          return {
            id: String(report.REPORT_ID),
            reporterId: String(report.REPORTER_ID),
            targetType: report.TARGET_TYPE,
            targetId: String(report.TARGET_ID),
            navTopicId: report.NAV_TOPIC_ID ? String(report.NAV_TOPIC_ID) : undefined,
            targetTitle: report.TARGET_TITLE || '',
            targetContent: report.TARGET_CONTENT || '',
            reason: report.REASON,
            details: report.DETAILS || '',
            status: normalizedStatus,
            reviewNotes: report.REVIEW_NOTES || '',
            assignedAdminId: report.ASSIGNED_ADMIN_ID ? String(report.ASSIGNED_ADMIN_ID) : undefined,
            assignedAdminName: report.ASSIGNED_ADMIN_NAME ? String(report.ASSIGNED_ADMIN_NAME).trim() : undefined,
            createdAt: new Date(report.CREATED_AT),
            reviewedAt: report.REVIEWED_AT ? new Date(report.REVIEWED_AT) : undefined,
          };
        })
      );
    } catch (error) {
      console.error(error);
      toast.error('Could not load reports');
    }
  };

  const loadActivityLog = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin-activity-log/');
      if (!res.ok) {
        throw new Error(`admin-activity-log failed with ${res.status}`);
      }
      const data = await res.json();
      setActivityLog(
        (Array.isArray(data) ? data : []).map((item: any) => ({
          id: String(item.LOG_ID),
          adminUserId: item.ADMIN_USER_ID ? String(item.ADMIN_USER_ID) : undefined,
          actionType: item.ACTION_TYPE,
          targetType: item.TARGET_TYPE,
          targetId: item.TARGET_ID ? String(item.TARGET_ID) : undefined,
          description: item.DESCRIPTION,
          createdAt: new Date(item.CREATED_AT),
        }))
      );
    } catch (error) {
      console.error(error);
      toast.error('Could not load activity log');
    }
  };

  const loadInsights = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin-insights/');
      if (!res.ok) {
        throw new Error(`admin-insights failed with ${res.status}`);
      }
      const data = await res.json();
      setInsights(data);
    } catch (error) {
      console.error(error);
      toast.error('Could not load admin insights');
    }
  };

  const loadTrends = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin-trends/');
      if (!res.ok) {
        throw new Error(`admin-trends failed with ${res.status}`);
      }
      const data = await res.json();
      setTrends(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error('Could not load dashboard charts');
    }
  };

  const handleToggleTopicStatus = async (id: string, nextStatus: 'approved' | 'inactive' | 'hidden') => {
    try {
      const res = await fetch('http://localhost:8000/api/toggle-topic-status/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topic_id: id, status: nextStatus, admin_user_id: currentUser.id })
      });

      const data = await res.json();

      if (data.success) {
        setTopics(prev =>
          prev.map(topic =>
            topic.id === id
              ? { ...topic, status: data.status === 'hidden' ? 'hidden' : data.status === 'inactive' ? 'inactive' : 'approved' }
              : topic
          )
        );

        toast.info(
          nextStatus === 'hidden'
            ? 'Topic hidden from users'
            : nextStatus === 'inactive'
            ? 'Topic marked inactive'
            : 'Topic marked active'
        );
        void loadActivityLog();
      } else {
        toast.error('Could not update topic status');
      }
    } catch (error) {
      console.error(error);
      toast.error('Could not update topic status');
    }
  };

  const handleRequestMoreInfo = async (id: string, title: string) => {
    try {
      const res = await fetch('http://localhost:8000/api/request-more-topic-info/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic_id: id,
          feedback: moreInfoFeedback,
          admin_user_id: currentUser.id
        })
      });

      const data = await res.json();

      if (data.success) {
        setPendingRequests(prev =>
          prev.map(request =>
            request.id === id
              ? { ...request, status: 'needs_more_info', adminFeedback: moreInfoFeedback }
              : request
          )
        );
        toast.info('More information requested', {
          description: `"${title}" was returned to the student for updates.`
        });
        void loadActivityLog();
        void loadInsights();
        void loadTrends();
      } else {
        toast.error(data.message || 'Could not request more information');
      }
    } catch (error) {
      console.error(error);
      toast.error('Could not request more information');
    }

    setShowMoreInfoModal(false);
    setSelectedRequest(null);
    setMoreInfoFeedback('');
  };

  const handleApprove = async (request: TopicRequestItem) => {
    try {
      const res = await fetch('http://localhost:8000/api/approve-topic-request/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topic_id: request.id, admin_user_id: currentUser.id })
      });

      const data = await res.json();

      if (data.success) {
        setPendingRequests(prev => prev.filter(item => item.id !== request.id));
        setTopics(prev => {
          if (prev.some(topic => topic.id === request.id)) {
            return prev.map(topic =>
              topic.id === request.id
                ? { ...topic, status: 'approved' }
                : topic
            );
          }

          return [
            {
              id: request.id,
              title: request.title,
              authorName: request.studentName,
              createdAt: new Date(),
              status: 'approved',
            },
            ...prev,
          ];
        });

        void loadTopics();
        toast.success('Topic request approved', {
          description: `"${request.title}" has been published to the forum.`
        });
        void loadActivityLog();
        void loadInsights();
        void loadTrends();
      } else {
        toast.error('Could not approve topic request');
      }
    } catch (error) {
      console.error(error);
      toast.error('Could not approve topic request');
    }
  };

  const handleReject = async (id: string, title: string) => {
    try {
      const res = await fetch('http://localhost:8000/api/reject-topic-request/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic_id: id,
          feedback: rejectionFeedback,
          admin_user_id: currentUser.id
        })
      });

      const data = await res.json();

      if (data.success) {
        setPendingRequests(prev => prev.filter(request => request.id !== id));
        toast.error('Topic request rejected', {
          description: `"${title}" has been rejected.`
        });
        void loadActivityLog();
        void loadInsights();
        void loadTrends();
      } else {
        toast.error('Could not reject topic request');
      }
    } catch (error) {
      console.error(error);
      toast.error('Could not reject topic request');
    }

    setShowRejectModal(false);
    setSelectedRequest(null);
    setRejectionFeedback('');
  };

  const handleDelete = async (id: string, title: string) => {
    try {
      const res = await fetch('http://localhost:8000/api/delete-topic-request/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topic_id: id, admin_user_id: currentUser.id })
      });

      const data = await res.json();

      if (data.success) {
        setPendingRequests(prev => prev.filter(request => request.id !== id));
        toast.info('Request deleted', {
          description: `"${title}" has been permanently deleted.`
        });
        void loadActivityLog();
        void loadInsights();
        void loadTrends();
      } else {
        toast.error('Could not delete topic request');
      }
    } catch (error) {
      console.error(error);
      toast.error('Could not delete topic request');
    }
  };

  const handleResolveReport = async (reportId: string, status: 'under_review' | 'action_taken' | 'dismissed') => {
    try {
      const res = await fetch('http://localhost:8000/api/resolve-report/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: reportId,
          status,
          notes: reportNotes[reportId] || '',
          admin_user_id: currentUser.id,
        })
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || 'Could not update report');
        return;
      }
      setReports(prev => prev.map(report => report.id === reportId ? {
        ...report,
        status,
        reviewNotes: reportNotes[reportId] || report.reviewNotes,
        reviewedAt: new Date(),
        assignedAdminId: data.assignedAdminId || String(currentUser.id),
        assignedAdminName: data.assignedAdminName || currentUser.name,
      } : report));
      void loadActivityLog();
      void loadInsights();
      void loadTrends();
      toast.success(
        status === 'under_review'
          ? 'Report marked under review'
          : status === 'action_taken'
          ? 'Report marked action taken'
          : 'Report dismissed'
      );
    } catch (error) {
      console.error(error);
      toast.error('Could not update report');
    }
  };

  const openReportedContent = (report: ContentReport) => {
    if (!report.navTopicId) {
      toast.error('Could not locate the reported discussion');
      return;
    }

    if (report.targetType === 'reply') {
      navigate(`/topic/${report.navTopicId}?reply=${report.targetId}`);
      return;
    }

    navigate(`/topic/${report.navTopicId}`);
  };

  const pendingRequestCount = pendingRequests.filter(request => request.status === 'pending').length;
  const pendingReportCount = reports.filter(report => report.status === 'pending').length;
  const managedUsers = users.filter(user => user.id !== String(currentUser.id));
  const activeUserCount = managedUsers.filter(user => user.isActive).length;
  const inactiveUserCount = managedUsers.filter(user => !user.isActive).length;

  const summaryCards = [
    { label: 'Pending Requests', value: pendingRequestCount, icon: FileClock },
    { label: 'Pending Reports', value: pendingReportCount, icon: Flag },
    { label: 'Active Users', value: activeUserCount, icon: Activity },
    { label: 'Inactive Users', value: inactiveUserCount, icon: AlertCircle },
  ];

  const chartGeometry = (() => {
    const width = 760;
    const height = 280;
    const padding = { top: 20, right: 16, bottom: 34, left: 16 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(
      1,
      ...trends.flatMap((point) => [
        point.posts,
        point.replies,
        point.reports,
        point.approvals,
        point.activeUsers,
      ])
    );

    return {
      width,
      height,
      padding,
      chartWidth,
      chartHeight,
      maxValue,
      stepX: trends.length > 1 ? chartWidth / (trends.length - 1) : chartWidth,
    };
  })();

  const chartLines = trendSeries.map((series) => {
    const points = trends.map((point, index) => {
      const x = chartGeometry.padding.left + (index * chartGeometry.stepX);
      const y = chartGeometry.padding.top + chartGeometry.chartHeight - ((point[series.key] / chartGeometry.maxValue) * chartGeometry.chartHeight);
      return `${x},${y}`;
    }).join(' ');

    return { ...series, points };
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <button
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        Return to Discussion Feed
      </button>

      <section className="university-panel p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Administrative Control</p>
            <h1 className="mt-3 university-section-title">Admin dashboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Review student submissions, manage topic availability, and oversee platform operations from one university moderation workspace.
            </p>
          </div>

          <button
            onClick={() => navigate('/user-management')}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Users size={16} />
            User Management
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {insights && (
          <div className="mt-8 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Insights</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">Response and moderation trends</h2>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Reports This Week</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{insights.reportsLast7Days}</p>
                  <p className="mt-1 text-xs text-slate-500">Up from {insights.reportsPrevious7Days} last week</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Clock3 size={16} />
                    <p className="text-xs font-semibold uppercase tracking-[0.14em]">Approval Turnaround</p>
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{insights.avgRequestTurnaroundHours}h</p>
                  <p className="mt-2 text-sm text-slate-600">Average time to review student topic requests.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Flag size={16} />
                    <p className="text-xs font-semibold uppercase tracking-[0.14em]">Report Resolution</p>
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{insights.avgReportResolutionHours}h</p>
                  <p className="mt-2 text-sm text-slate-600">Average time to close or dismiss reported content.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <TrendingUp size={16} />
                    <p className="text-xs font-semibold uppercase tracking-[0.14em]">Approvals This Month</p>
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{insights.approvalsLast30Days}</p>
                  <p className="mt-2 text-sm text-slate-600">Approved requests recorded in the last 30 days.</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Top Categories</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Most active discussion areas</h2>
              <div className="mt-5 space-y-3">
                {insights.topCategories.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                    No category activity is available yet.
                  </div>
                ) : (
                  insights.topCategories.map((category, index) => (
                    <div key={category.name} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{index + 1}. {category.name}</p>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Published topics</p>
                      </div>
                      <span className="text-lg font-semibold text-slate-900">{category.topicCount}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Weekly Dashboard Charts</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Posts, replies, reports, approvals, and active users</h2>
              <p className="mt-2 text-sm text-slate-600">A six-week view of how forum activity and moderation are moving across the platform.</p>
            </div>
          </div>

          {trends.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              Weekly chart data is not available yet.
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex flex-wrap gap-3">
                {trendSeries.map((series) => (
                  <div key={series.key} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />
                    {series.label}
                  </div>
                ))}
              </div>

              <div className="mt-5 overflow-x-auto">
                <div className="min-w-[760px] rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4">
                  <svg viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`} className="h-[320px] w-full">
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const y = chartGeometry.padding.top + (chartGeometry.chartHeight * ratio);
                      return (
                        <line
                          key={ratio}
                          x1={chartGeometry.padding.left}
                          y1={y}
                          x2={chartGeometry.width - chartGeometry.padding.right}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="4 4"
                        />
                      );
                    })}

                    {chartLines.map((series) => (
                      <polyline
                        key={series.key}
                        fill="none"
                        stroke={series.color}
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={series.points}
                      />
                    ))}

                    {trends.map((point, index) => {
                      const x = chartGeometry.padding.left + (index * chartGeometry.stepX);
                      return (
                        <text
                          key={point.weekStart}
                          x={x}
                          y={chartGeometry.height - 10}
                          textAnchor="middle"
                          fontSize="12"
                          fill="#64748b"
                        >
                          {point.label}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="university-panel mt-6 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex gap-2 rounded-2xl bg-white p-1.5 shadow-sm">
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'requests' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Topic Requests
            </button>
            <button
              onClick={() => setActiveTab('topics')}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'topics' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Published Topics
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'reports' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Reports
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'activity' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Activity Log
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'requests' ? (
            pendingRequests.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                No pending requests right now.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map(r => (
                  <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <CategoryTag category={r.category} size="sm" />
                          <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                            r.status === 'needs_more_info'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {r.status === 'needs_more_info' ? 'Requested More Info' : 'Pending Review'}
                          </span>
                          <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {r.studentName} • {formatTimeAgo(r.submittedAt)}
                          </span>
                        </div>
                        <h3 className="mt-3 text-xl font-semibold text-slate-900">{r.title}</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{r.content}</p>
                        {r.proof && (
                          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Proof / Justification</p>
                            <p className="mt-2 text-sm leading-7 text-blue-950">{r.proof}</p>
                          </div>
                        )}
                        {r.adminFeedback && (
                          <div className={`mt-4 rounded-2xl border p-4 ${
                            r.status === 'needs_more_info'
                              ? 'border-amber-200 bg-amber-50'
                              : 'border-slate-200 bg-slate-50'
                          }`}>
                            <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${
                              r.status === 'needs_more_info' ? 'text-amber-700' : 'text-slate-600'
                            }`}>
                              {r.status === 'needs_more_info' ? 'Requested Information' : 'Admin Feedback'}
                            </p>
                            <p className={`mt-2 text-sm leading-7 ${
                              r.status === 'needs_more_info' ? 'text-amber-950' : 'text-slate-700'
                            }`}>{r.adminFeedback}</p>
                          </div>
                        )}
                      </div>

                      {r.status === 'pending' ? (
                        <div className="flex flex-wrap gap-2 lg:w-52 lg:flex-col">
                          <button
                            onClick={() => handleApprove(r)}
                            className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequest(r);
                              setShowRejectModal(true);
                            }}
                            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequest(r);
                              setShowMoreInfoModal(true);
                            }}
                            className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                          >
                            Request More Info
                          </button>
                          <button
                            onClick={() => handleDelete(r.id, r.title)}
                            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 lg:w-56">
                          <p className="text-sm font-semibold text-amber-900">Waiting for student update</p>
                          <p className="mt-2 text-sm leading-6 text-amber-800">
                            This request is locked until the student sends more information and resubmits it.
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : activeTab === 'topics' ? topics.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
              No topics available yet.
            </div>
          ) : (
            <div className="space-y-4">
              {topics.map(t => {
                return (
                  <article key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900">{t.title}</h3>
                        <p className="mt-2 text-sm text-slate-500">{t.authorName} • {formatTimeAgo(t.createdAt)}</p>
                        <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                          t.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : t.status === 'inactive'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {t.status === 'approved' ? 'Active' : t.status === 'inactive' ? 'Inactive' : 'Hidden'}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {t.status !== 'approved' && (
                          <button
                            onClick={() => handleToggleTopicStatus(t.id, 'approved')}
                            className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                          >
                            {t.status === 'hidden' ? 'Unhide for Users' : 'Mark Active'}
                          </button>
                        )}
                        {t.status !== 'inactive' && (
                          <button
                            onClick={() => handleToggleTopicStatus(t.id, 'inactive')}
                            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                          >
                            Mark Inactive
                          </button>
                        )}
                        {t.status !== 'hidden' && (
                          <button
                            onClick={() => handleToggleTopicStatus(t.id, 'hidden')}
                            className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                          >
                            Hide from Users
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : activeTab === 'reports' ? (
            reports.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                No reports submitted yet.
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map(report => (
                  <article key={report.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {report.targetType === 'topic'
                              ? 'Topic Report'
                              : 'Reply Report'}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">Reason: {report.reason} • {formatTimeAgo(report.createdAt)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                          report.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : report.status === 'under_review'
                            ? 'bg-blue-100 text-blue-700'
                            : report.status === 'action_taken'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {report.status.replaceAll('_', ' ')}
                        </span>
                      </div>
                      {(report.targetTitle || report.targetContent) && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                          {report.targetTitle && (
                            <p className="text-sm font-semibold text-slate-900">{report.targetTitle}</p>
                          )}
                          {report.targetContent && (
                            <p className="mt-2 text-sm leading-7 text-slate-700">{report.targetContent}</p>
                          )}
                        </div>
                      )}
                      {report.details && <p className="text-sm leading-7 text-slate-700">{report.details}</p>}
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>Assigned to: <span className="font-semibold text-slate-700">{report.assignedAdminName || 'Unassigned'}</span></span>
                        <span>Created: <span className="font-semibold text-slate-700">{formatTimeAgo(report.createdAt)}</span></span>
                        {report.reviewedAt && (
                          <span>Updated: <span className="font-semibold text-slate-700">{formatTimeAgo(report.reviewedAt)}</span></span>
                        )}
                      </div>
                      <textarea
                        value={reportNotes[report.id] || report.reviewNotes || ''}
                        onChange={(e) => setReportNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
                        rows={3}
                        placeholder="Add moderator notes..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => openReportedContent(report)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700">Open Discussion</button>
                        {report.status !== 'under_review' && (
                          <button onClick={() => handleResolveReport(report.id, 'under_review')} className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700">Mark Under Review</button>
                        )}
                        {report.status !== 'action_taken' && (
                          <button onClick={() => handleResolveReport(report.id, 'action_taken')} className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700">Mark Action Taken</button>
                        )}
                        <button onClick={() => handleResolveReport(report.id, 'dismissed')} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">Dismiss</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
            activityLog.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                No admin activity recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {activityLog.map(item => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-medium text-slate-900">{item.description}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">{item.actionType.replaceAll('_', ' ')} • {formatTimeAgo(item.createdAt)}</p>
                  </article>
                ))}
              </div>
            )
          )}
        </div>
      </section>

      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4">
          <div className="university-panel w-full max-w-lg p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
                <AlertCircle size={18} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-slate-900">Reject topic request</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Add a clear reason so the student understands why "{selectedRequest.title}" was not approved.
                </p>
              </div>
            </div>

            <textarea
              value={rejectionFeedback}
              onChange={(e) => setRejectionFeedback(e.target.value)}
              className="mt-5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="Provide rejection feedback..."
              rows={5}
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedRequest.id, selectedRequest.title)}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoreInfoModal && selectedRequest && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4">
          <div className="university-panel w-full max-w-lg p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                <AlertCircle size={18} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-slate-900">Request more information</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Tell the student what is missing so they can update "{selectedRequest.title}" and resubmit it.
                </p>
              </div>
            </div>

            <textarea
              value={moreInfoFeedback}
              onChange={(e) => setMoreInfoFeedback(e.target.value)}
              className="mt-5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="Example: Please add an official flyer, source link, or date confirmation."
              rows={5}
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowMoreInfoModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRequestMoreInfo(selectedRequest.id, selectedRequest.title)}
                className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
