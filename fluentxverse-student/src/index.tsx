import { useEffect, useState, useCallback } from "preact/hooks";
import { LocationProvider, Router, Route, hydrate, prerender as ssr } from 'preact-iso';
import { createThirdwebClient } from "thirdweb";
import { ThirdwebProvider } from "thirdweb/react";

import Home from './pages/Home';
import HomeProtected from './pages/HomeProtected';
import SchedulePage from './pages/SchedulePage';
import StudentProfilePage from './pages/StudentProfilePage';
import ClassroomPage from './pages/ClassroomPage';
import LessonPage from './pages/LessonPage';
import { BrowseTutorsPage } from './pages/BrowseTutorsPage';
import { TutorProfilePage } from './pages/TutorProfilePage';
import MaterialsPage from './pages/MaterialsPage';
import TicketsPage from './pages/TicketsPage';
import InboxPage from './pages/InboxPage';
import { withProtected } from './Components/ProtectedRoute';
import RegisterPage from './pages/RegisterPage';
import { AuthProvider } from './context/AuthContext';
import ContactPage from "./pages/ContactPage";

export const thirdwebClient = createThirdwebClient({
	clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || "your-client-id"
});

import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFoundPage from "./pages/NotFoundPage";
import SessionExpiryModal from './Components/SessionExpiryModal';
import { useAuthContext } from './context/AuthContext';


import "./assets/css/privacy-policy.css";
import "./assets/css/terms-of-service.css";
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
						<Route path="/tickets" component={withProtected(TicketsPage)} />
						<Route path="/inbox" component={withProtected(InboxPage)} />
						<Route path="/student/:studentId" component={withProtected(StudentProfilePage)} />
						<Route path="/lesson/:bookingId" component={withProtected(LessonPage)} />
							<Route path="/classroom/:sessionId" component={withProtected(ClassroomPage)} />

							<Route path="/contact" component={ContactPage} />

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
		<ThirdwebProvider>
			{/* @ts-expect-error Preact/React type mismatch with thirdweb */}
			<AuthProvider>
				<AppInner />
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
