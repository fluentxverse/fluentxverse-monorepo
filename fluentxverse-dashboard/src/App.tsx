import { LocationProvider, Router, Route } from 'preact-iso';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import DashboardPage from './pages/DashboardPage';

export function App() {
  return (
    <LocationProvider>
      <div className="dashboard-layout">
        <Sidebar />
        <div className="dashboard-main">
          <Header />
          <main className="dashboard-content">
            <Router>
              <Route path="/" component={DashboardPage} />
            </Router>
          </main>
        </div>
      </div>
    </LocationProvider>
  );
}
