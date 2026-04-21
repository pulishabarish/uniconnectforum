export type UserRole = 'student' | 'faculty' | 'admin';

export type Category = 
  // Campus Events subcategories
  | 'campus-events-general'
  | 'campus-events-sports'
  | 'campus-events-cultural'
  | 'campus-events-workshops'
  // Jobs & Internships subcategories
  | 'jobs-internships-tech'
  | 'jobs-internships-business'
  | 'jobs-internships-research'
  | 'jobs-internships-oncampus'
  // Academics subcategories
  | 'academics-datascience'
  | 'academics-engineering'
  | 'academics-business'
  | 'academics-arts'
  // Announcements subcategories
  | 'announcements-admin'
  | 'announcements-safety'
  | 'announcements-facilities'
  | 'announcements-policy'
  // Research subcategories
  | 'research-stem'
  | 'research-social'
  | 'research-medical'
  | 'research-opportunities';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  name: string; // Full name (kept for compatibility)
  email: string;
  phoneNumber?: string;
  role: UserRole;
  avatar?: string;
  bio?: string;
  department?: string;
  verifiedRole?: boolean;
  verifiedDepartment?: boolean;
  officeAddress?: string;
  officeHours?: string;
  interests?: Category[];
  academicInterests?: string[];
  notificationPreferences?: NotificationPreferences;
  followedTopics?: string[];
  teachingClasses?: string[]; // For faculty - class IDs they teach
  enrolledClasses?: string[]; // For students - class IDs they're enrolled in
}

export interface Topic {
  id: string;
  title: string;
  content: string;
  category: Category;
  imageUrl?: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: Date;
  upvotes: number;
  replyCount: number;
  upvotedBy: string[];
  followers?: string[];
  isActive?: boolean; // For admin moderation
}

export interface Reply {
  id: string;
  topicId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: Date;
  upvotes: number;
  parentReplyId?: string;
  upvotedBy: string[];
}

export interface TopicRequest {
  id: string;
  title: string;
  content: string;
  category: Category;
  proof: string;
  coverImage?: string; // URL to cover image
  studentId: string;
  studentName: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_more_info';
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionFeedback?: string; // Admin feedback when rejecting
}

export interface TopicRequestTimelineItem {
  id: string;
  topicId: string;
  eventType: string;
  eventMessage: string;
  createdAt: Date;
}

export interface ContentReport {
  id: string;
  reporterId: string;
  targetType: 'topic' | 'reply';
  targetId: string;
  navTopicId?: string;
  targetTitle?: string;
  targetContent?: string;
  reason: string;
  details?: string;
  status: 'pending' | 'under_review' | 'action_taken' | 'dismissed';
  reviewNotes?: string;
  assignedAdminId?: string;
  assignedAdminName?: string;
  createdAt: Date;
  reviewedAt?: Date;
}

export interface AdminActivityLogItem {
  id: string;
  adminUserId?: string;
  actionType: string;
  targetType: string;
  targetId?: string;
  description: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  createdAt: Date;
  read: boolean;
}

export interface Conversation {
  userId: string;
  userName: string;
  userRole: UserRole;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
}

export interface Class {
  id: string;
  code: string; // e.g., "CS-698", "MATH-505"
  name: string; // e.g., "Advanced Machine Learning"
  department: string;
  instructorId: string;
  instructorName: string;
  semester: string; // e.g., "Spring 2026"
  deliveryMode?: 'online' | 'offline' | 'hybrid';
  description: string;
  enrolledStudents: string[]; // Student user IDs
  createdAt: Date;
  discussionCount?: number;
  enrolledCount?: number;
  isEnrolled?: boolean;
  hasPendingRequest?: boolean;
  days: string[]; // e.g., ["Monday", "Wednesday", "Friday"]
  time: string; // e.g., "10:00 AM - 11:30 AM"
  location?: string; // e.g., "Room 305, CS Building"
}

export interface ClassJoinRequest {
  id: string;
  classId: string;
  className: string;
  classCode: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  reviewedAt?: Date;
}

export interface ClassDiscussion {
  id: string;
  classId: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: Date;
  upvotes: number;
  replyCount: number;
  upvotedBy: string[];
  isPinned?: boolean; // Instructor can pin important discussions
}

export interface ClassDiscussionReply {
  id: string;
  discussionId: string;
  classId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: Date;
  upvotes: number;
  parentReplyId?: string;
  upvotedBy: string[];
}

export interface ClassResource {
  id: string;
  classId: string;
  title: string;
  description?: string;
  resourceType: 'syllabus' | 'assignment' | 'material' | 'link';
  resourceUrl?: string;
  fileUrl?: string;
  isPinned?: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}

export type NotificationType = 
  | 'topic_request_approved'
  | 'topic_request_rejected'
  | 'topic_request_more_info'
  | 'new_topic_in_followed_category'
  | 'topic_comment_posted'
  | 'comment_reply_posted'
  | 'reported_reply_notice'
  | 'reported_topic_notice'
  | 'class_topic_posted'
  | 'class_reply_posted'
  | 'general';

export interface Notification {
  id: string;
  userId: string; // User who should receive this notification
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string; // Topic ID, Request ID, etc.
  createdAt: Date;
  read: boolean;
}

export interface NotificationPreferences {
  approvals: boolean;
  replies: boolean;
  classActivity: boolean;
  moderation: boolean;
  digestFrequency: 'instant' | 'daily' | 'weekly';
  emailStyleSummary: boolean;
}

export interface UserProfileMeta {
  bio?: string;
  department?: string;
  officeAddress?: string;
  officeHours?: string;
  interests?: Category[];
  academicInterests?: string[];
  notificationPreferences?: NotificationPreferences;
}

export interface AdminInsightCategory {
  name: string;
  topicCount: number;
}

export interface AdminInsights {
  activeUsers30d: number;
  pendingReports: number;
  pendingRequests: number;
  avgRequestTurnaroundHours: number;
  avgReportResolutionHours: number;
  reportsLast7Days: number;
  reportsPrevious7Days: number;
  approvalsLast30Days: number;
  topCategories: AdminInsightCategory[];
}

export interface AdminTrendPoint {
  weekStart: string;
  label: string;
  posts: number;
  replies: number;
  reports: number;
  approvals: number;
  activeUsers: number;
}
