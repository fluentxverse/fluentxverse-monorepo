import { useEffect, useRef, useState } from 'preact/hooks';
import { FLUENT_KIDS_EDITOR_PATH, PARK_LESSON_ID } from '../../../shared/fluentKids/curriculum';
import { fluentKidsRoadmap } from '../../../shared/fluentKids/roadmap';

export default function FluentKidsPage({ id }: { id?: string }) {
  const lessonHost = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (id !== PARK_LESSON_ID) return;
    const container = lessonHost.current;
    if (!container) return;
    let active = true;
    let dispose: (() => void) | undefined;
    import('../../../shared/fluentKids/lesson').then(({ mountParkLesson }) => {
      if (active) dispose = mountParkLesson(container, { audience: 'admin', courseHref: FLUENT_KIDS_EDITOR_PATH });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; dispose?.(); };
  }, [id]);

  if (!id) return <div dangerouslySetInnerHTML={{ __html: fluentKidsRoadmap(FLUENT_KIDS_EDITOR_PATH, '/young-learners-editor') }} />;
  if (id !== PARK_LESSON_ID) return <p>That lesson isn’t available yet. <a href={FLUENT_KIDS_EDITOR_PATH}>Fluent Kids roadmap</a></p>;
  return <div className="fk-lesson-page" aria-label="Fluent Kids lesson preview">
    <div ref={lessonHost} />
    {error && <p role="alert">The lesson could not load. Refresh to try again.</p>}
  </div>;
}
