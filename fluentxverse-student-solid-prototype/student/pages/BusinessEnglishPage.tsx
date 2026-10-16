import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { lessonApi, type Lesson } from '../api/lesson.api';
import CourseLibrary from '../Components/Materials/MaterialLibrary';
const transformLessonMaterialToLesson = (lessonMaterial: any): Lesson => {
    const chapterLabel = lessonMaterial.chapterLabel
        || (lessonMaterial.chapterName
            ? `Chapter ${lessonMaterial.chapter}: ${lessonMaterial.chapterName}`
            : `Chapter ${lessonMaterial.chapter}`);
    const lessonLabel = lessonMaterial.lessonTitle || `Lesson ${lessonMaterial.lessonNumber}: ${lessonMaterial.lessonName}`;
    return {
        id: lessonMaterial.id,
        title: lessonLabel,
        slug: lessonMaterial.id,
        status: 'published',
        parentId: null,
        forkOf: null,
        isFork: false,
        createdBy: lessonMaterial.createdBy || '',
        createdByName: lessonMaterial.createdByName || null,
        storagePath: '',
        createdAt: lessonMaterial.createdAt || '',
        updatedAt: lessonMaterial.updatedAt || '',
        publishedAt: lessonMaterial.updatedAt || null,
        lessonData: {
            course: lessonMaterial.course,
            skill: lessonMaterial.skill,
            sections: lessonMaterial.sections,
            header: {
                levelBadge: `Level ${lessonMaterial.level || 1}`,
                chapterLabel,
                lessonLabel,
                goalText: lessonMaterial.goalTextEn || '',
                goalSubtext: lessonMaterial.goalTextJp || '',
                backgroundImage: lessonMaterial.backgroundImage || '',
                overlayColor: lessonMaterial.overlayColor || ''
            }
        } as Lesson['lessonData'],
        currentVersion: lessonMaterial.version
    };
};
export default function BusinessEnglishPage() {
    const [lessons, setLessons] = createSignal<Lesson[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);
    createEffect(on(() => [], () => {
        const _cleanup0 = untrack(() => { document.title = 'Business English | FluentXVerse'; loadLessons(); });
        if (typeof _cleanup0 === "function")
            onCleanup(_cleanup0);
    }));
    const loadLessons = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const result = await lessonApi.getPublishedLessonMaterials('business-english');
            if (result.success) {
                setLessons(result.lessons.map(transformLessonMaterialToLesson));
            }
            else {
                setError(result.error || 'Failed to load lessons');
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load lessons');
        }
        finally {
            setIsLoading(false);
        }
    };
    return <CourseLibrary course="business-english" lessons={lessons()} loading={isLoading()} error={error()} retry={loadLessons}/>;
}
