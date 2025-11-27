import { useEffect, useState, useCallback } from "preact/hooks";
import { LocationProvider, Router, Route, hydrate, prerender as ssr } from 'preact-iso';


import Home from './pages/Home';
import HomeProtected from './pages/HomeProtected';
import SchedulePage from './pages/SchedulePage';
import StudentProfilePage from './pages/StudentProfilePage';
import RegisterPage from './pages/RegisterPage';
import { AuthProvider } from './context/AuthContext';
import ContactPage from "./pages/ContactPage";

import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFoundPage from "./pages/NotFoundPage";


import "./assets/css/privacy-policy.css";
import "./assets/css/terms-of-service.css";



export function App() {
	const [menuActive, setMenuActive] = useState(false);

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
			<AuthProvider>
			<div className="App">
				<div className={`offcanvas-wrapper${menuActive ? " active" : ""}`}>
					{/* Offcanvas content */}
					<button className="menu-close"></button>
				</div>
				<div className={`offcanvas-overly${menuActive ? " active" : ""}`} />
				<LocationProvider>
					<main>
						<Router>
						<Route path="/" component={Home} />
						<Route path="/home" component={HomeProtected} />
						{/* Login page intentionally removed; login via modal */}
						<Route path="/register" component={RegisterPage} />
						<Route path="/schedule" component={SchedulePage} />
						<Route path="/student/:studentId" component={StudentProfilePage} />

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
			</AuthProvider>
	);
}

if (typeof window !== 'undefined') {
	const appElement = document.getElementById('app');
	if (appElement) {
		hydrate(<App />, appElement);
	}
}

if (typeof window !== 'undefined') {
	const appElement = document.getElementById('app');
	if (appElement) {
		hydrate(<App />, appElement);
	}
}

export async function prerender(data: any) {
	return await ssr(<App {...data} />);
}
