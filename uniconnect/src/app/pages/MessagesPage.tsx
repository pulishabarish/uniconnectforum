import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Search, ArrowLeft, UserIcon, X, Mail, MessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatTimeAgo, getRoleBadgeColor } from '../utils/helpers.ts';
import { useNavigate } from 'react-router-dom';
import type { Conversation, Message, User } from '../types.ts';
import { toast } from 'sonner';

const API_BASE = 'http://127.0.0.1:8000/api';

const mapConversation = (item: any): Conversation => ({
  userId: String(item.userId),
  userName: item.userName,
  userRole: item.userRole,
  lastMessage: item.lastMessage || '',
  lastMessageTime: new Date(item.lastMessageTime),
  unreadCount: Number(item.unreadCount || 0),
});

const mapMessage = (item: any, usersById: Record<string, User>): Message => ({
  id: String(item.id),
  senderId: String(item.senderId),
  senderName: usersById[String(item.senderId)]?.name || 'User',
  receiverId: String(item.receiverId),
  content: item.content,
  createdAt: new Date(item.createdAt),
  read: Boolean(item.read),
});

export const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(false);

  const usersById = useMemo(() => (
    users.reduce<Record<string, User>>((acc, user) => {
      acc[String(user.id)] = user;
      return acc;
    }, {})
  ), [users]);

  const selectedUser = selectedUserId ? usersById[selectedUserId] : null;

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/users/`);
      const data = await res.json();
      setUsers(
        (Array.isArray(data) ? data : []).map((user: any) => ({
          id: String(user.id ?? user.USER_ID),
          firstName: user.firstName ?? user.FIRST_NAME,
          lastName: user.lastName ?? user.LAST_NAME,
          name: user.name ?? `${user.firstName ?? user.FIRST_NAME} ${user.lastName ?? user.LAST_NAME}`.trim(),
          email: user.email ?? user.EMAIL,
          role: user.role ?? user.ROLE,
        }))
      );
    } catch (error) {
      console.error('LOAD USERS ERROR:', error);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    if (!currentUser) return;

    try {
      const res = await fetch(`${API_BASE}/messages/conversations/${currentUser.id}/`);
      const data = await res.json();
      setConversations((Array.isArray(data) ? data : []).map(mapConversation));
    } catch (error) {
      console.error('LOAD CONVERSATIONS ERROR:', error);
    }
  }, [currentUser]);

  const loadThread = useCallback(async (otherUserId: string) => {
    if (!currentUser) return;

    try {
      const res = await fetch(`${API_BASE}/messages/thread/${currentUser.id}/${otherUserId}/`);
      const data = await res.json();
      setSelectedMessages((Array.isArray(data) ? data : []).map((message: any) => mapMessage(message, usersById)));
    } catch (error) {
      console.error('LOAD MESSAGE THREAD ERROR:', error);
    }
  }, [currentUser, usersById]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    loadUsers();
    loadConversations();
  }, [currentUser, navigate, loadUsers, loadConversations]);

  useEffect(() => {
    if (!selectedUserId || !currentUser) return;

    shouldAutoScrollRef.current = true;
    loadThread(selectedUserId);

    fetch(`${API_BASE}/messages/mark-read/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        other_user_id: selectedUserId,
      }),
    })
      .then(() => loadConversations())
      .catch(error => console.error('MARK MESSAGE THREAD READ ERROR:', error));
  }, [selectedUserId, currentUser, loadConversations, loadThread]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    shouldAutoScrollRef.current = false;
  }, [selectedMessages]);

  if (!currentUser) {
    return null;
  }

  const searchResults = users.filter(user =>
    String(user.id) !== String(currentUser.id) &&
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedUserId || !currentUser || isSending) return;

    const trimmedMessage = messageText.trim();
    const receiver = usersById[selectedUserId];
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      senderId: String(currentUser.id),
      senderName: currentUser.name,
      receiverId: String(selectedUserId),
      content: trimmedMessage,
      createdAt: new Date(),
      read: false,
    };

    setMessageText('');
    setIsSending(true);
    shouldAutoScrollRef.current = true;
    setSelectedMessages(prev => [...prev, optimisticMessage]);
    setConversations(prev => {
      const nextConversation: Conversation = {
        userId: String(selectedUserId),
        userName: receiver?.name || selectedUser?.name || 'User',
        userRole: receiver?.role || selectedUser?.role || 'student',
        lastMessage: trimmedMessage,
        lastMessageTime: new Date(),
        unreadCount: 0,
      };

      const withoutExisting = prev.filter(conv => conv.userId !== String(selectedUserId));
      return [nextConversation, ...withoutExisting];
    });

    try {
      const res = await fetch(`${API_BASE}/messages/send/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: currentUser.id,
          receiver_id: selectedUserId,
          content: trimmedMessage,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setSelectedMessages(prev => prev.filter(message => message.id !== optimisticMessage.id));
        setMessageText(trimmedMessage);
        toast.error(data.message || 'Could not send message');
        return;
      }

      await Promise.all([loadConversations(), loadThread(selectedUserId)]);
    } catch (error) {
      console.error('SEND MESSAGE ERROR:', error);
      setSelectedMessages(prev => prev.filter(message => message.id !== optimisticMessage.id));
      setMessageText(trimmedMessage);
      toast.error('Could not send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleStartNewConversation = (userId: string) => {
    shouldAutoScrollRef.current = true;
    setSelectedUserId(userId);
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const handleViewProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <button
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        Return to Discussion Feed
      </button>

      <section className="university-panel overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">University Messaging</p>
          <h1 className="mt-3 university-section-title">Direct Messages</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
            Communicate with students, faculty, and administrators in a structured university messaging workspace.
          </p>
        </div>

        <div className="flex h-[calc(100vh-13rem)] min-h-[640px] min-w-0 flex-col md:flex-row">
          <aside className={`${selectedUserId ? 'hidden md:flex' : 'flex'} min-h-0 w-full shrink-0 flex-col border-r border-slate-200 bg-slate-50/70 md:w-[24rem]`}>
            <div className="border-b border-slate-200 px-5 py-5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSearchResults(true)}
                  placeholder="Search users by name"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setShowSearchResults(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {showSearchResults && searchQuery.trim() ? (
                <div className="p-4">
                  {searchResults.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                      <UserIcon className="mx-auto mb-3 text-slate-400" size={32} />
                      <p className="text-sm">No users found matching "{searchQuery}"</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {searchResults.map(user => (
                        <div key={user.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => handleViewProfile(String(user.id))}
                              className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white"
                              title="View Profile"
                            >
                              {user.name.charAt(0)}
                            </button>
                            <div className="min-w-0 flex-1">
                              <button onClick={() => handleViewProfile(String(user.id))} className="flex items-center gap-2 hover:underline">
                                <span className="font-semibold text-slate-900">{user.name}</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs ${getRoleBadgeColor(user.role)}`}>
                                  {user.role}
                                </span>
                              </button>
                              <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                              <button
                                onClick={() => handleStartNewConversation(String(user.id))}
                                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                              >
                                <Mail size={14} />
                                Start Conversation
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                    <MessageSquare className="mx-auto mb-3 text-slate-400" size={34} />
                    <p className="text-sm font-medium text-slate-700">No conversations yet</p>
                    <p className="mt-2 text-sm text-slate-500">Use the search bar above to start messaging other university users.</p>
                  </div>
                </div>
              ) : (
                <div className="p-3">
                  <div className="space-y-2">
                    {conversations.map(conv => (
                      <button
                        key={conv.userId}
                        onClick={() => setSelectedUserId(conv.userId)}
                        className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                          selectedUserId === conv.userId
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white">
                            {conv.userName.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-semibold text-slate-900">{conv.userName}</span>
                              <span className={`rounded-full px-2 py-0.5 text-xs ${getRoleBadgeColor(conv.userRole)}`}>
                                {conv.userRole}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-sm text-slate-600">{conv.lastMessage}</p>
                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                              <span>{formatTimeAgo(conv.lastMessageTime)}</span>
                              {conv.unreadCount > 0 && (
                                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-white">{conv.unreadCount}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          <section className={`${selectedUserId ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-1 flex-col bg-white`}>
            {selectedUser ? (
              <>
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedUserId(null)}
                      className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 md:hidden"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <button
                      onClick={() => handleViewProfile(String(selectedUser.id))}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 font-semibold text-white"
                    >
                      {selectedUser.name.charAt(0)}
                    </button>
                    <button onClick={() => handleViewProfile(String(selectedUser.id))} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-slate-900">{selectedUser.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${getRoleBadgeColor(selectedUser.role)}`}>
                          {selectedUser.role}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{selectedUser.email}</p>
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 px-5 py-6">
                  <div className="mx-auto flex max-w-3xl flex-col gap-4">
                    {selectedMessages.map(msg => {
                      const isCurrentUser = String(msg.senderId) === String(currentUser.id);
                      return (
                        <div key={msg.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xl ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div
                              className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                                isCurrentUser
                                  ? 'bg-blue-600 text-white'
                                  : 'border border-slate-200 bg-white text-slate-800'
                              }`}
                            >
                              {msg.content}
                            </div>
                            <p className={`mt-1 text-xs text-slate-400 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                              {formatTimeAgo(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white px-5 py-4">
                  <div className="mx-auto flex max-w-3xl gap-3">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message"
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                    <button
                      type="submit"
                      disabled={!messageText.trim() || isSending}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <Send size={16} />
                      <span>{isSending ? 'Sending...' : 'Send'}</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center bg-slate-50/40 p-8">
                <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                  <MessageSquare className="mx-auto mb-4 text-slate-400" size={36} />
                  <p className="text-lg font-semibold text-slate-900">Select a conversation</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Choose a contact from the list or search for a university user to begin messaging.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
};
