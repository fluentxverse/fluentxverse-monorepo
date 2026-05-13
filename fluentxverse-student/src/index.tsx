import { useEffect, useState, useCallback } from "preact/hooks";
import { LocationProvider, Router, Route, hydrate, prerender as ssr, useLocation } from 'preact-iso';
import { ThirdwebProvider, useAutoConnect } from "thirdweb/react";

import Home from './pages/Home';
import HomeProtected from './pages/HomeProtected';
import SchedulePage from './pages/SchedulePage';
import StudentProfilePage from './pages/StudentProfilePage';
import ClassroomPage from './pages/ClassroomPage';
import LessonPage from './pages/LessonPage';
import { BrowseTutorsPage } from './pages/BrowseTutorsPage';
import { TutorProfilePage } from './pages/TutorProfilePage';
import MaterialsPage from './pages/MaterialsPage';
import DailyDispatchPage from './pages/DailyDispatchPage';
import DailyDispatchArticlePage from './pages/DailyDispatchArticlePage';
import DailyDispatchArchivePage from './pages/DailyDispatchArchivePage';
import ConversationalSkillsPage from './pages/ConversationalSkillsPage';
import ConversationalSkillsLessonPage from './pages/ConversationalSkillsLessonPage';
import BusinessEnglishPage from './pages/BusinessEnglishPage';
import YoungLearnersPage from './pages/YoungLearnersPage';
import YoungLearnersLessonPage from './pages/YoungLearnersLessonPage';
import LessonViewPage from './pages/LessonViewPage';
import TicketsPage from './pages/TicketsPage';
import PurchaseHistoryPage from './pages/PurchaseHistoryPage';
import InboxPage from './pages/InboxPage';
import { withProtected } from './Components/ProtectedRoute';
import RegisterPage from './pages/RegisterPage';
import { AuthProvider } from './context/AuthContext';
import ContactPage from "./pages/ContactPage";

// Import shared wallet config (prevents circular imports)
import { thirdwebClient, appWallet } from './config/wallet';

// Re-export for other components that import from index
export { thirdwebClient, appWallet };

import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFoundPage from "./pages/NotFoundPage";
import SessionExpiryModal from './Components/SessionExpiryModal';
import { useAuthContext } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { useThemeStore } from './context/ThemeContext';

// Performance: Link prefetching on hover
import { initPrefetching, prefetchCriticalRoutes } from './utils/prefetch';

// Error handling
import ErrorBoundary from './Components/ErrorBoundary';

import "./assets/css/privacy-policy.css";
import "./assets/css/terms-of-service.css";
import "./assets/css/app-theme.css";
import "./assets/css/scrollbar.css";

// Initialize prefetching after DOM ready
if (typeof window !== 'undefined') {
  initPrefetching();
  prefetchCriticalRoutes();
}



