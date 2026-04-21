import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, Topic, Reply, TopicRequest, Message, Conversation, Class, ClassJoinRequest, ClassDiscussion, ClassDiscussionReply, Notification } from '../types';
import { mockUsers, mockTopics, mockReplies, mockTopicRequests, mockMessages, mockClasses, mockClassJoinRequests, mockClassDiscussions, mockClassDiscussionReplies } from '../data/mockData.ts';
import { useEffect } from "react";
import { mergeUserWithStoredMeta } from '../utils/userMeta.ts';
interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  replies: Reply[];
  setReplies: React.Dispatch<React.SetStateAction<Reply[]>>;
  topicRequests: TopicRequest[];
  setTopicRequests: React.Dispatch<React.SetStateAction<TopicRequest[]>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  classes: Class[];
  setClasses: React.Dispatch<React.SetStateAction<Class[]>>;
  classJoinRequests: ClassJoinRequest[];
  setClassJoinRequests: React.Dispatch<React.SetStateAction<ClassJoinRequest[]>>;
  classDiscussions: ClassDiscussion[];
  setClassDiscussions: React.Dispatch<React.SetStateAction<ClassDiscussion[]>>;
  classDiscussionReplies: ClassDiscussionReply[];
  setClassDiscussionReplies: React.Dispatch<React.SetStateAction<ClassDiscussionReply[]>>;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  upvoteTopic: (topicId: string) => void;
  upvoteReply: (replyId: string) => void;
  addReply: (reply: Reply) => void;
  addTopicRequest: (request: TopicRequest) => void;
  approveTopicRequest: (requestId: string) => void;
  rejectTopicRequest: (requestId: string, feedback?: string) => void;
  deleteTopicRequest: (requestId: string) => void;
  deleteTopic: (topicId: string) => void;
  toggleTopicActive: (topicId: string) => void;
  updateUserProfile: (updates: Partial<User>) => void;
  deleteReply: (replyId: string, topicId: string) => void;
  followTopic: (topicId: string) => void;
  unfollowTopic: (topicId: string) => void;
  sendMessage: (message: Message) => void;
  markMessageAsRead: (messageId: string) => void;
  getConversations: () => Conversation[];
  getMessagesWithUser: (userId: string) => Message[];
  startConversation: (userId: string) => void;
  addClass: (classItem: Class) => void;
  addClassJoinRequest: (request: ClassJoinRequest) => void;
  approveClassJoinRequest: (requestId: string) => void;
  rejectClassJoinRequest: (requestId: string) => void;
  addClassDiscussion: (discussion: ClassDiscussion) => void;
  addClassDiscussionReply: (reply: ClassDiscussionReply) => void;
  upvoteClassDiscussion: (discussionId: string) => void;
  upvoteClassDiscussionReply: (replyId: string) => void;
  togglePinClassDiscussion: (discussionId: string) => void;
  leaveClass: (classId: string) => void;
  removeStudentFromClass: (classId: string, studentId: string) => void;
  getNotifications: () => Notification[];
  getUnreadNotificationCount: () => number;
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    if (!saved) return null;

    try {
      return mergeUserWithStoredMeta(JSON.parse(saved) as User);
    } catch (error) {
      console.error(error);
      localStorage.removeItem('currentUser');
      return null;
    }
  });
  const [users] = useState<User[]>(mockUsers);
  const [topics, setTopics] = useState<Topic[]>(mockTopics);
//   const [topics, setTopics] = useState<Topic[]>([]);
//   useEffect(() => {
//   fetch("https://uniconnectforum.onrender.com/api/topics/")
//     .then(res => res.json())
//     .then(data => {
//       console.log("RAW API:", data);

//       const mapped = data.map((t: any) => ({
//         id: t.TOPIC_ID,
//         title: t.TITLE,
//         description: t.DESCRIPTION,
//         category: t.CATEGORY_NAME,
//         author: t.FIRST_NAME + " " + t.LAST_NAME,
//         createdAt: t.CREATED_AT,
//       }));

//       console.log("MAPPED:", mapped);

