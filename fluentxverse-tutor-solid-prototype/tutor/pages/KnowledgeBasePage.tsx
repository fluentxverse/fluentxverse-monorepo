import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { ArrowLeft, ArrowRight, Bookmark, BookOpenText, CalendarCheck, Check, ChevronRight, Compass, Headphones, LibraryBig, Link, Search, ShieldCheck, Video, Wallet, X } from 'lucide-solid';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import TutorArt from '../Components/Common/TutorArt';
import { useAuthContext } from '../context/AuthContext';
import { knowledgeArticles, knowledgeCategories, knowledgeUpdatedOn, parseKnowledgeBookmarks, searchKnowledge, type KnowledgeArticle } from '../content/knowledgeBase';
import './KnowledgeBasePage.css';

const categoryIcons = { 'getting-started': Compass, scheduling: CalendarCheck, classroom: Video, teaching: BookOpenText, account: ShieldCheck, compensation: Wallet };
const categoryLabel = (id: string) => knowledgeCategories.find(category => category.id === id)?.label || 'All articles';
const readTime = (article: KnowledgeArticle) => Math.max(1, Math.ceil(article.sections.map(section => [section.title, ...(section.paragraphs || []), ...(section.steps || []), section.note || ''].join(' ')).join(' ').split(/\s+/).length / 200));