function AppShell() {
	const [menuActive, setMenuActive] = useState(false);
	const { isAuthenticated, initialLoading } = useAuthContext();
	const { path } = useLocation();
	const isDarkMode = useThemeStore((state) => state.isDarkMode);
	const isThemeLockedLight =
		path === '/' ||
		path === '/register' ||
		(path === '/browse-tutors' && !isAuthenticated && !initialLoading);
	const effectiveTheme = isThemeLockedLight ? 'light' : (isDarkMode ? 'dark' : 'light');
	
	// Auto-connect wallet if user has previously connected
	// This restores the wallet session on page reload
	const { data: autoConnected } = useAutoConnect({
		client: thirdwebClient,
		wallets: [appWallet],
		onConnect: (wallet) => {
		},
	});

	// Disconnect wallet if user is not authenticated (logged out)
	// This ensures wallet state stays in sync with auth state
	useEffect(() => {
		if (initialLoading) {
			return;
		}

		if (!isAuthenticated && autoConnected) {
			appWallet.disconnect().catch(err => {
				console.warn('Failed to disconnect wallet:', err);
			});
		}
	}, [initialLoading, isAuthenticated, autoConnected]);

	const handleClick = useCallback((e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.closest('.menu-trigger')) {
			e.preventDefault();
			setMenuActive(true);
		} else if (
			target.closest('.menu-close') ||
			target.closest('.offcanvas-overly')
		) {
			setMenuActive(false);
		}
	}, []);

	useEffect(() => {
		document.addEventListener('click', handleClick);
		return () => {
			document.removeEventListener('click', handleClick);
		};
	}, [handleClick]);

	useEffect(() => {
		if (typeof document === 'undefined') {
			return;
		}

		const root = document.documentElement;
		const body = document.body;
		const themeColorMeta = document.querySelector('meta[name="theme-color"]');
		const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
		const isDarkTheme = effectiveTheme === 'dark';

		root.dataset.theme = effectiveTheme;
		root.classList.toggle('dark-mode', isDarkTheme);
		root.style.colorScheme = effectiveTheme;

		if (body) {
			body.dataset.theme = effectiveTheme;
			body.classList.toggle('dark-mode', isDarkTheme);
		}

		if (themeColorMeta) {
			themeColorMeta.setAttribute('content', isDarkTheme ? '#1a1a1a' : '#0245ae');
		}

		if (colorSchemeMeta) {
			colorSchemeMeta.setAttribute('content', 'light dark');
		}
	}, [effectiveTheme, path]);

	    return (
		    <div className={`App theme-${effectiveTheme}`}>
				<div className={`offcanvas-wrapper${menuActive ? " active" : ""}`}>
					{/* Offcanvas content */}
					<button className="menu-close"></button>
				</div>
				<div className={`offcanvas-overly${menuActive ? " active" : ""}`} />
						<main>
							{/* Session expiry warning modal visible when authenticated */}
							<SessionExpiryModal isAuthenticated={isAuthenticated} />
						<Router>
						<Route path="/" component={Home} />
					<Route path="/home" component={withProtected(HomeProtected)} />
					{/* Login page intentionally removed; login via modal */}
					<Route path="/register" component={RegisterPage} />
					<Route path="/browse-tutors" component={BrowseTutorsPage} />
					<Route path="/tutor/:tutorId" component={TutorProfilePage} />
					<Route path="/schedule" component={withProtected(SchedulePage)} />
						<Route path="/materials" component={withProtected(MaterialsPage)} />
						<Route path="/materials/daily-dispatch" component={withProtected(DailyDispatchPage)} />
						<Route path="/materials/daily-dispatch/archives/:month" component={withProtected(DailyDispatchArchivePage)} />
						<Route path="/materials/daily-dispatch/:id" component={withProtected(DailyDispatchArticlePage)} />
						<Route path="/materials/business-english" component={withProtected(BusinessEnglishPage)} />
						<Route path="/materials/conversational-skills" component={withProtected(ConversationalSkillsPage)} />
						<Route path="/materials/conversational-skills/:id" component={ConversationalSkillsLessonPage} />
						<Route path="/young-learners" component={withProtected(YoungLearnersPage)} />
						<Route path="/young-learners/lesson/:id" component={YoungLearnersLessonPage} />
						{/* LessonViewPage handles its own loading - not wrapped in ProtectedRoute to avoid triple spinner */}
						<Route path="/lesson/view" component={LessonViewPage} />
						<Route path="/conversation-mat/:level/:chapter/:goalSlug" component={LessonViewPage} />
						<Route path="/tickets" component={withProtected(TicketsPage)} />
						<Route path="/purchase-history" component={withProtected(PurchaseHistoryPage)} />
						<Route path="/inbox" component={withProtected(InboxPage)} />
						<Route path="/profile" component={withProtected(StudentProfilePage)} />
						<Route path="/student/:studentId" component={withProtected(StudentProfilePage)} />
						<Route path="/lesson/:bookingId" component={withProtected(LessonPage)} />
							<Route path="/classroom/:sessionId" component={withProtected(ClassroomPage)} />

							<Route path="/contact" component={ContactPage} />

							<Route path="/privacy-policy" component={PrivacyPolicy} />
							<Route path="/terms-of-service" component={TermsOfService} />
							<Route path="/:404*" component={NotFoundPage} />
						</Router>
					</main>
			</div>
	);
}

export function AppInner() {
	return (
		<LocationProvider>
			<AppShell />
		</LocationProvider>
	);
}

export function App() {
	return (
		<ThirdwebProvider>
			{/* @ts-expect-error Preact/React type mismatch with thirdweb */}
			<AuthProvider>
				<ToastProvider>
					<ErrorBoundary>
						<AppInner />
					</ErrorBoundary>
				</ToastProvider>
			</AuthProvider>
		</ThirdwebProvider>
	);
}

if (typeof window !== 'undefined') {
	const appElement = document.getElementById('app');
	if (appElement) hydrate(<App />, appElement);
}

export async function prerender(data: any) {
	return await ssr(<App {...data} />);
}
