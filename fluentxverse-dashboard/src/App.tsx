import { LocationProvider, Router, Route } from 'preact-iso';
import { AuthProvider, useAuthContext } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import DashboardPage from './pages/DashboardPage';
import InterviewSchedulePage from './pages/InterviewSchedulePage';
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
  return (
    <ProtectedLayout>
      <Router>
        <Route path="/" component={DashboardPage} />
        <Route path="/interviews" component={InterviewSchedulePage} />
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
