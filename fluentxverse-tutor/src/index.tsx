import { useEffect, useState, useCallback } from "preact/hooks";
import { LocationProvider, Router, Route, hydrate, prerender as ssr, useLocation } from 'preact-iso';

import { ToastProvider } from './Components/Common/Toast';
import Home from './pages/Home';
import HomeProtected from './pages/HomeProtected';
import SchedulePage from './pages/SchedulePage';
import StudentProfilePage from './pages/StudentProfilePage';
import ClassroomPage from './pages/ClassroomPage';
import ExamPage from './pages/ExamPage';
import SpeakingExamPage from './pages/SpeakingExamPage';
import InterviewBookingPage from './pages/InterviewBookingPage';
import InterviewRoomPage from './pages/InterviewRoomPage';
import NotificationsPage from './pages/NotificationsPage';
import MaterialsPage from './pages/MaterialsPage';
import DailyDispatchPage from './pages/DailyDispatchPage';
import DailyDispatchArticlePage from './pages/DailyDispatchArticlePage';
import DailyDispatchArchivePage from './pages/DailyDispatchArchivePage';
import ConversationalSkillsPage from './pages/ConversationalSkillsPage';
import ConversationalSkillsLessonPage from './pages/ConversationalSkillsLessonPage';
import BusinessEnglishPreviewPage from './pages/BusinessEnglishPreviewPage';
import LessonViewPage from './pages/LessonViewPage';
import InboxPage from './pages/InboxPage';
import MyProfilePage from "./pages/MyProfilePage";
import PerformanceMetricsPage from "./pages/PerformanceMetricsPage";
import YoungLearnersPage from './pages/YoungLearnersPage';
import YoungLearnersLessonPage from './pages/YoungLearnersLessonPage';

import { withProtected, withCertified } from './Components/ProtectedRoute';
import RegisterPage from './pages/RegisterPage';
import { AuthProvider } from './context/AuthContext';
import ContactUsPage from "./pages/ContactUsPage";
import AboutUsPage from "./pages/AboutUsPage";
import BecomeTutorPage from "./pages/BecomeTutorPage";

import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFoundPage from "./pages/NotFoundPage";
import SessionExpiryModal from './Components/SessionExpiryModal';
import { SessionExpiredModal } from './Components/Common/SessionExpiredModal';
import { OfflineBanner } from './Components/Common/OfflineBanner';
import MobileHeader from './Components/Header/MobileHeader';
import { useAuthContext } from './context/AuthContext';
import { useThemeStore } from './context/ThemeContext';

// Performance: Link prefetching on hover
import { initPrefetching, prefetchCriticalRoutes } from './utils/prefetch';

// Error handling
import ErrorBoundary from './Components/ErrorBoundary';

import "./assets/css/privacy-policy.css";
import "./assets/css/terms-of-service.css";
import "./assets/css/mobile-global.css";
import "./assets/css/app-theme.css";

// Initialize prefetching after DOM ready
if (typeof window !== 'undefined') {
	initPrefetching();
	prefetchCriticalRoutes();
}


