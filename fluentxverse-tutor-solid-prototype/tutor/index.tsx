import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal, render } from "solid-js/web";
import { cssStyle, Fragment } from "./utils/cssStyle";
import { Router, Route } from '@solidjs/router';
import { useLocation } from './routing';
import TutorIcon from "./Components/Common/TutorIcon";
import { ToastProvider } from './Components/Common/Toast';
import { withProtected, withCertified } from './Components/ProtectedRoute';
import { withVerifiedEmail } from './Components/EmailVerifiedRoute';
import { AuthProvider } from './context/AuthContext';
import SessionExpiryModal from './Components/SessionExpiryModal';
import { SessionExpiredModal } from './Components/Common/SessionExpiredModal';
import { OfflineBanner } from './Components/Common/OfflineBanner';
import AttendanceReminder from './Components/Common/AttendanceReminder';
import MobileHeader from './Components/Header/MobileHeader';
import { useAuthContext } from './context/AuthContext';
import { useThemeStore } from './context/ThemeContext';
import { useEmbeddedTheme } from './hooks/useEmbeddedTheme';
// Performance: Link prefetching on hover
import { lazyRoute } from '../../shared/ui/lazyRoute';
// Error handling
import ErrorBoundary from './Components/ErrorBoundary';
import "./assets/css/privacy-policy.css";
import "./assets/css/terms-of-service.css";
import "./assets/css/mobile-global.css";
import "./assets/css/app-theme.css";
import "./assets/css/tutor-design.css";
import '../../shared/ui/app-ui.css';
const Home = lazyRoute(() => import('./pages/Home'));
const HomeProtected = lazyRoute(() => import('./pages/HomeProtected'));
const SchedulePage = lazyRoute(() => import('./pages/SchedulePage'));
const StudentProfilePage = lazyRoute(() => import('./pages/StudentProfilePage'));
const ClassroomPage = lazyRoute(() => import('./pages/ClassroomPage'));
const ExamPage = lazyRoute(() => import('./pages/ExamPage'));
const SpeakingExamPage = lazyRoute(() => import('./pages/SpeakingExamPage'));
const InterviewBookingPage = lazyRoute(() => import('./pages/InterviewBookingPage'));
const InterviewRoomPage = lazyRoute(() => import('./pages/InterviewRoomPage'));
const NotificationsPage = lazyRoute(() => import('./pages/NotificationsPage'));
const MaterialsPage = lazyRoute(() => import('./pages/MaterialsPage'));
const DailyDispatchPage = lazyRoute(() => import('./pages/DailyDispatchPage'));
const DailyDispatchArticlePage = lazyRoute(() => import('./pages/DailyDispatchArticlePage'));
const DailyDispatchArchivePage = lazyRoute(() => import('./pages/DailyDispatchArchivePage'));
const ConversationalSkillsPage = lazyRoute(() => import('./pages/ConversationalSkillsPage'));
const ConversationalSkillsLessonPage = lazyRoute(() => import('./pages/ConversationalSkillsLessonPage'));
const BusinessEnglishPage = lazyRoute(() => import('./pages/BusinessEnglishPage'));
const BusinessEnglishPreviewPage = lazyRoute(() => import('./pages/BusinessEnglishPreviewPage'));
const LessonViewPage = lazyRoute(() => import('./pages/LessonViewPage'));
const InboxPage = lazyRoute(() => import('./pages/InboxPage'));
const KnowledgeBasePage = lazyRoute(() => import('./pages/KnowledgeBasePage'));
const MyProfilePage = lazyRoute(() => import('./pages/MyProfilePage'));
const PerformanceMetricsPage = lazyRoute(() => import('./pages/PerformanceMetricsPage'));
const YoungLearnersPage = lazyRoute(() => import('./pages/YoungLearnersPage'));
const YoungLearnersLessonPage = lazyRoute(() => import('./pages/YoungLearnersLessonPage'));
const RegisterPage = lazyRoute(() => import('./pages/RegisterPage'));
const ConfirmEmailPage = lazyRoute(() => import('./pages/ConfirmEmailPage'));
const ContactUsPage = lazyRoute(() => import('./pages/ContactUsPage'));
const AboutUsPage = lazyRoute(() => import('./pages/AboutUsPage'));
const BecomeTutorPage = lazyRoute(() => import('./pages/BecomeTutorPage'));
const PrivacyPolicy = lazyRoute(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazyRoute(() => import('./pages/TermsOfService'));
const NotFoundPage = lazyRoute(() => import('./pages/NotFoundPage'));
function AppShell(props: {
    children?: JSX.Element;
}) {
    const _state0 = useAuthContext();
    const _state1 = useLocation();
    const resolvedTheme = createMemo(() => useThemeStore((state) => state.resolvedTheme));
    const hydrateTheme = createMemo(() => useThemeStore((state) => state.hydrateTheme));
    const syncSystemTheme = createMemo(() => useThemeStore((state) => state.syncSystemTheme));
    const embeddedTheme = useEmbeddedTheme();
    const isLightOnlyPage = createMemo(() => _state1.path === '/' || /^\/(become-tutor|about|contact|register|confirm-email|privacy-policy|terms-of-service)\/?$/.test(_state1.path));
    const isStandalonePage = createMemo(() => /^\/(classroom\/|interview\/room|lesson\/view|conversation-mat\/|materials\/(?:daily-dispatch|conversational-skills|business-english|young-learners)\/)/.test(_state1.path));
    const effectiveTheme = createMemo(() => isLightOnlyPage() ? 'light' : (embeddedTheme() ?? resolvedTheme()));
    // Auth state for session modal
    // We'll read isAuthenticated via context inside the tree
    createEffect(on(() => [hydrateTheme()], () => {
        const _cleanup2 = untrack(() => {
            hydrateTheme()();
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    createEffect(on(() => [syncSystemTheme()], () => {
        const _cleanup3 = untrack(() => {
            if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
                return;
            }
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleSystemThemeChange = () => {
                syncSystemTheme()();
            };
            handleSystemThemeChange();
            if (typeof mediaQuery.addEventListener === 'function') {
                mediaQuery.addEventListener('change', handleSystemThemeChange);
                return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
            }
            mediaQuery.addListener(handleSystemThemeChange);
            return () => mediaQuery.removeListener(handleSystemThemeChange);
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    createEffect(on(() => [effectiveTheme()], () => {
        const _cleanup4 = untrack(() => {
            if (typeof document === 'undefined') {
                return;
            }
            const root = document.documentElement;
            const body = document.body;
            const isDarkTheme = effectiveTheme() === 'dark';
            const themeColorMeta = document.querySelector('meta[name="theme-color"]');
            const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
            root.dataset.theme = effectiveTheme();
            root.classList.toggle('dark-mode', isDarkTheme);
            root.style.colorScheme = effectiveTheme();
            if (body) {
                body.dataset.theme = effectiveTheme();
                body.classList.toggle('dark-mode', isDarkTheme);
            }
            if (themeColorMeta) {
                themeColorMeta.setAttribute('content', isDarkTheme ? '#081324' : '#0245ae');
            }
            if (colorSchemeMeta) {
                colorSchemeMeta.setAttribute('content', 'light dark');
            }
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    return (<div class={`App theme-${effectiveTheme()} ${isLightOnlyPage() ? 'tutor-public' : 'tutor-workspace'}`}>
				<button class="scroll-top scroll-to-target" data-target="html" aria-label="Scroll to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><TutorIcon name="fa-arrow-up"/></button>
						{/* Mobile Header for logged-in users */}
						{!isLightOnlyPage() && !isStandalonePage() && <MobileHeader />}
						<main>
							<OfflineBanner />
							<AttendanceReminder />
							{/* Session expiry warning modal visible when authenticated */}
                            <SessionExpiryModal isAuthenticated={_state0.isAuthenticated && !_state0.logoutLoading} autoRefresh={_state1.path.startsWith('/classroom/') || _state1.path.startsWith('/interview/room/')}/>
							{/* Session expired modal - shows when 401 received */}
							<SessionExpiredModal />
              {props.children}
                    </main>
            </div>);
}
export function AppInner() {
    return (<Router root={AppShell}>
						<Route path="/" component={Home}/>
					<Route path="/home" component={withVerifiedEmail(HomeProtected, true)}/>
					{/* Login page intentionally removed; login via modal */}
					<Route path="/register" component={RegisterPage}/>
                    <Route path="/confirm-email" component={ConfirmEmailPage}/>

					<Route path="/schedule" component={withCertified(SchedulePage)}/>
							{/* Material viewers require the same approval as the teaching workspace. */}
							<Route path="/lesson/view" component={withCertified(LessonViewPage)}/>
							<Route path="/lesson/:bookingId" component={withCertified(StudentProfilePage)}/>
							<Route path="/classroom/:sessionId" component={withCertified(ClassroomPage)}/>
							<Route path="/exam/written" component={withVerifiedEmail(ExamPage)}/>
							<Route path="/exam/speaking" component={withVerifiedEmail(SpeakingExamPage)}/>
							<Route path="/interview" component={withProtected(InterviewBookingPage)}/>
							<Route path="/interview/room/:interviewId?" component={withProtected(InterviewRoomPage)}/>
							<Route path="/notifications" component={withProtected(NotificationsPage)}/>
							<Route path="/materials" component={withCertified(MaterialsPage)}/>
							<Route path="/materials/daily-dispatch" component={withCertified(DailyDispatchPage)}/>
							<Route path="/materials/daily-dispatch/archives/:month" component={withCertified(DailyDispatchArchivePage)}/>
							<Route path="/materials/daily-dispatch/:id" component={withCertified(DailyDispatchArticlePage)}/>
							<Route path="/materials/conversational-skills" component={withCertified(ConversationalSkillsPage)}/>
							<Route path="/materials/conversational-skills/:id" component={withCertified(ConversationalSkillsLessonPage)}/>
							<Route path="/materials/business-english" component={withCertified(BusinessEnglishPage)}/>
							<Route path="/materials/business-english/:id" component={withCertified(BusinessEnglishPreviewPage)}/>
							<Route path="/materials/young-learners" component={withCertified(YoungLearnersPage)}/>
							<Route path="/materials/young-learners/lesson/:id" component={withCertified(YoungLearnersLessonPage)}/>
							<Route path="/conversation-mat/:level/:chapter/:goalSlug" component={withCertified(LessonViewPage)}/>
							<Route path="/inbox" component={withProtected(InboxPage)}/>
							<Route path="/knowledge-base/:slug?" component={withCertified(KnowledgeBasePage)}/>
							<Route path="/profile" component={withCertified(MyProfilePage)}/>
                            <Route path="/application/profile" component={withProtected(MyProfilePage)}/>
							<Route path="/performance-metrics" component={withCertified(PerformanceMetricsPage)}/>

							<Route path="/contact" component={ContactUsPage}/>
							<Route path="/about" component={AboutUsPage}/>
							<Route path="/become-tutor" component={BecomeTutorPage}/>

							<Route path="/privacy-policy" component={PrivacyPolicy}/>
							<Route path="/terms-of-service" component={TermsOfService}/>
							<Route path="*404" component={NotFoundPage}/>
						</Router>);
}
export function App() {
    return (<ToastProvider>
			<AuthProvider>
				<ErrorBoundary>
					<AppInner />
				</ErrorBoundary>
			</AuthProvider>
		</ToastProvider>);
}
if (typeof window !== 'undefined') {
    const appElement = document.getElementById('app');
    if (appElement)
        render(() => <App />, appElement);
}
