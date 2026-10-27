import { A } from '@solidjs/router';
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, Check, ChevronDown, GraduationCap, Link as LinkIcon, Printer, Search, ShieldCheck, Users, X } from 'lucide-solid';
import type { OverviewBlock, OverviewChapter, OverviewTopic } from '../data/platformOverview';
import { contactEmail } from '../data/site';
import '../pages/EslTutorAppPage.css';

export interface PublicAppGuideContent {
  path: string;
  title: string;
  eyebrow: string;
  lead: string;
  description: string;
  chapters: OverviewChapter[];
  glossary: readonly (readonly [string, string])[];
  sourceDate: string;
  sourceDateLabel: string;
  sourceIntro: string;
  sourceNote: string;
  portalHref: string;
  portalLabel: string;
  imageWide: string;
  imageMobile: string;
  imageWidth: number;
  imageHeight: number;
  relatedHref: string;
  relatedLabel: string;
  student?: boolean;
}

export function publicChapterText(chapter: OverviewChapter) {
  return [chapter.title, chapter.summary, ...chapter.blocks.flatMap(block => block.kind === 'list' || block.kind === 'steps' ? block.items : block.kind === 'table' ? [...block.headings,...block.rows.flat()] : block.kind === 'note' ? [block.title,block.text] : [block.text])].join(' ');
}

const topics: (OverviewTopic | 'All')[] = ['All', 'Business', 'Operations', 'Technology', 'Privacy'];
function ReadingBlock(props: { block: OverviewBlock }) {
  const block = props.block;
  if (block.kind === 'paragraph') return <p>{block.text}</p>;
  if (block.kind === 'note') return <aside class="esl-note"><strong>{block.title}</strong><p>{block.text}</p></aside>;
  if (block.kind === 'table') return <div class="esl-table-wrap" tabindex="0" role="region" aria-label={block.headings.join(' and ')}><table><thead><tr><For each={block.headings}>{heading => <th scope="col">{heading}</th>}</For></tr></thead><tbody><For each={block.rows}>{row => <tr><For each={row}>{(cell, index) => index() === 0 ? <th scope="row">{cell}</th> : <td>{cell}</td>}</For></tr>}</For></tbody></table></div>;
  if (block.kind === 'steps') return <ol class="esl-steps"><For each={block.items}>{item => <li>{item}</li>}</For></ol>;
  return <ul><For each={block.items}>{item => <li>{item}</li>}</For></ul>;
}

