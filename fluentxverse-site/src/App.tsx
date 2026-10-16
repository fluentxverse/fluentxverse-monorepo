import { A, Route, Router, useLocation } from '@solidjs/router';
import { createEffect, lazy, Suspense } from 'solid-js';
import type { ParentProps } from 'solid-js';
import { ArrowLeft } from 'lucide-solid';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';

const TechnologyPage = lazy(() => import('./pages/TechnologyPage'));
const AiPage = lazy(() => import('./pages/AiPage'));
const OnchainPage = lazy(() => import('./pages/OnchainPage'));

const metadata: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'FluentXVerse | Learning, backed by proof.',
    description: 'Learning, backed by proof. FluentXVerse builds onchain education applications, starting with ESL and growing across subjects and skills.',
  },
  '/about': {
    title: 'About | FluentXVerse',
    description: 'Meet the team building FluentXVerse\'s onchain education ecosystem, starting with online ESL and expanding to new subjects, skills, and learning formats.',
  },
  '/technology': {
    title: 'Technology | FluentXVerse',
    description: 'Why FluentXVerse uses AI, Web3 technology, and zero-knowledge proofs to support learning, build trust, and protect private information.',
  },
  '/technology/ai': {
    title: 'AI in Education | FluentXVerse',
    description: 'How FluentXVerse uses AI for language assistance, lesson authoring, and assessment support, with human judgment and clear limitations.',
  },
  '/onchain-education': {
    title: 'Why Onchain Education | FluentXVerse',
    description: 'The FluentXVerse case for portable learning evidence, shared verification, and private credential proofs, including where blockchain is not needed.',
  },
};

function Layout(props: ParentProps) {
  const location = useLocation();
  createEffect(() => {
    const pathname = location.pathname.replace(/\/$/, '') || '/';
    const page = metadata[pathname] ?? { title: 'Page Not Found | FluentXVerse', description: 'Explore FluentXVerse, an ecosystem for onchain education.' };
    document.title = page.title;
    const description = page.description;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    const url = `https://fluentxverse.com${pathname}`;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', url);
  });
  return (
    <>
      <a class="skip-link" href="#main-content">Skip to content</a>
      <Navbar />
      <main id="main-content" tabindex="-1"><Suspense fallback={<div class="container route-loading" role="status">Loading...</div>}>{props.children}</Suspense></main>
      <Footer />
    </>
  );
}

function NotFound() {
  return (
    <section class="container not-found">
      <span class="eyebrow">404 / PAGE NOT FOUND</span>
      <h1>A different direction.</h1>
      <p>This page is no longer here. Our ecosystem is a good place to start.</p>
      <A class="button button-primary" href="/"><ArrowLeft size={18} /> Back to home</A>
    </section>
  );
}

export default function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={HomePage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/technology" component={TechnologyPage} />
      <Route path="/technology/ai" component={AiPage} />
      <Route path="/onchain-education" component={OnchainPage} />
      <Route path="*" component={NotFound} />
    </Router>
  );
}
