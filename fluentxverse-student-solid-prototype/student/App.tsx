import { createEffect, createMemo, lazy, onMount, onCleanup, Suspense, type ParentProps } from 'solid-js';
import { Router, Route, Navigate, useLocation, useParams } from '@solidjs/router';
import { TICKETING_VISIBLE } from './config/launch';
import { AuthProvider, useAuthContext } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { PrivyIntegrationProvider } from './context/PrivyContext';
import { useThemeStore } from './context/ThemeContext';
import { useEmbeddedTheme } from './hooks/useEmbeddedTheme';
import { withProtected } from './Components/ProtectedRoute';
import ErrorBoundary from './Components/ErrorBoundary';
import SessionExpiredModal from './Components/Common/SessionExpiredModal';
import SessionExpiryModal from './Components/SessionExpiryModal';
import LoadingSpinner from './Components/LoadingSpinner';
import './assets/css/privacy-policy.css';
import './assets/css/terms-of-service.css';
import './assets/css/app-theme.css';
import './assets/css/scrollbar.css';
import './assets/css/student-secondary.css';

const page = (load: () => Promise<{ default: any }>) => {
  const Page = lazy(load);
  // Keep route failures below the persistent shell and router lifecycle.
  const RoutePage = (props: Record<string, unknown>) => <ErrorBoundary><Page {...props} /></ErrorBoundary>;
  return Object.assign(RoutePage, { preload: Page.preload });
};
const Home = page(() => import('./pages/Home'));
const HomeProtected = page(() => import('./pages/HomeProtected'));
const Schedule = page(() => import('./pages/SchedulePage'));
const Profile = page(() => import('./pages/StudentProfilePage'));
const Classroom = page(() => import('./pages/ClassroomPage'));
const Lesson = page(() => import('./pages/LessonPage'));
const Browse = page(() => import('./pages/BrowseTutorsPage').then(module => ({ default: module.BrowseTutorsPage })));
const Tutor = page(() => import('./pages/TutorProfilePage').then(module => ({ default: module.TutorProfilePage })));
const Materials = page(() => import('./pages/MaterialsPage'));
const Dispatch = page(() => import('./pages/DailyDispatchPage'));
const Article = page(() => import('./pages/DailyDispatchArticlePage'));
const Archive = page(() => import('./pages/DailyDispatchArchivePage'));
const Business = page(() => import('./pages/BusinessEnglishPage'));
const Conversation = page(() => import('./pages/ConversationalSkillsPage'));
const ConversationLesson = page(() => import('./pages/ConversationalSkillsLessonPage'));
const Young = page(() => import('./pages/YoungLearnersPage'));
const YoungLesson = page(() => import('./pages/YoungLearnersLessonPage'));
const LessonView = page(() => import('./pages/LessonViewPage'));
const Tickets = page(() => import('./pages/TicketsPage'));
const Purchases = page(() => import('./pages/PurchaseHistoryPage'));
const Reviews = page(() => import('./pages/AnonymousReviewsPage'));
const Inbox = page(() => import('./pages/InboxPage'));
const Register = page(() => import('./pages/RegisterPage'));
const Contact = page(() => import('./pages/ContactPage'));
const Privacy = page(() => import('./pages/PrivacyPolicy'));
const Terms = page(() => import('./pages/TermsOfService'));
const NotFound = page(() => import('./pages/NotFoundPage'));

// These pages originally received params as component props from preact-iso.
const routeProps = (Component: any) => () => <Component {...useParams()} />;
const protect = (Component: any) => withProtected(routeProps(Component));

function Shell(props: ParentProps) {
  const location = useLocation();
  const auth = useAuthContext();
  const embedded = useEmbeddedTheme();
  const theme = createMemo(() => {
    const path = location.pathname;
    const publicPage = path === '/' || path === '/register' || (!auth.isAuthenticated && !auth.initialLoading && (path === '/browse-tutors' || path.startsWith('/tutor/') || ['/contact', '/privacy-policy', '/terms-of-service'].includes(path)));
    return embedded() ?? (publicPage ? 'light' : useThemeStore(state => state.isDarkMode) ? 'dark' : 'light');
  });
  createEffect(() => {
    const dark = theme() === 'dark';
    for (const element of [document.documentElement, document.body]) { element.dataset.theme = theme(); element.classList.toggle('dark-mode', dark); }
    document.documentElement.style.colorScheme = theme();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1a1a1a' : '#0245ae');
  });
  onMount(() => {
    const listener = (event: MouseEvent) => {
      const element = event.target as HTMLElement;
      if (element.closest('.menu-trigger')) document.querySelector('.offcanvas-wrapper')?.classList.add('active');
      if (element.closest('.menu-close, .offcanvas-overly')) document.querySelector('.offcanvas-wrapper')?.classList.remove('active');
    };
    document.addEventListener('click', listener);
    onCleanup(() => document.removeEventListener('click', listener));
  });
  return <div class={`App theme-${theme()}`}>
    <SessionExpiryModal isAuthenticated={auth.isAuthenticated} autoRefresh={location.pathname.startsWith('/classroom/')} />
    <Suspense fallback={<LoadingSpinner />}>{props.children}</Suspense>
    <SessionExpiredModal />
  </div>;
}

export default function App() {
  return <Router root={props => <PrivyIntegrationProvider><AuthProvider><ToastProvider><ErrorBoundary><Shell>{props.children}</Shell></ErrorBoundary></ToastProvider></AuthProvider></PrivyIntegrationProvider>}>
    <Route path="/" component={Home} />
    <Route path="/home" component={protect(HomeProtected)} />
    <Route path="/register" component={Register} />
    <Route path="/browse-tutors" component={Browse} />
    <Route path="/tutor/:tutorId" component={routeProps(Tutor)} />
    <Route path="/schedule" component={protect(Schedule)} />
    <Route path="/materials" component={protect(Materials)} />
    <Route path="/materials/daily-dispatch" component={protect(Dispatch)} />
    <Route path="/materials/daily-dispatch/archives/:month" component={protect(Archive)} />
    <Route path="/materials/daily-dispatch/:id" component={protect(Article)} />
    <Route path="/materials/business-english" component={protect(Business)} />
    <Route path="/materials/conversational-skills" component={protect(Conversation)} />
    <Route path="/materials/conversational-skills/:id" component={ConversationLesson} />
    <Route path="/young-learners" component={protect(Young)} />
    <Route path="/young-learners/lesson/:id" component={YoungLesson} />
    <Route path="/lesson/view" component={LessonView} />
    <Route path="/conversation-mat/:level/:chapter/:goalSlug" component={LessonView} />
    <Route path="/tickets" component={TICKETING_VISIBLE ? protect(Tickets) : () => <Navigate href="/browse-tutors" />} />
    <Route path="/purchase-history" component={TICKETING_VISIBLE ? protect(Purchases) : () => <Navigate href="/schedule" />} />
    <Route path="/reviews" component={protect(Reviews)} />
    <Route path="/inbox" component={protect(Inbox)} />
    <Route path="/profile" component={protect(Profile)} />
    <Route path="/student/:studentId" component={protect(Profile)} />
    <Route path="/lesson/:bookingId" component={protect(Lesson)} />
    <Route path="/classroom/:sessionId" component={protect(Classroom)} />
    <Route path="/contact" component={Contact} />
    <Route path="/privacy-policy" component={Privacy} />
    <Route path="/terms-of-service" component={Terms} />
    <Route path="*404" component={NotFound} />
  </Router>;
}