export default function PublicAppGuide(props: { guide: PublicAppGuideContent }) {
  const [query, setQuery] = createSignal('');
  const [topic, setTopic] = createSignal<OverviewTopic | 'All'>('All');
  const [active, setActive] = createSignal(props.guide.chapters[0].id);
  const [chaptersOpen, setChaptersOpen] = createSignal(false);
  const [copyStatus, setCopyStatus] = createSignal('');
  const chapters = createMemo(() => {
    const words = query().trim().toLowerCase().split(/\s+/).filter(Boolean);
    return props.guide.chapters.filter(chapter => (topic() === 'All' || chapter.topic === topic()) && words.every(word => publicChapterText(chapter).toLowerCase().includes(word)));
  });
  const readingMinutes = createMemo(() => Math.ceil(props.guide.chapters.map(publicChapterText).join(' ').split(/\s+/).length / 220));
  const filtering = createMemo(() => Boolean(query().trim()) || topic() !== 'All');
  let article!: HTMLElement;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { setQuery(''); setTopic('All'); };
  function jump(id: string) {
    const element = document.getElementById(id);
    if (!element) return;
    setActive(id); setChaptersOpen(false);
    element.scrollIntoView({ block: 'start', behavior: 'instant' });
    element.focus({ preventScroll: true });
  }
  onMount(() => {
    if (location.hash) requestAnimationFrame(() => jump(location.hash.slice(1)));
    onCleanup(() => clearTimeout(copyTimer));
  });
  createEffect(() => {
    chapters();
    if (!article) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: '-110px 0px -65% 0px' });
    article.querySelectorAll('section[id]').forEach(section => observer.observe(section));
    onCleanup(() => observer.disconnect());
  });
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`https://fluentxverse.com${props.guide.path}${location.hash}`);
      setCopyStatus('Link copied');
    } catch { setCopyStatus('Could not copy link'); }
    clearTimeout(copyTimer); copyTimer = setTimeout(() => setCopyStatus(''), 3000);
  }

  return <div class="esl-overview" classList={{ 'esl-overview--student': props.guide.student }}>
    <section class="esl-guide-hero" aria-labelledby="esl-guide-title">
      <picture aria-hidden="true"><source media="(max-width: 760px)" srcset={props.guide.imageMobile}/><img src={props.guide.imageWide} alt="" width={props.guide.imageWidth} height={props.guide.imageHeight} fetchpriority="high"/></picture>
      <div class="container esl-guide-heading">
        <A class="esl-back" href="/#ecosystem"><ArrowLeft size={14}/>Our ecosystem</A>
        <p class="eyebrow">{props.guide.eyebrow}</p>
        <h1 id="esl-guide-title">{props.guide.title}</h1>
        <p class="esl-guide-lead">{props.guide.lead}</p>
        <p class="esl-guide-description">{props.guide.description}</p>
        <div class="esl-guide-meta"><span><BookOpen size={14}/>{props.guide.chapters.length} chapters</span><span>{readingMinutes()} min read</span><span>No login required</span></div>
      </div>
    </section>
    <section class="esl-summary-band" aria-label="Platform at a glance">
      <div class="container">
        <div><GraduationCap size={23}/><p><strong>{props.guide.student ? 'Learning with a person' : 'Human-led learning'}</strong><span>One-to-one English lessons and practical feedback.</span></p></div>
        <div><Users size={23}/><p><strong>{props.guide.student ? 'A connected learning journey' : 'Connected operations'}</strong><span>{props.guide.student ? 'Tutor discovery, booking, materials, and follow-up in one place.' : 'Students, tutors, and staff working from shared lesson records.'}</span></p></div>
        <div><ShieldCheck size={23}/><p><strong>{props.guide.student ? 'Clear choices and safeguards' : 'Evidence with boundaries'}</strong><span>{props.guide.student ? 'Consent, access rules, and honest limits on private verification.' : 'Private verification for specific claims, not blanket guarantees.'}</span></p></div>
      </div>
    </section>
    <div class="container esl-guide-body">
      <div class="esl-public-scope"><ShieldCheck size={18}/><p>{props.guide.sourceIntro} <time datetime={props.guide.sourceDate}>{props.guide.sourceDateLabel}</time>. This explains the design and its limits, not live deployment status or audited impact.</p></div>
      <div class="esl-reading-toolbar">
        <label class="esl-search"><Search size={18}/><span class="esl-sr-only">Search the platform overview</span><input type="search" value={query()} onInput={event => setQuery(event.currentTarget.value)} placeholder="Search the guide"/><Show when={query()}><button type="button" aria-label="Clear search" title="Clear search" onClick={() => setQuery('')}><X size={17}/></button></Show></label>
        <div class="esl-document-actions"><button type="button" onClick={copyLink} title="Copy public guide link" aria-label="Copy public guide link">{copyStatus() === 'Link copied' ? <Check size={18}/> : <LinkIcon size={18}/>}</button><button type="button" onClick={() => window.print()} title="Print current reading view" aria-label="Print current reading view"><Printer size={18}/></button><span role="status" class="esl-copy-status">{copyStatus()}</span></div>
      </div>
      <div class="esl-topic-filter" role="group" aria-label="Filter guide topics"><For each={topics}>{value => <button type="button" aria-pressed={topic() === value} onClick={() => setTopic(value)}>{value}</button>}</For></div>
      <Show when={filtering()}><div class="esl-result-count" role="status"><span>{chapters().length} of {props.guide.chapters.length} chapters</span><button type="button" onClick={clear}>Show full guide <X size={14}/></button></div></Show>
      <div class="esl-reading-layout">
        <aside class="esl-chapter-nav" classList={{ 'is-open': chaptersOpen() }}>
          <button type="button" class="esl-chapters-toggle" aria-expanded={chaptersOpen()} aria-controls="esl-chapter-links" onClick={() => setChaptersOpen(!chaptersOpen())}>In this guide <ChevronDown size={17}/></button>
          <div id="esl-chapter-links"><h2>In this guide</h2><nav aria-label="Platform overview chapters"><For each={chapters()}>{chapter => <a href={`#${chapter.id}`} aria-current={active() === chapter.id ? 'location' : undefined} onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return; event.preventDefault(); history.pushState(history.state, '', `#${chapter.id}`); jump(chapter.id); }}><span>{String(props.guide.chapters.indexOf(chapter) + 1).padStart(2, '0')}</span>{chapter.title}</a>}</For><Show when={!filtering()}><a href="#glossary" onClick={() => setChaptersOpen(false)}><BookOpen size={14}/>Plain-language glossary</a></Show></nav><a class="esl-tutor-portal" href={props.guide.portalHref} target="_blank" rel="noopener noreferrer">{props.guide.portalLabel} <ArrowUpRight size={15}/></a></div>
        </aside>
        <article ref={article} class="esl-reading" aria-label="Public platform guide">
          <Show when={chapters().length === 0}><section class="esl-no-results"><Search size={28}/><h2>No matching chapters</h2><p>There are no results for this search and topic.</p><button type="button" onClick={clear}>Show full guide <ArrowRight size={16}/></button></section></Show>
          <For each={chapters()}>{chapter => <section class="esl-chapter" id={chapter.id} tabindex="-1" aria-labelledby={`${chapter.id}-title`}>
            <header><span class="eyebrow">{String(props.guide.chapters.indexOf(chapter) + 1).padStart(2, '0')} / {chapter.topic}</span><h2 id={`${chapter.id}-title`}>{chapter.title}</h2><p>{chapter.summary}</p></header>
            <div class="esl-prose"><For each={chapter.blocks}>{block => <ReadingBlock block={block}/>}</For></div>
          </section>}</For>
          <Show when={!filtering()}>
            <section class="esl-chapter" id="glossary" tabindex="-1" aria-labelledby="esl-glossary-title"><header><span class="eyebrow">REFERENCE</span><h2 id="esl-glossary-title">Plain-language glossary</h2></header><dl class="esl-glossary"><For each={props.guide.glossary}>{([term, meaning]) => <div><dt>{term}</dt><dd>{meaning}</dd></div>}</For></dl></section>
            <section class="esl-chapter" id="further-reading" tabindex="-1" aria-labelledby="esl-further-title"><header><span class="eyebrow">CONTINUE EXPLORING</span><h2 id="esl-further-title">The thinking behind the platform</h2></header><div class="esl-further-links"><A href={props.guide.relatedHref}>{props.guide.relatedLabel} <ArrowRight size={17}/></A><A href="/technology">Our technology <ArrowRight size={17}/></A><A href="/technology/ai">AI in education <ArrowRight size={17}/></A><A href="/onchain-education">Why onchain education <ArrowRight size={17}/></A></div><p class="esl-source-note">{props.guide.sourceNote}</p></section>
          </Show>
          <footer class="esl-reading-footer"><span>FluentXVerse / Platform Overview</span><a href="#esl-guide-title" onClick={event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'instant' }); }}>Back to top <ArrowUp size={13}/></a></footer>
        </article>
      </div>
    </div>
    <section class="esl-partner-band"><div class="container"><div><span class="eyebrow">PARTNERSHIPS &amp; DUE DILIGENCE</span><h2>Let's talk about the next chapter.</h2><p>Discuss the implementation, evaluation priorities, and what responsible expansion would require.</p></div><a class="button button-primary" href={`mailto:${contactEmail}?subject=FluentXVerse%20ESL%20partnership`}>Contact the team <ArrowUpRight size={18}/></a></div></section>
  </div>;
}