export default function KnowledgeBasePage() {
  const auth = useAuthContext();
  const params = useParams<{ slug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = createSignal<string[]>([]);
  const [notice, setNotice] = createSignal('');
  const [copied, setCopied] = createSignal(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const query = createMemo(() => typeof searchParams.q === 'string' ? searchParams.q.slice(0, 200) : '');
  const category = createMemo(() => knowledgeCategories.some(item => item.id === searchParams.category) ? String(searchParams.category) : 'all');
  const savedOnly = createMemo(() => searchParams.view === 'saved');
  const article = createMemo(() => knowledgeArticles.find(item => item.slug === params.slug));
  const results = createMemo(() => searchKnowledge(query(), category(), savedOnly() ? bookmarks() : undefined));
  const storageKey = createMemo(() => auth.user?.userId ? `fxv_tutor_kb_saved:${auth.user.userId}` : null);
  const listUrl = (topic = category(), saved = savedOnly()) => {
    const queryParams = new URLSearchParams();
    if (query()) queryParams.set('q', query());
    if (topic !== 'all') queryParams.set('category', topic);
    if (saved) queryParams.set('view', 'saved');
    return `/knowledge-base${queryParams.size ? `?${queryParams}` : ''}`;
  };
  const articleUrl = (slug: string) => `/knowledge-base/${slug}${listUrl().replace('/knowledge-base', '')}`;
  const listTitle = createMemo(() => savedOnly() ? 'Saved articles' : categoryLabel(category()));

  createEffect(on(storageKey, key => {
    try { setBookmarks(key ? parseKnowledgeBookmarks(localStorage.getItem(key)) : []); }
    catch { setBookmarks([]); }
  }));
  createEffect(() => { document.title = `${article()?.title || 'Knowledge Base'} | FluentXVerse`; });
  createEffect(on(() => params.slug, () => {
    setNotice(''); setCopied(false); clearTimeout(copyTimer);
  }));
  onCleanup(() => clearTimeout(copyTimer));

  const toggleBookmark = (slug: string) => {
    const next = bookmarks().includes(slug) ? bookmarks().filter(item => item !== slug) : [...bookmarks(), slug];
    setBookmarks(next);
    try {
      const key = storageKey();
      if (!key) throw new Error('Account unavailable');
      localStorage.setItem(key, JSON.stringify(next));
      setNotice(next.includes(slug) ? 'Article saved on this device.' : 'Article removed from saved articles.');
    } catch { setNotice('Saved for this visit only. Device storage is unavailable.'); }
  };
  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/knowledge-base/${slug}`);
      setCopied(true); setNotice('Article link copied.');
      clearTimeout(copyTimer); copyTimer = setTimeout(() => setCopied(false), 2500);
    } catch { setNotice('Could not copy the link. The article URL is in the address bar.'); }
  };

  return <>
    <SideBar />
    <div class="main-content tutor-kb-page">
      <DashboardHeader />
      <div class="tutor-kb-container">
        <header class="tutor-kb-heading">
          <TutorArt name="support" size={44} />
          <div><h1>Knowledge Base</h1><p>Tutor handbook & resources</p></div>
        </header>
        <div class="tutor-kb-layout">
          <aside class="tutor-kb-sidebar">
            <div class="tutor-kb-mobile-filters">
              <label>Topic<select aria-label="Knowledge base topic" value={article()?.category || category()} onChange={event => navigate(listUrl(event.currentTarget.value, false))}><option value="all">All articles</option><For each={knowledgeCategories}>{topic => <option value={topic.id}>{topic.label}</option>}</For></select></label>
              <a href={listUrl('all', true)} aria-label={`Saved articles ${bookmarks().length}`} classList={{ 'is-active': savedOnly() }}><Bookmark size={17}/><span>Saved</span><small>{bookmarks().length}</small></a>
            </div>
            <nav aria-label="Knowledge base topics">
              <h2>Browse topics</h2>
              <a classList={{ 'is-active': !params.slug && category() === 'all' && !savedOnly() }} href={listUrl('all', false)} aria-current={!params.slug && category() === 'all' && !savedOnly() ? 'page' : undefined}><LibraryBig size={18}/><span>All articles</span><small>{knowledgeArticles.length}</small></a>
              <For each={knowledgeCategories}>{topic => <a classList={{ 'is-active': (article()?.category || category()) === topic.id && !savedOnly() }} href={listUrl(topic.id, false)} aria-current={!params.slug && category() === topic.id && !savedOnly() ? 'page' : undefined}><Dynamic component={categoryIcons[topic.id]} size={18}/><span>{topic.label}</span><small>{knowledgeArticles.filter(item => item.category === topic.id).length}</small></a>}</For>
              <a class="tutor-kb-saved" classList={{ 'is-active': savedOnly() && !params.slug }} href={listUrl('all', true)} aria-current={savedOnly() && !params.slug ? 'page' : undefined}><Bookmark size={18}/><span>Saved articles</span><small>{bookmarks().length}</small></a>
            </nav>
            <div class="tutor-kb-support"><Headphones size={22}/><strong>Need more help?</strong><a href="mailto:support@fluentxverse.com">Contact support<ArrowRight size={15}/></a></div>
            <div class="tutor-kb-policy-links"><a href="/terms-of-service">Tutor terms</a><a href="/privacy-policy">Privacy policy</a></div>
          </aside>
          <div class="tutor-kb-main">
            <Show when={params.slug} fallback={<>
              <form class="tutor-kb-search" role="search" onSubmit={event => event.preventDefault()}>
                <Search size={20}/>
                <input type="search" aria-label="Search knowledge base" placeholder="Search articles" maxLength={200} value={query()} onInput={event => setSearchParams({ q: event.currentTarget.value || undefined }, { replace: true })}/>
                <Show when={query()}><button type="button" title="Clear search" aria-label="Clear search" onClick={() => setSearchParams({ q: undefined }, { replace: true })}><X size={18}/></button></Show>
              </form>
              <div class="tutor-kb-list-heading"><h2>{listTitle()}</h2><span role="status">{results().length} {results().length === 1 ? 'article' : 'articles'}{query() ? ' found' : ''}</span></div>
              <Show when={results().length} fallback={<div class="tutor-kb-empty"><Search size={30}/><h3>{savedOnly() && !bookmarks().length ? 'No saved articles yet' : 'No matching articles'}</h3><p>{savedOnly() && !bookmarks().length ? 'Saved articles will appear here.' : 'Try another topic or a different search term.'}</p><a href="/knowledge-base">View all articles<ArrowRight size={16}/></a></div>}>
                <div class="tutor-kb-articles"><For each={results()}>{item => <a class="tutor-kb-article-row" href={articleUrl(item.slug)}>
                  <span class={`tutor-kb-topic-icon topic-${item.category}`}><Dynamic component={categoryIcons[item.category]} size={21}/></span>
                  <div><span class="tutor-kb-eyebrow">{categoryLabel(item.category)}</span><h3>{item.title}</h3><p>{item.summary}</p></div>
                  <span class="tutor-kb-row-time">{readTime(item)} min read</span><ChevronRight size={18}/>
                </a>}</For></div>
              </Show>
            </>}>
              <a class="tutor-kb-back" href={listUrl()}><ArrowLeft size={16}/>Back to articles</a>
              <Show when={article()} keyed fallback={<div class="tutor-kb-empty"><BookOpenText size={30}/><h2>Article not found</h2><p>This article may have moved or the link may be incorrect.</p><a href="/knowledge-base">View all articles<ArrowRight size={16}/></a></div>}>{item => <article class="tutor-kb-reader">
                <header class="tutor-kb-article-heading">
                  <span class="tutor-kb-eyebrow">{categoryLabel(item.category)}</span>
                  <h2>{item.title}</h2><p>{item.summary}</p>
                  <div class="tutor-kb-article-meta"><span>{readTime(item)} min read</span><span>Updated <time dateTime={knowledgeUpdatedOn}>{new Date(`${knowledgeUpdatedOn}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time></span>
                    <div class="tutor-kb-tools">
                      <button type="button" classList={{ 'is-saved': bookmarks().includes(item.slug) }} aria-label={bookmarks().includes(item.slug) ? 'Unsave article' : 'Save article'} aria-pressed={bookmarks().includes(item.slug)} title={bookmarks().includes(item.slug) ? 'Unsave article' : 'Save article'} onClick={() => toggleBookmark(item.slug)}><Bookmark size={18}/></button>
                      <button type="button" aria-label="Copy article link" title="Copy article link" onClick={() => void copyLink(item.slug)}><Show when={copied()} fallback={<Link size={18}/>}><Check size={18}/></Show></button>
                    </div>
                  </div>
                </header>
                <nav class="tutor-kb-contents" aria-label="In this article"><strong>In this article</strong><For each={item.sections}>{section => <a href={`#${section.id}`}>{section.title}<ChevronRight size={13}/></a>}</For></nav>
                <For each={item.sections}>{section => <section id={section.id} class="tutor-kb-section" aria-labelledby={`kb-${section.id}`}><h3 id={`kb-${section.id}`}>{section.title}</h3><For each={section.paragraphs}>{paragraph => <p>{paragraph}</p>}</For><Show when={section.steps}><ol><For each={section.steps}>{step => <li>{step}</li>}</For></ol></Show><Show when={section.note}><aside class="tutor-kb-note"><ShieldCheck size={18}/><p>{section.note}</p></aside></Show></section>}</For>
                <nav class="tutor-kb-actions" aria-label="Related app pages"><For each={item.links}>{link => <a href={link.href}>{link.label}<ArrowRight size={16}/></a>}</For></nav>
                <div class="tutor-kb-related"><h3>Related articles</h3><For each={knowledgeArticles.filter(other => other.category === item.category && other.slug !== item.slug).slice(0, 3)} fallback={<a href="/knowledge-base/inbox-notifications-and-support">Inbox, notifications, and support<ChevronRight size={16}/></a>}>{other => <a href={articleUrl(other.slug)}>{other.title}<ChevronRight size={16}/></a>}</For></div>
              </article>}</Show>
            </Show>
            <Show when={notice()}><div class="tutor-kb-notice" role="status" aria-live="polite"><span>{notice()}</span><button type="button" aria-label="Dismiss notice" title="Dismiss notice" onClick={() => setNotice('')}><X size={16}/></button></div></Show>
          </div>
        </div>
      </div>
    </div>
  </>;
}
