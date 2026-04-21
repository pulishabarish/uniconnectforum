import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Search, Users, GraduationCap, Clock, CheckCircle, XCircle, ArrowLeft, Calendar, MapPin, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { formatTimeAgo } from '../utils/helpers.ts';
import type { Class, ClassJoinRequest } from '../types';

const API_BASE = 'https://uniconnectforum.onrender.com/api';

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

const mapJoinRequest = (item: any): ClassJoinRequest => ({
  id: String(item.id),
  classId: String(item.classId),
  className: item.className,
  classCode: item.classCode,
  studentId: String(item.studentId),
  studentName: item.studentName,
  studentEmail: item.studentEmail,
  status: item.status,
  submittedAt: new Date(item.submittedAt),
  reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : undefined,
});

export const ClassesPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const semesterOptions = [`Spring ${currentYear}`, `Fall ${currentYear}`];
  const deliveryModeOptions: Array<{ value: 'online' | 'offline' | 'hybrid'; label: string }> = [
    { value: 'offline', label: 'Offline' },
    { value: 'online', label: 'Online' },
    { value: 'hybrid', label: 'Hybrid' },
  ];
  const startTimeOptions = [
    '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
    '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
    '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM'
  ];
  const endTimeOptions = [
    '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM',
    '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM',
    '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM',
    '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM'
  ];

  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [classes, setClasses] = useState<Class[]>([]);
  const [classJoinRequests, setClassJoinRequests] = useState<ClassJoinRequest[]>([]);
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateClassForm, setShowCreateClassForm] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [className, setClassName] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedSemester, setSelectedSemester] = useState(`Spring ${currentYear}`);
  const [deliveryMode, setDeliveryMode] = useState<'online' | 'offline' | 'hybrid'>('offline');
  const [classLocation, setClassLocation] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadClasses = useCallback(async () => {
    if (!currentUser) return;

    try {
      const res = await fetch(`${API_BASE}/classes/?user_id=${currentUser.id}`);
      const data = await res.json();
      setClasses(Array.isArray(data) ? data.map(mapClass) : []);
    } catch (error) {
      console.error('LOAD CLASSES ERROR:', error);
      setErrorMessage('Could not load classes right now.');
    }
  }, [currentUser]);

  const loadJoinRequests = useCallback(async () => {
    if (!currentUser) return;

    try {
      const params = new URLSearchParams({
        user_id: currentUser.id,
        role: currentUser.role,
      });
      const res = await fetch(`${API_BASE}/class-join-requests/?${params.toString()}`);
      const data = await res.json();
      setClassJoinRequests(Array.isArray(data) ? data.map(mapJoinRequest) : []);
    } catch (error) {
      console.error('LOAD CLASS JOIN REQUESTS ERROR:', error);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    loadClasses();
    loadJoinRequests();
  }, [currentUser, navigate, loadClasses, loadJoinRequests]);

  if (!currentUser) {
    return null;
  }

  const myClasses = currentUser.role === 'faculty'
    ? classes.filter(c => c.instructorId === String(currentUser.id))
    : classes.filter(c => c.isEnrolled);

  const availableClasses = classes.filter(c =>
    currentUser.role === 'student' &&
    !c.isEnrolled &&
    c.instructorId !== String(currentUser.id)
  );

  const filteredAvailableClasses = availableClasses.filter(c =>
    searchQuery === '' ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.instructorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myJoinRequests = currentUser.role === 'student'
    ? classJoinRequests.filter(r => r.studentId === String(currentUser.id))
    : [];

  const pendingJoinRequests = currentUser.role === 'faculty'
    ? classJoinRequests.filter(r => r.status === 'pending')
    : [];

  const refreshPageData = async () => {
    await Promise.all([loadClasses(), loadJoinRequests()]);
  };

  const handleRequestJoin = async (classId: string) => {
    setErrorMessage('');
    setStatusMessage('');

    try {
      const res = await fetch(`${API_BASE}/submit-class-join-request/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: classId,
          user_id: currentUser.id,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Could not submit class join request.');
        return;
      }

      setStatusMessage('Class join request sent to faculty.');
      await refreshPageData();
    } catch (error) {
      console.error('REQUEST JOIN CLASS ERROR:', error);
      setErrorMessage('Could not submit class join request.');
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const res = await fetch(`${API_BASE}/approve-class-join-request/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Could not approve class request.');
        return;
      }

      setStatusMessage('Student added to class.');
      await refreshPageData();
    } catch (error) {
      console.error('APPROVE CLASS REQUEST ERROR:', error);
      setErrorMessage('Could not approve class request.');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const res = await fetch(`${API_BASE}/reject-class-join-request/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Could not reject class request.');
        return;
      }

      setStatusMessage('Class join request rejected.');
      await refreshPageData();
    } catch (error) {
      console.error('REJECT CLASS REQUEST ERROR:', error);
      setErrorMessage('Could not reject class request.');
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    if (currentUser.role !== 'faculty') return;
    if (
      !classCode.trim() ||
      !className.trim() ||
      selectedDays.length === 0 ||
      !startTime ||
      !endTime ||
      !classLocation.trim()
    ) {
      return;
    }

    const classTime = `${startTime} - ${endTime}`;

    try {
      const res = await fetch(`${API_BASE}/create-class/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          code: classCode.trim(),
          name: className.trim(),
          time: classTime.trim(),
          location: classLocation.trim(),
          delivery_mode: deliveryMode,
          department: currentUser.department || 'General',
          semester: selectedSemester,
          description: `${className.trim()} created by ${currentUser.name}`,
          days: selectedDays,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Could not create class.');
        return;
      }

      setClassCode('');
      setClassName('');
      setSelectedDays([]);
      setStartTime('');
      setEndTime('');
      setSelectedSemester(`Spring ${currentYear}`);
      setDeliveryMode('offline');
      setClassLocation('');
      setShowCreateClassForm(false);
      setStatusMessage('Class created successfully.');
      await refreshPageData();
    } catch (error) {
      console.error('CREATE CLASS ERROR:', error);
      setErrorMessage('Could not create class.');
    }
  };

  const toggleDaySelection = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(selectedDay => selectedDay !== day)
        : [...prev, day]
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <button
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        <span>Return to Discussion Feed</span>
      </button>

      <section className="university-panel p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Academic Spaces</p>
        <h1 className="mt-3 university-section-title">
          {currentUser.role === 'faculty' ? 'My Classes' : 'My Enrolled Classes'}
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {currentUser.role === 'faculty'
            ? 'Manage the classes you teach, review student requests, and start course discussions.'
            : 'Review your enrolled classes, track join requests, and access course discussions from one place.'}
        </p>
      </section>

      {errorMessage && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {statusMessage && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {statusMessage}
        </div>
      )}

      {currentUser.role === 'faculty' && (
        <section className="university-panel mt-6 p-6">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Create a Class</h2>
              <p className="mt-1 text-sm leading-7 text-slate-600">
                Add a class so students can find it and request to join.
              </p>
            </div>
            <button
              onClick={() => setShowCreateClassForm(!showCreateClassForm)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus size={16} />
              {showCreateClassForm ? 'Close Form' : 'New Class'}
            </button>
          </div>

          {showCreateClassForm && (
            <form onSubmit={handleCreateClass} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Class Code</label>
                <input
                  type="text"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  placeholder="e.g. CS-698"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Subject Name</label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Database Systems"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Semester</label>
                    <select
                      value={selectedSemester}
                      onChange={(e) => setSelectedSemester(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                      required
                    >
                      {semesterOptions.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Class Mode</label>
                    <select
                      value={deliveryMode}
                      onChange={(e) => setDeliveryMode(e.target.value as 'online' | 'offline' | 'hybrid')}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                      required
                    >
                      {deliveryModeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Class Days</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                  {dayOptions.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDaySelection(day)}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        selectedDays.includes(day)
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Class Time</label>
                <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start Time</label>
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                      required
                    >
                      <option value="">Select start time</option>
                      {startTimeOptions.map(time => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="hidden items-center justify-center pb-3 text-sm font-semibold text-slate-400 md:flex">
                    to
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">End Time</label>
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                      required
                    >
                      <option value="">Select end time</option>
                      {endTimeOptions.map(time => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  {deliveryMode === 'online' ? 'Meeting Link / Platform' : 'Class Area'}
                </label>
                <input
                  type="text"
                  value={classLocation}
                  onChange={(e) => setClassLocation(e.target.value)}
                  placeholder={deliveryMode === 'online' ? 'e.g. Zoom / Teams / LMS link' : 'e.g. Room 210, CS Building'}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  required
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row md:col-span-2">
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Create Class
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateClassForm(false)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {currentUser.role === 'faculty' && pendingJoinRequests.length > 0 && (
        <section className="university-panel mt-6 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Clock className="text-blue-600" size={20} />
            Pending Join Requests
          </h2>
          <div className="space-y-3">
            {pendingJoinRequests.map(request => (
              <div key={request.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{request.studentName}</p>
                  <p className="text-sm text-slate-600">{request.studentEmail}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {request.classCode} - {request.className}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Requested {formatTimeAgo(request.submittedAt)}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    onClick={() => handleApproveRequest(request.id)}
                    className="inline-flex items-center gap-1 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                  >
                    <CheckCircle size={16} />
                    Approve
                  </button>
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {currentUser.role === 'faculty' ? 'Teaching Schedule' : 'Current Classes'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {currentUser.role === 'faculty' ? 'Your active teaching spaces for the term.' : 'Classes you can open right away for discussions and updates.'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {myClasses.map(classItem => (
          <div
            key={classItem.id}
            onClick={() => navigate(`/class/${classItem.id}`)}
            className="university-panel cursor-pointer p-6 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                  <BookOpen className="text-blue-600" size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-700">{classItem.code}</p>
                  <h3 className="text-xl font-semibold text-slate-900">{classItem.name}</h3>
                </div>
              </div>
            </div>

            <p className="mb-4 text-sm leading-7 text-slate-600 line-clamp-2">{classItem.description}</p>

            <div className="mb-4 space-y-2">
              {classItem.deliveryMode && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <BookOpen size={16} className="text-slate-400" />
                  <span className="capitalize">{classItem.deliveryMode}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar size={16} className="text-slate-400" />
                <span>{classItem.days.join(', ')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock size={16} className="text-slate-400" />
                <span>{classItem.time}</span>
              </div>
              {classItem.location && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin size={16} className="text-slate-400" />
                  <span>{classItem.location}</span>
                </div>
              )}
            </div>

            <div className="mb-4 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-slate-500">
                <GraduationCap size={16} />
                <span>{classItem.instructorName}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Users size={16} />
                <span>{classItem.enrolledCount ?? classItem.enrolledStudents.length} students</span>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{classItem.semester} • {classItem.department}</p>
            </div>
          </div>
        ))}

        {myClasses.length === 0 && (
          <div className="university-panel col-span-full p-12 text-center">
            <BookOpen className="mx-auto mb-3 text-slate-400" size={48} />
            <p className="font-medium text-slate-700">
              {currentUser.role === 'faculty' ? 'No classes assigned yet' : 'Not enrolled in any classes yet'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {currentUser.role === 'student' && 'Browse available classes below'}
            </p>
          </div>
        )}
        </div>
      </section>

      {currentUser.role === 'student' && (
        <>
          {myJoinRequests.length > 0 && (
            <section className="university-panel mt-6 p-6">
              <h2 className="mb-4 text-2xl font-semibold text-slate-900">My Join Requests</h2>
              <div className="space-y-3">
                {myJoinRequests.map(request => (
                  <div key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{request.classCode} - {request.className}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Submitted {formatTimeAgo(request.submittedAt)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        request.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : request.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                      }`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mb-4 mt-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">Available Classes</h2>
            <button
              onClick={() => setShowAllClasses(!showAllClasses)}
              className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              {showAllClasses ? 'Show Less' : 'Show All'}
            </button>
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search by class name, code, department, or instructor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {(showAllClasses ? filteredAvailableClasses : filteredAvailableClasses.slice(0, 4)).map(classItem => {
              const requestForClass = myJoinRequests.find(r => r.classId === classItem.id);
              const hasPendingRequest = requestForClass?.status === 'pending' || classItem.hasPendingRequest;
              const hasApprovedRequest = requestForClass?.status === 'approved';

              return (
                <div key={classItem.id} className="university-panel p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                        <BookOpen className="text-blue-600" size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-blue-700">{classItem.code}</p>
                        <h3 className="text-xl font-semibold text-slate-900">{classItem.name}</h3>
                      </div>
                    </div>
                  </div>

                  <p className="mb-4 text-sm leading-7 text-slate-600 line-clamp-2">{classItem.description}</p>

                  <div className="mb-4 space-y-2">
                    {classItem.deliveryMode && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <BookOpen size={16} className="text-slate-400" />
                        <span className="capitalize">{classItem.deliveryMode}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar size={16} className="text-slate-400" />
                      <span>{classItem.days.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock size={16} className="text-slate-400" />
                      <span>{classItem.time}</span>
                    </div>
                    {classItem.location && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin size={16} className="text-slate-400" />
                        <span>{classItem.location}</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-4 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-slate-500">
                      <GraduationCap size={16} />
                      <span>{classItem.instructorName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <Users size={16} />
                      <span>{classItem.enrolledCount ?? classItem.enrolledStudents.length} students</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRequestJoin(classItem.id)}
                    disabled={hasPendingRequest || hasApprovedRequest}
                    className={`w-full rounded-xl py-3 text-sm font-semibold transition-colors ${
                      hasPendingRequest
                        ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed'
                        : hasApprovedRequest
                          ? 'bg-green-100 text-green-700 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {hasPendingRequest
                      ? 'Request Pending'
                      : hasApprovedRequest
                        ? 'Already Enrolled'
                        : 'Request to Join'}
                  </button>

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{classItem.semester} • {classItem.department}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
