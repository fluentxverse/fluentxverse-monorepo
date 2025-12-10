import { useEffect, useState, useCallback } from "preact/hooks";
import { LocationProvider, Router, Route, hydrate, prerender as ssr } from 'preact-iso';


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
import InboxPage from './pages/InboxPage';

import { withProtected, withCertified } from './Components/ProtectedRoute';
import RegisterPage from './pages/RegisterPage';
import { AuthProvider } from './context/AuthContext';
import ContactUsPage from "./pages/ContactUsPage";

import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFoundPage from "./pages/NotFoundPage";
import SessionExpiryModal from './Components/SessionExpiryModal';
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
							{/* Session expiry warning modal visible when authenticated */}
							<SessionExpiryModal isAuthenticated={isAuthenticated} />
						<Router>
						<Route path="/" component={Home} />
					<Route path="/home" component={withProtected(HomeProtected)} />
					{/* Login page intentionally removed; login via modal */}
					<Route path="/register" component={RegisterPage} />

					<Route path="/schedule" component={withCertified(SchedulePage)} />
						<Route path="/student/:studentId" component={withCertified(StudentProfilePage)} />
							<Route path="/classroom/:sessionId" component={withCertified(ClassroomPage)} />
							<Route path="/exam/written" component={withProtected(ExamPage)} />
							<Route path="/exam/speaking" component={withProtected(SpeakingExamPage)} />
							<Route path="/interview" component={withProtected(InterviewBookingPage)} />
							<Route path="/interview/room/:interviewId?" component={withProtected(InterviewRoomPage)} />
							<Route path="/notifications" component={withProtected(NotificationsPage)} />
							<Route path="/materials" component={withProtected(MaterialsPage)} />
							<Route path="/inbox" component={withProtected(InboxPage)} />

							<Route path="/contact" component={ContactUsPage} />

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
		<AuthProvider>
			<AppInner />
		</AuthProvider>
	);
}

if (typeof window !== 'undefined') {
	const appElement = document.getElementById('app');
	if (appElement) hydrate(<App />, appElement);
}

export async function prerender(data: any) {
	return await ssr(<App {...data} />);
}
