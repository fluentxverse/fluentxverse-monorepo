import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { FLUENT_KIDS_PATH, PARK_LESSON_ID } from './curriculum';
import { fluentKidsRoadmap } from './roadmap';

export function FluentKidsLibrary(props: { legacyHref: string }) {
  onMount(() => { document.title = 'Fluent Kids | FluentXverse'; });
  return <main class="fk-course-page" innerHTML={fluentKidsRoadmap(FLUENT_KIDS_PATH, props.legacyHref)} />;
}

export function FluentKidsLesson(props: { id?: string; audience: 'student' | 'tutor' }) {
  let container!: HTMLDivElement;
  const [status, setStatus] = createSignal<'loading' | 'ready' | 'error'>('loading');
  createEffect(() => {
    if (props.id !== PARK_LESSON_ID) return;
    document.title = 'A Day in the Park | Fluent Kids';
    let active = true;
    let dispose: (() => void) | undefined;
    setStatus('loading');
    const audience = props.audience;
    import('./lesson').then(({ mountParkLesson }) => {
      if (!active) return;
      dispose = mountParkLesson(container, { audience, courseHref: FLUENT_KIDS_PATH });
      setStatus('ready');
    }).catch(() => { if (active) setStatus('error'); });
    onCleanup(() => { active = false; dispose?.(); });
  });
  return <main class="fk-lesson-page">
    <Show when={props.id === PARK_LESSON_ID} fallback={<p>That lesson isn’t available yet. <a href={FLUENT_KIDS_PATH}>Fluent Kids roadmap</a></p>}>
      <div ref={container} />
      <Show when={status() !== 'ready'}>
        <p role="status">{status() === 'loading' ? 'Loading lesson…' : 'The lesson could not load. Refresh to try again.'}</p>
      </Show>
    </Show>
  </main>;
}
