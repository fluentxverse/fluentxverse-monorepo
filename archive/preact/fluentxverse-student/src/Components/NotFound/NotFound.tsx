import { ArrowLeft, House } from 'lucide-preact';
import { useLocation } from 'preact-iso';
import { useAuthContext } from '../../context/AuthContext';
import './NotFound.css';
export default function NotFound() {
  const { route } = useLocation();
  const { isAuthenticated } = useAuthContext();
  const home = isAuthenticated ? '/home' : '/';
  return <main className="student-not-found"><img src="/assets/img/home-icons/home-v1.webp" alt="" width="96" height="96" /><p>404</p><h1>Page not found</h1><p>This page may have moved or is no longer available.</p><div><button onClick={() => window.history.length > 1 ? window.history.back() : route(home)}><ArrowLeft size={18} />Go back</button><a href={home}><House size={18} />Home</a></div><a href="/contact">Contact support</a></main>;
}
