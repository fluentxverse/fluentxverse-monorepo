import { h } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Pages
import { BrowseTutorsPage } from './pages/BrowseTutorsPage';
import { TutorProfilePage } from './pages/TutorProfilePage';
import { StudentDashboard } from './pages/StudentDashboard';
import { ClassroomPage } from './pages/ClassroomPage';
import Home from './pages/Home';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';

// Components
import { withProtected } from './Components/ProtectedRoute';
import SessionExpiryModal from './Components/SessionExpiryModal';

// Import Socket.IO initialization
import { initSocket, connectSocket } from './client/socket/socket.client';

import './assets/css/style.css';

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LocationProvider>
          <AppContent />
        </LocationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  return (
    <main>
      <SessionExpiryModal isAuthenticated={false} />
      <Router>
        <Route path="/" component={Home} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/browse-tutors" component={BrowseTutorsPage} />
        <Route path="/tutor/:tutorId" component={TutorProfilePage} />
        <Route path="/dashboard" component={withProtected(StudentDashboard)} />
        <Route path="/classroom/:sessionId" component={withProtected(ClassroomPage)} />
        <Route path="/:404*" component={NotFoundPage} />
      </Router>
    </main>
  );
}
