import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import { useRoute, useLocation } from "../routing";
import { lessonApi } from '../api/lesson.api';
import './LessonViewPage.css';
export default function LessonViewPage() {
    const _state0 = useRoute();
    const _state1 = useLocation();
    const lessonId = createMemo(() => _state0.query.id as string);
    const [viewUrl, setViewUrl] = createSignal<string | null>(null);
    const [lessonTitle, setLessonTitle] = createSignal<string>('Lesson');
    // Single loading state - true until iframe is fully loaded
    const [isReady, setIsReady] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            document.title = 'FluentXVerse';
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    createEffect(on(() => [lessonId()], () => {
        const _cleanup3 = untrack(() => {
            if (lessonId()) {
                loadLesson();
            }
            else {
                setError('No lesson ID provided');
            }
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const loadLesson = async () => {
        try {
            setError(null);
            // Use the tutor endpoint to get the proper tutor view URL (with hints)
            const result = await lessonApi.getTutorLesson(lessonId());
            if (result.success && result.viewUrl) {
                setViewUrl(result.viewUrl);
                // Update page title with lesson name
                if (result.lesson?.title) {
                    setLessonTitle(result.lesson.title);
                    document.title = `${result.lesson.title} | FluentXVerse`;
                }
                // Note: isReady stays false until iframe onLoad fires
            }
            else {
                setError(result.error || 'Failed to load lesson');
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load lesson');
        }
    };
    const handleBack = () => {
        // Close this tab if it was opened as a new tab, otherwise navigate back
        if (window.opener) {
            window.close();
        }
        else {
            _state1.route('/materials/conversational-skills');
        }
    };
    return createMemo(() => {
        // Error state
        if (error()) {
            return (<div class="lesson-fullpage">
        <div class="lesson-fullpage-error">
          <div class="error-icon">
            <TutorIcon name="fi-sr-exclamation"/>
          </div>
          <h3>Failed to load lesson</h3>
          <p>{error()}</p>
          <button onClick={handleBack} class="btn-back">
            <TutorIcon name="fi-sr-arrow-left"/>
            Back to Materials
          </button>
        </div>
      </div>);
        }
        return (<div class="lesson-fullpage">
      {/* Single loading spinner - shows until iframe content is fully loaded */}
      {!isReady() && (<div class="lesson-fullpage-loading">
          <div class="spinner"></div>
          <p>Loading lesson...</p>
        </div>)}
      {/* Iframe starts loading immediately when viewUrl is available */}
      {viewUrl() && (<iframe src={viewUrl()} class={`lesson-fullpage-iframe ${isReady() ? 'loaded' : 'loading'}`} title={lessonTitle()} allowfullscreen onLoad={() => setIsReady(true)}/>)}
    </div>);
    }) as unknown as JSX.Element;
}
