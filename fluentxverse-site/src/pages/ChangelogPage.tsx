import { A, useLocation, useSearchParams } from '@solidjs/router';
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { Check, Link, Search, X, ArrowDownToLine } from 'lucide-solid';
import { appLabels, changeLabels, changelog, changelogUrl, changeDate, filterChangelog } from '../data/changelog';
import type { ChangeApp, ChangeType } from '../data/changelog';
import './ChangelogPage.css';

export default function ChangelogPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [copied, setCopied] = createSignal('');
  const [copyError, setCopyError] = createSignal('');
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copyTimer));
  const app = () => typeof params.app === 'string' && Object.hasOwn(appLabels, params.app) ? params.app : '';
  const type = () => typeof params.type === 'string' && Object.hasOwn(changeLabels, params.type) ? params.type : '';
  const query = () => typeof params.q === 'string' ? params.q : '';
  const visible = createMemo(() => filterChangelog(changelog, app(), type(), query()));
  const reset = () => setParams({ app: undefined, type: undefined, q: undefined }, { replace: true, scroll: false });

  createEffect(() => {
    const id = location.hash.slice(1);
    if (!changelog.some(entry => entry.id === id)) return;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(id);
      element?.focus({ preventScroll: true });
      element?.scrollIntoView({ block: 'start' });
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });

  async function copy(id: string) {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(changelogUrl(id));
      clearTimeout(copyTimer);
      setCopied(id);
      copyTimer = setTimeout(() => setCopied(''), 2500);
    } catch {
      setCopyError('The link could not be copied. Open the update ID to get its permanent link.');
    }
  }

  return <section class="container changelog-page">
    <header class="changelog-heading">
      <span class="eyebrow">FLUENTXVERSE / PRODUCT UPDATES</span>
      <h1>Changelog</h1>
      <p>Updates to the student app, tutor app, backend, and GMR Engine.</p>
      <a class="text-link changelog-feed" href="/changelog.json" download="fluentxverse-changelog.json"><ArrowDownToLine size={16} /> Download JSON</a>
    </header>

    <div class="changelog-controls">
      <div class="changelog-apps" role="group" aria-label="Filter by app">
        <For each={['', ...Object.keys(appLabels)]}>{key => <button type="button" aria-pressed={app() === key}
          onClick={() => setParams({ app: key || undefined }, { scroll: false })}>
          {key ? appLabels[key as ChangeApp] : 'All updates'}
        </button>}</For>
      </div>
      <div class="changelog-search-row">
        <div class="changelog-search">
          <Search size={18} aria-hidden="true" />
          <input type="search" aria-label="Search updates" placeholder="Search updates or ID" value={query()}
            onInput={event => setParams({ q: event.currentTarget.value || undefined }, { replace: true, scroll: false })} />
          <Show when={query()}><button type="button" title="Clear search" aria-label="Clear search"
            onClick={() => setParams({ q: undefined }, { replace: true, scroll: false })}><X size={17} /></button></Show>
        </div>
        <label class="changelog-type">Change type
          <select aria-label="Change type" value={type()} onChange={event => setParams({ type: event.currentTarget.value || undefined }, { scroll: false })}>
            <option value="">All types</option>
            <For each={Object.entries(changeLabels)}>{([key, label]) => <option value={key}>{label}</option>}</For>
          </select>
        </label>
      </div>
    </div>

    <div class="changelog-results">
      <p role="status">{visible().length} {visible().length === 1 ? 'update' : 'updates'}</p>
      <Show when={app() || type() || query()}><button type="button" onClick={reset}>Reset filters</button></Show>
    </div>
    <Show when={copyError()}><p class="changelog-error" role="alert">{copyError()}</p></Show>
    <span class="changelog-sr" aria-live="polite">{copied() ? 'Update link copied' : ''}</span>
    <div class="changelog-list">
      <For each={visible()}>{entry => <article id={entry.id} tabindex="-1" class="changelog-entry" aria-labelledby={`${entry.id}-title`}>
        <div class="changelog-date"><time datetime={entry.date}>{changeDate(entry.date)}</time>
          <span class={`changelog-kind kind-${entry.type}`}>{changeLabels[entry.type as ChangeType]}</span>
        </div>
        <div class="changelog-content">
          <div class="changelog-entry-meta"><div class="changelog-app-labels"><For each={entry.apps}>{key => <span class={`app-${key}`}>{appLabels[key]}</span>}</For></div>
            <div class="changelog-permalink"><A href={`/changelog#${entry.id}`} title="Open permanent link">{entry.id}</A>
              <button type="button" title={`Copy link to ${entry.id}`} aria-label={`Copy link to ${entry.id}`} onClick={() => void copy(entry.id)}>
                <Show when={copied() === entry.id} fallback={<Link size={16} />}><Check size={16} /></Show>
              </button></div>
          </div>
          <h2 id={`${entry.id}-title`}>{entry.title}</h2>
          <p>{entry.summary}</p>
          <ul><For each={entry.details}>{detail => <li>{detail}</li>}</For></ul>
        </div>
      </article>}</For>
      <Show when={!visible().length}><div class="changelog-empty"><Search size={24} /><h2>No matching updates</h2>
        <p>Try another app, change type, or search term.</p><button type="button" onClick={reset}>Show all updates</button></div></Show>
    </div>
  </section>;
}
