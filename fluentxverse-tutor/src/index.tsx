import { useEffect, useState, useCallback } from "preact/hooks";
import { LocationProvider, Router, Route, hydrate, prerender as ssr } from 'preact-iso';

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
import ConversationalSkillsPage from './pages/ConversationalSkillsPage';
import InboxPage from './pages/InboxPage';
import MyProfilePage from "./pages/MyProfilePage";
import PerformanceMetricsPage from "./pages/PerformanceMetricsPage";

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


import "./assets/css/privacy-policy.css";
import "./assets/css/terms-of-service.css";
import "./assets/css/mobile-global.css";
import "./assets/css/force-light-mode.css";



export function AppInner() {
	const [menuActive, setMenuActive] = useState(false);
	const { isAuthenticated } = useAuthContext();
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

	    return (
		    <div className="App">
				<div className={`offcanvas-wrapper${menuActive ? " active" : ""}`}>
					{/* Offcanvas content */}
					<button className="menu-close"></button>
				</div>
				<div className={`offcanvas-overly${menuActive ? " active" : ""}`} />
					<LocationProvider>
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
						<Route path="/lesson/:bookingId" component={withCertified(StudentProfilePage)} />
							<Route path="/classroom/:sessionId" component={withCertified(ClassroomPage)} />
							<Route path="/exam/written" component={withProtected(ExamPage)} />
							<Route path="/exam/speaking" component={withProtected(SpeakingExamPage)} />
							<Route path="/interview" component={withProtected(InterviewBookingPage)} />
							<Route path="/interview/room/:interviewId?" component={withProtected(InterviewRoomPage)} />
							<Route path="/notifications" component={withProtected(NotificationsPage)} />
							<Route path="/materials" component={withProtected(MaterialsPage)} />
							<Route path="/materials/conversational-skills" component={withProtected(ConversationalSkillsPage)} />
							<Route path="/inbox" component={withProtected(InboxPage)} />
							<Route path="/profile" component={withProtected(MyProfilePage)} />
							<Route path="/performance-metrics" component={withProtected(PerformanceMetricsPage)} />

							<Route path="/contact" component={ContactUsPage} />
							<Route path="/about" component={AboutUsPage} />
							<Route path="/become-tutor" component={BecomeTutorPage} />

							{/* <Route path="/blog" component={Blog} />
							<Route path="/blog-details" component={BlogDetails} /> */}
							<Route path="/privacy-policy" component={PrivacyPolicy} />
							<Route path="/terms-of-service" component={TermsOfService} />
							<Route path="/:404*" component={NotFoundPage} />
						</Router>
					</main>
			</LocationProvider>
			</div>
	);
}

export function App() {
	return (
		<ToastProvider>
			<AuthProvider>
				<AppInner />
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
