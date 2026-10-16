import TutorArt from '../Common/TutorArt';
import TutorIcon from '../Common/TutorIcon';
import { useAuthContext } from '../../context/AuthContext';

export default function NotFound() {
  const { isAuthenticated } = useAuthContext();
  return <main className="tutor-not-found">
    <TutorArt name="home" size={80} />
    <p className="tutor-not-found-code">404</p>
    <h1>Page not found</h1>
    <p>This page is unavailable or has moved.</p>
    <div className="tutor-not-found-actions">
      <a href={isAuthenticated ? '/home' : '/'}><TutorIcon name="fa-home" />Back to home</a>
      <a href="/contact"><TutorIcon name="fa-envelope" />Contact support</a>
    </div>
  </main>;
}