//       setTopics(mapped);
//     });
// }, []);
  const [replies, setReplies] = useState<Reply[]>(mockReplies);
  const [topicRequests, setTopicRequests] = useState<TopicRequest[]>(mockTopicRequests);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [classes, setClasses] = useState<Class[]>(mockClasses);
  const [classJoinRequests, setClassJoinRequests] = useState<ClassJoinRequest[]>(mockClassJoinRequests);
  const [classDiscussions, setClassDiscussions] = useState<ClassDiscussion[]>(mockClassDiscussions);
  const [classDiscussionReplies, setClassDiscussionReplies] = useState<ClassDiscussionReply[]>(mockClassDiscussionReplies);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      localStorage.setItem('user', JSON.stringify({
        USER_ID: currentUser.id,
        EMAIL: currentUser.email
      }));
      return;
    }

    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
  }, [currentUser]);

  const upvoteTopic = (topicId: string) => {
    if (!currentUser) return;
    
    setTopics(prevTopics =>
      prevTopics.map(topic => {
        if (topic.id === topicId) {
          const hasUpvoted = topic.upvotedBy.includes(currentUser.id);
          return {
            ...topic,
            upvotes: hasUpvoted ? topic.upvotes - 1 : topic.upvotes + 1,
            upvotedBy: hasUpvoted
              ? topic.upvotedBy.filter(id => id !== currentUser.id)
              : [...topic.upvotedBy, currentUser.id]
          };
        }
        return topic;
      })
    );
  };

  const upvoteReply = (replyId: string) => {
    if (!currentUser) return;
    
    setReplies(prevReplies =>
      prevReplies.map(reply => {
        if (reply.id === replyId) {
          const hasUpvoted = reply.upvotedBy.includes(currentUser.id);
          return {
            ...reply,
            upvotes: hasUpvoted ? reply.upvotes - 1 : reply.upvotes + 1,
            upvotedBy: hasUpvoted
              ? reply.upvotedBy.filter(id => id !== currentUser.id)
              : [...reply.upvotedBy, currentUser.id]
          };
        }
        return reply;
      })
    );
  };

  const addReply = (reply: Reply) => {
    setReplies(prev => [...prev, reply]);
    setTopics(prevTopics =>
      prevTopics.map(topic =>
        topic.id === reply.topicId
          ? { ...topic, replyCount: topic.replyCount + 1 }
          : topic
      )
    );
  };

  const addTopicRequest = (request: TopicRequest) => {
    setTopicRequests(prev => [...prev, request]);
  };

  const approveTopicRequest = (requestId: string) => {
    const request = topicRequests.find(r => r.id === requestId);
    if (!request || !currentUser) return;

    // Create new topic from approved request
    const newTopic: Topic = {
      id: `t${Date.now()}`,
      title: request.title,
      content: request.content,
      category: request.category,
      imageUrl: request.coverImage,
      authorId: request.studentId,
      authorName: request.studentName,
      authorRole: 'student',
      createdAt: new Date(),
      upvotes: 0,
      replyCount: 0,
      upvotedBy: [],
      followers: []
    };

    setTopics(prev => {
      // Create notifications for users who have this category in their interests
      const interestedUsers = mockUsers.filter(u => 
        u.id !== request.studentId && 
        u.interests?.includes(request.category)
      );

      interestedUsers.forEach(user => {
        const notification: Notification = {
          id: `n${Date.now()}-${user.id}`,
          userId: user.id,
          type: 'new_topic_in_followed_category',
          title: 'New Topic in Your Interest',
          message: `"${request.title}" was posted in a category you follow`,
          relatedId: newTopic.id,
          createdAt: new Date(),
          read: false
        };
        setNotifications(prevNotifs => [...prevNotifs, notification]);
      });

      return [newTopic, ...prev];
    });

    setTopicRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? { ...r, status: 'approved' as const, reviewedAt: new Date(), reviewedBy: currentUser.id }
          : r
      )
    );

    // Create notification for the student
    const approvalNotification: Notification = {
      id: `n${Date.now()}`,
      userId: request.studentId,
      type: 'topic_request_approved',
      title: 'Topic Request Approved!',
      message: `Your topic request "${request.title}" has been approved and published`,
      relatedId: newTopic.id,
      createdAt: new Date(),
      read: false
    };
    setNotifications(prev => [...prev, approvalNotification]);
  };

  const rejectTopicRequest = (requestId: string, feedback?: string) => {
    const request = topicRequests.find(r => r.id === requestId);
    if (!currentUser || !request) return;
    
    setTopicRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? { ...r, status: 'rejected' as const, reviewedAt: new Date(), reviewedBy: currentUser.id, rejectionFeedback: feedback }
          : r
      )
    );

    // Create notification for the student
    const rejectionNotification: Notification = {
      id: `n${Date.now()}`,
      userId: request.studentId,
      type: 'topic_request_rejected',
      title: 'Topic Request Rejected',
      message: `Your topic request "${request.title}" was not approved${feedback ? ': ' + feedback : ''}`,
      relatedId: requestId,
      createdAt: new Date(),
      read: false
    };
    setNotifications(prev => [...prev, rejectionNotification]);
  };

  const deleteTopicRequest = (requestId: string) => {
    setTopicRequests(prev => prev.filter(r => r.id !== requestId));
  };

  const deleteTopic = (topicId: string) => {
    setTopics(prev => prev.filter(t => t.id !== topicId));
    setReplies(prev => prev.filter(r => r.topicId !== topicId));
  };

  const toggleTopicActive = (topicId: string) => {
    setTopics(prevTopics =>
      prevTopics.map(topic =>
        topic.id === topicId
          ? { ...topic, isActive: topic.isActive === false ? true : false }
          : topic
      )
    );
  };

  const updateUserProfile = (updates: Partial<User>) => {
    if (!currentUser) return;
    
    setCurrentUser({
      ...currentUser,
      ...updates
    });
  };

  const deleteReply = (replyId: string, topicId: string) => {
    // Get all reply IDs to delete (including children)
    const getReplyIdsToDelete = (id: string): string[] => {
      const childReplies = replies.filter(r => r.parentReplyId === id);
      const childIds = childReplies.flatMap(child => getReplyIdsToDelete(child.id));
      return [id, ...childIds];
    };

    const idsToDelete = getReplyIdsToDelete(replyId);
    
    // Delete all replies
    setReplies(prev => prev.filter(r => !idsToDelete.includes(r.id)));
    
    // Update topic reply count
    setTopics(prevTopics =>
      prevTopics.map(topic =>
        topic.id === topicId
          ? { ...topic, replyCount: Math.max(0, topic.replyCount - idsToDelete.length) }
          : topic
      )
    );
  };

  const followTopic = (topicId: string) => {
    if (!currentUser) return;

    // Update user's followed topics
    setCurrentUser({
      ...currentUser,
      followedTopics: [...(currentUser.followedTopics || []), topicId]
    });

    // Update topic's followers
    setTopics(prevTopics =>
      prevTopics.map(topic =>
        topic.id === topicId
          ? { ...topic, followers: [...(topic.followers || []), currentUser.id] }
          : topic
      )
    );
  };

  const unfollowTopic = (topicId: string) => {
    if (!currentUser) return;

    // Update user's followed topics
    setCurrentUser({
      ...currentUser,
      followedTopics: (currentUser.followedTopics || []).filter(id => id !== topicId)
    });

    // Update topic's followers
    setTopics(prevTopics =>
      prevTopics.map(topic =>
        topic.id === topicId
          ? { ...topic, followers: (topic.followers || []).filter(id => id !== currentUser.id) }
          : topic
      )
    );
  };

  const sendMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const markMessageAsRead = (messageId: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, read: true } : msg
      )
    );
  };

  const getConversations = (): Conversation[] => {
    if (!currentUser) return [];

    const userMessages = messages.filter(
      msg => msg.senderId === currentUser.id || msg.receiverId === currentUser.id
    );

    const conversationMap = new Map<string, Conversation>();

    userMessages.forEach(msg => {
      const otherUserId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
      const otherUser = mockUsers.find(u => u.id === otherUserId);
      
      if (!otherUser) return;

      const existing = conversationMap.get(otherUserId);
      const isUnread = msg.receiverId === currentUser.id && !msg.read;

      if (!existing || msg.createdAt > existing.lastMessageTime) {
        conversationMap.set(otherUserId, {
          userId: otherUser.id,
          userName: otherUser.name,
          userRole: otherUser.role,
          lastMessage: msg.content,
          lastMessageTime: msg.createdAt,
          unreadCount: existing 
            ? (isUnread ? existing.unreadCount + 1 : existing.unreadCount)
            : (isUnread ? 1 : 0)
        });
      } else if (isUnread) {
        conversationMap.set(otherUserId, {
          ...existing,
          unreadCount: existing.unreadCount + 1
        });
      }
    });

    return Array.from(conversationMap.values()).sort(
      (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
    );
  };

  const getMessagesWithUser = (userId: string): Message[] => {
    if (!currentUser) return [];

    return messages
      .filter(
        msg =>
          (msg.senderId === currentUser.id && msg.receiverId === userId) ||
          (msg.senderId === userId && msg.receiverId === currentUser.id)
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  };

  const startConversation = (userId: string) => {
    // This function can be used to initialize a conversation
    // For now, it doesn't need to do anything as the conversation
    // will be created when the first message is sent
  };

  const addClass = (classItem: Class) => {
    setClasses(prev => [classItem, ...prev]);

    if (currentUser?.role === 'faculty') {
      setCurrentUser({
        ...currentUser,
        teachingClasses: [...(currentUser.teachingClasses || []), classItem.id]
      });
    }
  };

  const addClassJoinRequest = (request: ClassJoinRequest) => {
    setClassJoinRequests(prev => [...prev, request]);
  };

  const approveClassJoinRequest = (requestId: string) => {
    const request = classJoinRequests.find(r => r.id === requestId);
    if (!request || !currentUser) return;

    // Add user to class enrolled students
    setClasses(prev =>
      prev.map(c =>
        c.id === request.classId
          ? { ...c, enrolledStudents: [...c.enrolledStudents, request.studentId] }
          : c
      )
    );

    // Update the join request status
    setClassJoinRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? { ...r, status: 'approved' as const, reviewedAt: new Date() }
          : r
      )
    );

    // Update current user's enrolled classes if they are the student
    if (currentUser.id === request.studentId) {
      setCurrentUser({
        ...currentUser,
        enrolledClasses: [...(currentUser.enrolledClasses || []), request.classId]
      });
    }
  };

  const rejectClassJoinRequest = (requestId: string) => {
    if (!currentUser) return;
    
    setClassJoinRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? { ...r, status: 'rejected' as const, reviewedAt: new Date(), reviewedBy: currentUser.id }
          : r
      )
    );
  };

  const addClassDiscussion = (discussion: ClassDiscussion) => {
    setClassDiscussions(prev => [...prev, discussion]);
    setClasses(prev =>
      prev.map(c =>
        c.id === discussion.classId
          ? { ...c, discussionCount: (c.discussionCount ?? 0) + 1 }
          : c
      )
    );
  };

  const addClassDiscussionReply = (reply: ClassDiscussionReply) => {
    setClassDiscussionReplies(prev => [...prev, reply]);
    setClassDiscussions(prev =>
      prev.map(d =>
        d.id === reply.discussionId
          ? { ...d, replyCount: d.replyCount + 1 }
          : d
      )
    );
  };

  const upvoteClassDiscussion = (discussionId: string) => {
    if (!currentUser) return;
    
    setClassDiscussions(prevDiscussions =>
      prevDiscussions.map(discussion => {
        if (discussion.id === discussionId) {
          const hasUpvoted = discussion.upvotedBy.includes(currentUser.id);
          return {
            ...discussion,
            upvotes: hasUpvoted ? discussion.upvotes - 1 : discussion.upvotes + 1,
            upvotedBy: hasUpvoted
              ? discussion.upvotedBy.filter(id => id !== currentUser.id)
              : [...discussion.upvotedBy, currentUser.id]
          };
        }
        return discussion;
      })
    );
  };

  const upvoteClassDiscussionReply = (replyId: string) => {
    if (!currentUser) return;
    
    setClassDiscussionReplies(prevReplies =>
      prevReplies.map(reply => {
        if (reply.id === replyId) {
          const hasUpvoted = reply.upvotedBy.includes(currentUser.id);
          return {
            ...reply,
            upvotes: hasUpvoted ? reply.upvotes - 1 : reply.upvotes + 1,
            upvotedBy: hasUpvoted
              ? reply.upvotedBy.filter(id => id !== currentUser.id)
              : [...reply.upvotedBy, currentUser.id]
          };
        }
        return reply;
      })
    );
  };

  const togglePinClassDiscussion = (discussionId: string) => {
    setClassDiscussions(prevDiscussions =>
      prevDiscussions.map(discussion =>
        discussion.id === discussionId
          ? { ...discussion, isPinned: !discussion.isPinned }
          : discussion
      )
    );
  };

  const leaveClass = (classId: string) => {
    if (!currentUser) return;

    // Remove user from class enrolled students
    setClasses(prev =>
      prev.map(c =>
        c.id === classId
          ? { ...c, enrolledStudents: c.enrolledStudents.filter(id => id !== currentUser.id) }
          : c
      )
    );

    // Update current user's enrolled classes
    setCurrentUser({
      ...currentUser,
      enrolledClasses: (currentUser.enrolledClasses || []).filter(id => id !== classId)
    });
  };

  const removeStudentFromClass = (classId: string, studentId: string) => {
    if (!currentUser) return;

    // Remove student from class enrolled students
    setClasses(prev =>
      prev.map(c =>
        c.id === classId
          ? { ...c, enrolledStudents: c.enrolledStudents.filter(id => id !== studentId) }
          : c
      )
    );
  };

  const getNotifications = (): Notification[] => {
    return notifications;
  };

  const getUnreadNotificationCount = (): number => {
    if (!currentUser) return 0;
    return notifications.filter(n => String(n.userId) === String(currentUser.id) && !n.read).length;
  };

  const markNotificationAsRead = (notificationId: string) => {
    fetch('https://uniconnectforum.onrender.com/api/mark-notification-read/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_id: notificationId })
    }).catch(err => console.error('MARK NOTIFICATION READ ERROR:', err));

    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  const markAllNotificationsAsRead = () => {
    if (currentUser) {
      fetch('https://uniconnectforum.onrender.com/api/mark-all-notifications-read/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id })
      }).catch(err => console.error('MARK ALL NOTIFICATIONS READ ERROR:', err));
    }

    setNotifications(prev =>
      prev.map(n =>
        currentUser && String(n.userId) === String(currentUser.id) ? { ...n, read: true } : n
      )
    );
  };

  const deleteNotification = (notificationId: string) => {
    fetch('https://uniconnectforum.onrender.com/api/delete-notification/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_id: notificationId })
    }).catch(err => console.error('DELETE NOTIFICATION ERROR:', err));

    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        topics,
        setTopics,
        replies,
        setReplies,
        topicRequests,
        setTopicRequests,
        messages,
        setMessages,
        classes,
        setClasses,
        classJoinRequests,
        setClassJoinRequests,
        classDiscussions,
        setClassDiscussions,
        classDiscussionReplies,
        setClassDiscussionReplies,
        notifications,
        setNotifications,
        upvoteTopic,
        upvoteReply,
        addReply,
        addTopicRequest,
        approveTopicRequest,
        rejectTopicRequest,
        deleteTopicRequest,
        deleteTopic,
        toggleTopicActive,
        updateUserProfile,
        deleteReply,
        followTopic,
        unfollowTopic,
        sendMessage,
        markMessageAsRead,
        getConversations,
        getMessagesWithUser,
        startConversation,
        addClass,
        addClassJoinRequest,
        approveClassJoinRequest,
        rejectClassJoinRequest,
        addClassDiscussion,
        addClassDiscussionReply,
        upvoteClassDiscussion,
        upvoteClassDiscussionReply,
        togglePinClassDiscussion,
        leaveClass,
        removeStudentFromClass,
        getNotifications,
        getUnreadNotificationCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