function AppShell() {
	const [menuActive, setMenuActive] = useState(false);
	const { isAuthenticated } = useAuthContext();
	const { path } = useLocation();
	const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
	const hydrateTheme = useThemeStore((state) => state.hydrateTheme);
	const syncSystemTheme = useThemeStore((state) => state.syncSystemTheme);
	const effectiveTheme = path === '/' ? 'light' : resolvedTheme;
	// Auth state for session modal
	// We'll read isAuthenticated via context inside the tree

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
		hydrateTheme();
	}, [hydrateTheme]);

	useEffect(() => {
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
			return;
		}

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleSystemThemeChange = () => {
			syncSystemTheme();
		};

		handleSystemThemeChange();

		if (typeof mediaQuery.addEventListener === 'function') {
			mediaQuery.addEventListener('change', handleSystemThemeChange);
			return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
		}

		mediaQuery.addListener(handleSystemThemeChange);
		return () => mediaQuery.removeListener(handleSystemThemeChange);
	}, [syncSystemTheme]);

	useEffect(() => {
		if (typeof document === 'undefined') {
			return;
		}

		const root = document.documentElement;
		const body = document.body;
		const isDarkTheme = effectiveTheme === 'dark';
		const themeColorMeta = document.querySelector('meta[name="theme-color"]');
		const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');

		root.dataset.theme = effectiveTheme;
		root.classList.toggle('dark-mode', isDarkTheme);
		root.style.colorScheme = effectiveTheme;

		if (body) {
			body.dataset.theme = effectiveTheme;
			body.classList.toggle('dark-mode', isDarkTheme);
		}

		if (themeColorMeta) {
			themeColorMeta.setAttribute('content', isDarkTheme ? '#081324' : '#0245ae');
		}

		if (colorSchemeMeta) {
			colorSchemeMeta.setAttribute('content', 'light dark');
		}
	}, [effectiveTheme]);

	    return (
		    <div className={`App theme-${effectiveTheme}`}>
				<div className={`offcanvas-wrapper${menuActive ? " active" : ""}`}>
					{/* Offcanvas content */}
					<button className="menu-close"></button>
				</div>
				<div className={`offcanvas-overly${menuActive ? " active" : ""}`} />
						{/* Mobile Header for logged-in users */}
						<MobileHeader />
						<main>
							<OfflineBanner />
							{/* Session expiry warning modal visible when authenticated */}
							<SessionExpiryModal isAuthenticated={isAuthenticated} />
							{/* Session expired modal - shows when 401 received */}
							<SessionExpiredModal />
						<Router>
						<Route path="/" component={Home} />
					<Route path="/home" component={withProtected(HomeProtected)} />
					{/* Login page intentionally removed; login via modal */}
					<Route path="/register" component={RegisterPage} />

					<Route path="/schedule" component={withCertified(SchedulePage)} />
							{/* LessonViewPage handles its own loading - not wrapped to avoid triple spinner */}
							<Route path="/lesson/view" component={LessonViewPage} />
							<Route path="/lesson/:bookingId" component={withCertified(StudentProfilePage)} />
							<Route path="/classroom/:sessionId" component={withCertified(ClassroomPage)} />
							<Route path="/exam/written" component={withProtected(ExamPage)} />
							<Route path="/exam/speaking" component={withProtected(SpeakingExamPage)} />
							<Route path="/interview" component={withProtected(InterviewBookingPage)} />
							<Route path="/interview/room/:interviewId?" component={withProtected(InterviewRoomPage)} />
							<Route path="/notifications" component={withProtected(NotificationsPage)} />
							<Route path="/materials" component={withProtected(MaterialsPage)} />
							<Route path="/materials/daily-dispatch" component={withProtected(DailyDispatchPage)} />
							<Route path="/materials/daily-dispatch/archives/:month" component={withProtected(DailyDispatchArchivePage)} />
							<Route path="/materials/daily-dispatch/:id" component={withProtected(DailyDispatchArticlePage)} />
							<Route path="/materials/conversational-skills" component={withProtected(ConversationalSkillsPage)} />
							<Route path="/materials/conversational-skills/:id" component={withProtected(ConversationalSkillsLessonPage)} />
							<Route path="/materials/business-english/:id" component={withProtected(BusinessEnglishPreviewPage)} />
							<Route path="/materials/young-learners" component={withProtected(YoungLearnersPage)} />
							<Route path="/materials/young-learners/lesson/:id" component={withProtected(YoungLearnersLessonPage)} />
							<Route path="/conversation-mat/:level/:chapter/:goalSlug" component={LessonViewPage} />
							<Route path="/inbox" component={withProtected(InboxPage)} />
							<Route path="/profile" component={withProtected(MyProfilePage)} />
							<Route path="/performance-metrics" component={withProtected(PerformanceMetricsPage)} />

							<Route path="/contact" component={ContactUsPage} />
							<Route path="/about" component={AboutUsPage} />
							<Route path="/become-tutor" component={BecomeTutorPage} />

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
		<ToastProvider>
			<AuthProvider>
				<ErrorBoundary>
					<AppInner />
				</ErrorBoundary>
			</AuthProvider>
		</ToastProvider>
	);
}

if (typeof window !== 'undefined') {
	const appElement = document.getElementById('app');
	if (appElement) hydrate(<App />, appElement);
}

export async function prerender(data: any) {
	return await ssr(<App {...data} />);
}
