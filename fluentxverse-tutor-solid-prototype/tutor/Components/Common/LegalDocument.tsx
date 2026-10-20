import { For, createSignal, onCleanup, onMount } from 'solid-js';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import SideBar from '../IndexOne/SideBar';
import { legalDocument, type LegalKind } from '../../content/legalContent';
import '../../assets/css/legal-document.css';

export default function LegalDocument(props: { kind: LegalKind }) {
  const content = () => legalDocument(props.kind);
  const [indexOpen, setIndexOpen] = createSignal(true);
  onMount(() => {
    const compact = window.matchMedia('(max-width:900px)');
    const updateIndex = () => setIndexOpen(!compact.matches);
    updateIndex();
    compact.addEventListener('change', updateIndex);
    onCleanup(() => compact.removeEventListener('change', updateIndex));
    document.title = content().title + ' | FluentXVerse';
    if (!window.location.hash) window.scrollTo(0, 0);
  });
  return <div class="fxv-legal-page">
    <SideBar />
    <div class="main-content">
      <Header showThemeSwitch={false} />
      <main class="fxv-legal" id="legal-top">
        <header class="fxv-legal-heading">
          <img src="/assets/img/home-icons/privacy-v1.webp" alt="" width="64" height="64" />
          <div>
            <p class="fxv-legal-eyebrow">FluentXVerse / Tutors</p>
            <h1>{content().title}</h1>
            <p>{content().description}</p>
            <p class="fxv-legal-updated">Last updated: October 11, 2026</p>
          </div>
        </header>
        <nav class="fxv-legal-tabs" aria-label="Legal documents">
          <a href="/privacy-policy" aria-current={props.kind === 'privacy' ? 'page' : undefined}>Privacy Policy</a>
          <a href="/terms-of-service" aria-current={props.kind === 'terms' ? 'page' : undefined}>Terms of Service</a>
        </nav>
        <div class="fxv-legal-layout">
          <aside class="fxv-legal-index">
            <details open={indexOpen()} onToggle={event => setIndexOpen(event.currentTarget.open)}>
              <summary>On this page</summary>
            <nav aria-label="On this page">
              <ol><For each={content().sections}>{section =>
                <li><a href={'#' + section.id}>{section.title}</a></li>
              }</For></ol>
            </nav>
            </details>
            <a class="fxv-legal-contact" href="mailto:support@fluentxverse.com">Contact support</a>
          </aside>
          <article class="fxv-legal-body" aria-label={content().title}>
            <For each={content().sections}>{(section, index) =>
              <section id={section.id} aria-labelledby={section.id + '-title'}>
                <h2 id={section.id + '-title'}>{index() + 1}. {section.title}</h2>
                <For each={section.paragraphs}>{paragraph => <p>{paragraph}</p>}</For>
                {section.items && <ul><For each={section.items}>{item => <li>{item}</li>}</For></ul>}
              </section>
            }</For>
            <div class="fxv-legal-end">
              <p>Questions? <a href="mailto:support@fluentxverse.com">support@fluentxverse.com</a></p>
              <a href="#legal-top">Back to top</a>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  </div>;
}
