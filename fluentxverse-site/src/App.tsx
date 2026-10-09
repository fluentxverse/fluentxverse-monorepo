import { A, Route, Router, useLocation } from '@solidjs/router';
import { createEffect } from 'solid-js';
import type { ParentProps } from 'solid-js';
import { ArrowLeft } from 'lucide-solid';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';

function Layout(props: ParentProps) {
  const location = useLocation();
  createEffect(() => {
    const about = location.pathname.replace(/\/$/, '') === '/about';
    document.title = about
      ? 'About | FluentXVerse'
      : 'FluentXVerse | Learning, backed by proof.';
    const description = about
      ? 'Meet the team building FluentXVerse\'s onchain education ecosystem, starting with online ESL and expanding to new subjects, skills, and learning formats.'
      : 'Learning, backed by proof. FluentXVerse builds onchain education applications, starting with ESL and growing across subjects and skills.';
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    const url = `https://fluentxverse.com${location.pathname}`;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', url);
  });
  return (
    <>
      <a class="skip-link" href="#main-content">Skip to content</a>
      <Navbar />
      <main id="main-content" tabindex="-1">{props.children}</main>
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
      <Route path="*" component={NotFound} />
    </Router>
  );
}
