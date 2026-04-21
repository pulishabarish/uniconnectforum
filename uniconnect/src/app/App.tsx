import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { Header } from './components/Header.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { TopicDetailPage } from './pages/TopicDetailPage.tsx';
import { SubmitRequestPage } from './pages/SubmitRequestPage.tsx';
import { CreateTopicPage } from './pages/CreateTopicPage.tsx';
// import { AdminDashboard } from './pages/AdminDashboard.tsx';
import { AdminDashboard } from './pages/AdminDashboard.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { MessagesPage } from './pages/MessagesPage.tsx';
import { ClassesPage } from './pages/ClassesPage.tsx';
import { ClassDetailPage } from './pages/ClassDetailPage.tsx';
import { UserManagementPage } from './pages/UserManagementPage.tsx';
import { Toaster } from './components/ui/sonner.tsx';

// UniConnect - University Discussion Forum
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp();
  
  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const FacultyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp();
  
  if (!currentUser || (currentUser.role !== 'faculty' && currentUser.role !== 'admin')) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const StudentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp();
  
  if (!currentUser || currentUser.role !== 'student') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { currentUser } = useApp();

  return (
    <div className="app-shell">
      <Header />
      <Routes>
        <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/topic/:topicId"
          element={
            <ProtectedRoute>
              <TopicDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/submit-request"
          element={
            <StudentRoute>
              <SubmitRequestPage />
            </StudentRoute>
          }
        />
        <Route
          path="/create-topic"
          element={
            <FacultyRoute>
              <CreateTopicPage />
            </FacultyRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes"
          element={
            <ProtectedRoute>
              <ClassesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/class/:classId"
          element={
            <ProtectedRoute>
              <ClassDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-management"
          element={
            <AdminRoute>
              <UserManagementPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </BrowserRouter>
  );
}
