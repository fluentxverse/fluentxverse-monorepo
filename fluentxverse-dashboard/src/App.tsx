import { LocationProvider, Router, Route, useLocation } from 'preact-iso';
import { AuthProvider, useAuthContext } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';

import { Header } from './components/Header';
import DashboardPage from './pages/DashboardPage';
import InterviewSchedulePage from './pages/InterviewSchedulePage';
import InterviewRoomPage from './pages/InterviewRoomPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminsPage } from './pages/AdminsPage';
import TutorsPage from './pages/TutorsPage';
import StudentsPage from './pages/StudentsPage';
import ApplicationsPage from './pages/ApplicationsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import InboxPage from './pages/InboxPage';
import LoginPage from './pages/LoginPage';

// Loading spinner component
const LoadingScreen = () => (
  <div className="loading-screen">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
);

// Protected layout wrapper
const ProtectedLayout = ({ children }: { children: any }) => {
  const { isAuthenticated, loading } = useAuthContext();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main className="dashboard-content">
          {children}
        </main>
      </div>
    </div>
  );
};

// Main app content with routing
const AppContent = () => {
  const { isAuthenticated, loading } = useAuthContext();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  // Interview room is fullscreen, no sidebar/header
  const path = location.path || location.url || window.location.pathname;
  if (path.startsWith('/interview-room')) {
    if (!isAuthenticated) {
      return <LoginPage />;
    }
    return (
      <Router>
        <Route path="/interview-room/:interviewId?" component={InterviewRoomPage} />
      </Router>
    );
  }

  return (
    <ProtectedLayout>
      <Router>
        <Route path="/" component={DashboardPage} />
        <Route path="/interviews" component={InterviewSchedulePage} />
        <Route path="/applications" component={ApplicationsPage} />
        <Route path="/tutors" component={TutorsPage} />
        <Route path="/students" component={StudentsPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/inbox" component={InboxPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/admins" component={AdminsPage} />
      </Router>
    </ProtectedLayout>
  );
};

export function App() {
  return (
    <LocationProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LocationProvider>
  );
}
