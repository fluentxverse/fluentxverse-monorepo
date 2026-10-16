import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "../Components/Common/TutorIcon";
import { useRoute } from "../routing";
import { lessonApi } from '../api/lesson.api';
import { useThemeStore } from '../context/ThemeContext';
import { getEmbeddedTheme } from '../hooks/useEmbeddedTheme';
import { cacheBusinessEnglishLesson, readCachedBusinessEnglishLesson } from '../utils/businessEnglishCache';
import { API_BASE_URL } from '../config/api';
import { normalizeLessonMedia } from '../../../shared/lessonMedia';
import './BusinessEnglishVisualEditor.css';
import './BusinessEnglishPreview.css';
type LessonMaterial = any;
interface BusinessEnglishPreviewProps {
    lessonId?: string;
    embedded?: boolean;
    forcedTheme?: ThemeMode;
    onRequestClose?: () => void;
}
type LessonType = 'READING' | 'SPEAKING' | 'LISTENING' | 'WRITING' | 'REVIEW';
type ThemeMode = 'dark' | 'light';
type NoteType = 'instruction' | 'script' | 'tip' | 'question';
type UnderstandTutorGroup = 'comprehension' | 'wordBank' | 'soundPractice' | 'activityBlocks';
type ActivityBlockType = 'matching' | 'multipleChoice' | 'sentenceReorder' | 'errorCorrection' | 'dialogueCompletion' | 'trueFalse' | 'readingPassage' | 'categorization' | 'image';
interface TutorNote {
    type: NoteType;
    text: string;
    group?: UnderstandTutorGroup | string;
}
const normalizeTutorNoteType = (type: string = 'instruction'): NoteType => ['instruction', 'script', 'tip', 'question'].includes(type)
    ? (type as NoteType)
    : 'instruction';
const stripHtmlForTutorGrouping = (value: string = '') => value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
const normalizeUnderstandTutorNotes = (notes: TutorNote[] = []): TutorNote[] => {
    let currentGroup: UnderstandTutorGroup = 'comprehension';
    return notes.map((note) => {
        if (note.group)
            return note;
        const text = stripHtmlForTutorGrouping(note.text);
        if (text.includes('word bank') ||
            text.includes('read each word') ||
            text.includes('read the word') ||
            text.includes('definition') ||
            text.includes('meaning')) {
            currentGroup = 'wordBank';
        }
        else if (text.includes('sound practice') ||
            text.includes('pronunciation') ||
            text.includes('pronounce') ||
            text.includes('mouth') ||
            /\/[^/\s]{1,12}\//.test(text)) {
            currentGroup = 'soundPractice';
        }
        else if (text.includes('profile card') ||
            text.includes('read the profile card') ||
            text.includes('team directory') ||
            text.includes('directory entry') ||
            text.includes('read the entry') ||
            text.includes('comprehension question') ||
            text.includes('ask the questions one by one') ||
            text.includes('ask the comprehension questions') ||
            text.includes('read the passage')) {
            currentGroup = 'activityBlocks';
        }
        else if (text.includes('pattern drill') ||
            text.includes('patterns') ||
            text.includes('pattern') ||
            text.includes('table') ||
            text.includes('sentence')) {
            currentGroup = 'comprehension';
        }
        return { ...note, group: currentGroup };
    });
};
interface PatternItem {
    en: string;
    kr: string;
}
interface VocabItem {
    word: string;
    pos: string;
    translation: string;
    definition?: string;
    pronunciation?: string;
}
interface PronunciationColumn {
    symbol: string;
    words: Array<{
        en: string;
        kr: string;
    }>;
}
interface FillRow {
    parts: Array<{
        text: string;
        isBlank: boolean;
    }>;
}
interface PatternDrill {
    label: string;
    labelKr: string;
    template: string;
    examples: Array<{
        en: string;
        kr: string;
    }>;
}
interface DialogueLine {
    role: 'tutor' | 'student';
    en: string;
    kr: string;
}
interface GuideQuestion {
    text: string;
}
const normalizeChallengeTutorNotes = (notes: TutorNote[] = [], guideQuestions: GuideQuestion[] = []): TutorNote[] => {
    const normalizedNotes = (Array.isArray(notes) ? notes : []).map((note) => ({
        ...note,
        type: normalizeTutorNoteType(note?.type),
        text: note?.text || ''
    })).filter((note, index, arr) => {
        if (note.type !== 'question')
            return true;
        const normalizedText = stripHtmlForTutorGrouping(note.text);
        if (!normalizedText)
            return false;
        return arr.findIndex((candidate) => (normalizeTutorNoteType(candidate?.type) === 'question' &&
            stripHtmlForTutorGrouping(candidate?.text || '') === normalizedText)) === index;
    });
    const hasQuestionNotes = normalizedNotes.some((note) => (note.type === 'question' && stripHtmlForTutorGrouping(note.text)));
    if (hasQuestionNotes) {
        return normalizedNotes;
    }
    const existingQuestionTexts = new Set(normalizedNotes
        .filter((note) => note.type === 'question')
        .map((note) => stripHtmlForTutorGrouping(note.text))
        .filter(Boolean));
    const legacyQuestionNotes = (Array.isArray(guideQuestions) ? guideQuestions : []).reduce<TutorNote[]>((acc, question) => {
        const text = question?.text || '';
        const normalizedText = stripHtmlForTutorGrouping(text);
        if (normalizedText && existingQuestionTexts.has(normalizedText)) {
            return acc;
        }
        if (normalizedText) {
            existingQuestionTexts.add(normalizedText);
        }
        acc.push({ type: 'question', text });
        return acc;
    }, []);
    return [...normalizedNotes, ...legacyQuestionNotes];
};
const getQuestionNoteOrdinal = (notes: TutorNote[] = [], index: number) => notes
    .slice(0, index + 1)
    .filter((note) => normalizeTutorNoteType(note?.type) === 'question')
    .length;
interface DiscussionCategory {
    title: string;
    questions: string[];
}
interface ActivityBlockBase {
    type: ActivityBlockType;
    id: string;
    title: string;
    titleKr: string;
}
interface MatchingBlock extends ActivityBlockBase {
    type: 'matching';
    pairs: Array<{
        left: string;
        right: string;
    }>;
}
interface MultipleChoiceBlock extends ActivityBlockBase {
    type: 'multipleChoice';
    items: Array<{
        question: string;
        questionKr: string;
        options: Array<{
            text: string;
            isCorrect: boolean;
        }>;
    }>;
}
interface SentenceReorderBlock extends ActivityBlockBase {
    type: 'sentenceReorder';
    items: Array<{
        jumbled: string;
        answer: string;
    }>;
}
interface ErrorCorrectionBlock extends ActivityBlockBase {
    type: 'errorCorrection';
    items: Array<{
        sentence: string;
        corrected: string;
        hint: string;
    }>;
}
interface DialogueCompletionBlock extends ActivityBlockBase {
    type: 'dialogueCompletion';
    slots: Array<{
        role: 'tutor' | 'student';
        text: string;
        isBlank: boolean;
    }>;
}
interface TrueFalseBlock extends ActivityBlockBase {
    type: 'trueFalse';
    items: Array<{
        statement: string;
        statementKr: string;
        answer: boolean;
    }>;
}
interface ReadingPassageBlock extends ActivityBlockBase {
    type: 'readingPassage';
    passage: string;
    questions: Array<{
        question: string;
        questionKr: string;
    }>;
}
interface CategorizationBlock extends ActivityBlockBase {
    type: 'categorization';
    categories: Array<{
        name: string;
        items: string[];
    }>;
}
interface ImageBlock extends ActivityBlockBase {
    type: 'image';
    images: Array<{
        src: string;
        label: string;
    }>;
}
type ActivityBlock = MatchingBlock | MultipleChoiceBlock | SentenceReorderBlock | ErrorCorrectionBlock | DialogueCompletionBlock | TrueFalseBlock | ReadingPassageBlock | CategorizationBlock | ImageBlock;
interface BELessonData {
    lessonType: LessonType;
    hiddenBlocks: string[];
    introduce: {
        goalEn: string;
        goalKr: string;
        situationEn: string;
        situationKr: string;
        taskEn: string;
        taskKr: string;
        tutorNotes: TutorNote[];
    };
    present: {
        patterns: PatternItem[];
        vocabulary: VocabItem[];
        pronunciation: {
            instruction: string;
            instructionKr: string;
            left: PronunciationColumn;
            right: PronunciationColumn;
        };
        tutorNotes: TutorNote[];
    };
    understand: {
        instruction: string;
        instructionKr: string;
        fillRows: FillRow[];
        patternDrills: PatternDrill[];
        activityBlocks: ActivityBlock[];
        tutorNotes: TutorNote[];
    };
    practice: {
        steps: Array<{
            title: string;
            instructionEn: string;
            instructionKr: string;
            content: string;
            dialogue?: DialogueLine[];
            wordBox?: Array<{
                word: string;
                translation?: string;
            }>;
            tutorNotes: TutorNote[];
        }>;
        activityBlocks: ActivityBlock[];
    };
    challenge: {
        scenarioEn: string;
        scenarioKr: string;
        guideQuestions: GuideQuestion[];
        roleplayTable?: {
            you: string;
            coworkers: string[];
        };
        activityBlocks: ActivityBlock[];
        tutorNotes: TutorNote[];
    };
    discussion: {
        instructionEn: string;
        instructionKr: string;
        categories: DiscussionCategory[];
        activityBlocks: ActivityBlock[];
        tutorNotes: TutorNote[];
    };
    feedback: {
        goalReviewEn: string;
        goalReviewKr: string;
        feedbackTemplate: string;
        nextLessonLabel: string;
        nextLessonName: string;
        tutorNotes: TutorNote[];
    };
}
interface PreviewOverrides {
    chapterName?: string;
    lessonName?: string;
    goalTextEn?: string;
    goalTextJp?: string;
    theme?: ThemeMode;
    beData?: BELessonData;
}
const PCPP_PAGES = [
    { key: 'page1', num: '1', label: 'Introduce + Present' },
    { key: 'page2', num: '2', label: 'Understand + Vocab' },
    { key: 'page3', num: '3', label: 'Practice 1-2' },
    { key: 'page4', num: '4', label: 'Practice 3-4' },
    { key: 'page5', num: '5', label: 'Challenge' },
    { key: 'page6', num: '6', label: 'Discussion' },
    { key: 'page7', num: '7', label: 'Feedback' },
] as const;
const SECTION_STEPS = [
    { num: 1, short: 'Warm-Up' },
    { num: 2, short: 'Present' },
    { num: 3, short: 'Comp.' },
    { num: 4, short: 'Drill' },
    { num: 5, short: 'Simul.' },
    { num: 6, short: 'Wrap-Up' },
];
const LEVEL_BADGES: Record<number, string> = {
    3: 'BEGINNER',
    4: 'HIGH BEGINNER',
    5: 'HIGH BEGINNER',
    6: 'INTERMEDIATE',
    7: 'INTERMEDIATE',
    8: 'HIGH INTERMEDIATE',
    9: 'HIGH INTERMEDIATE',
    10: 'ADVANCED'
};
const ACTIVITY_BLOCK_META: Record<ActivityBlockType, {
    icon: string;
}> = {
    matching: { icon: 'ri-links-line' },
    multipleChoice: { icon: 'ri-checkbox-circle-line' },
    sentenceReorder: { icon: 'ri-sort-asc' },
    errorCorrection: { icon: 'ri-eraser-line' },
    dialogueCompletion: { icon: 'ri-chat-3-line' },
    trueFalse: { icon: 'ri-checkbox-line' },
    readingPassage: { icon: 'ri-article-line' },
    categorization: { icon: 'ri-layout-grid-line' },
    image: { icon: 'ri-image-line' }
};
const DEFAULT_BE_DATA: BELessonData = {
    lessonType: 'READING',
    hiddenBlocks: [],
    introduce: {
        goalEn: '',
        goalKr: '',
        situationEn: '',
        situationKr: '',
        taskEn: '',
        taskKr: '',
        tutorNotes: []
    },
    present: {
        patterns: [],
        vocabulary: [],
        pronunciation: {
            instruction: '',
            instructionKr: '',
            left: { symbol: '', words: [] },
            right: { symbol: '', words: [] }
        },
        tutorNotes: []
    },
    understand: {
        instruction: '',
        instructionKr: '',
        fillRows: [],
        patternDrills: [],
        activityBlocks: [],
        tutorNotes: []
    },
    practice: {
        steps: [],
        activityBlocks: []
    },
    challenge: {
        scenarioEn: '',
        scenarioKr: '',
        guideQuestions: [],
        roleplayTable: undefined,
        activityBlocks: [],
        tutorNotes: []
    },
    discussion: {
        instructionEn: '',
        instructionKr: '',
        categories: [],
        activityBlocks: [],
        tutorNotes: []
    },
    feedback: {
        goalReviewEn: '',
        goalReviewKr: '',
        feedbackTemplate: '',
        nextLessonLabel: '',
        nextLessonName: '',
        tutorNotes: []
    }
};
const noteIcons: Record<NoteType, string> = {
    instruction: 'ri-file-list-3-line',
    script: 'ri-chat-quote-line',
    tip: 'ri-lightbulb-line',
    question: 'ri-question-line'
};
const html = (value?: string) => ({ __html: value || '' });
const normalizeActivityBlocks = (blocks: any[] = []): ActivityBlock[] => blocks.map((block: any) => {
    switch (block?.type) {
        case 'matching':
            return { ...block, pairs: Array.isArray(block.pairs) ? block.pairs : [] } as MatchingBlock;
        case 'multipleChoice':
            return {
                ...block,
                items: Array.isArray(block.items)
                    ? block.items.map((item: any) => ({
                        ...item,
                        options: Array.isArray(item?.options) ? item.options : []
                    }))
                    : []
            } as MultipleChoiceBlock;
        case 'sentenceReorder':
        case 'errorCorrection':
        case 'trueFalse':
            return { ...block, items: Array.isArray(block.items) ? block.items : [] } as ActivityBlock;
        case 'dialogueCompletion':
            return { ...block, slots: Array.isArray(block.slots) ? block.slots : [] } as DialogueCompletionBlock;
        case 'readingPassage':
            return {
                ...block,
                passage: block?.passage || '',
                questions: Array.isArray(block.questions) ? block.questions : []
            } as ReadingPassageBlock;
        case 'categorization':
            return {
                ...block,
                categories: Array.isArray(block.categories)
                    ? block.categories.map((category: any) => ({
                        ...category,
                        items: Array.isArray(category?.items) ? category.items : []
                    }))
                    : []
            } as CategorizationBlock;
        case 'image':
            return { ...block, images: Array.isArray(block.images) ? block.images : [] } as ImageBlock;
        default:
            return block as ActivityBlock;
    }
});
const mergeWithDefaults = (raw: any): BELessonData => {
    const beData = raw || {};
    const patternDrills = Array.isArray(beData.understand?.patternDrills)
        ? beData.understand.patternDrills.map((drill: any) => {
            const examples = Array.isArray(drill?.examples) ? [...drill.examples] : [];
            while (examples.length < 5)
                examples.push({ en: '', kr: '' });
            return { ...drill, examples };
        })
        : [];
    const challengeTutorNotes = normalizeChallengeTutorNotes(Array.isArray(beData.challenge?.tutorNotes) ? beData.challenge.tutorNotes : [], Array.isArray(beData.challenge?.guideQuestions) ? beData.challenge.guideQuestions : []);
    return {
        ...DEFAULT_BE_DATA,
        ...beData,
        introduce: {
            ...DEFAULT_BE_DATA.introduce,
            ...(beData.introduce || {}),
            tutorNotes: Array.isArray(beData.introduce?.tutorNotes) ? beData.introduce.tutorNotes : []
        },
        present: {
            ...DEFAULT_BE_DATA.present,
            ...(beData.present || {}),
            patterns: beData.present?.patterns || [],
            vocabulary: beData.present?.vocabulary || [],
            pronunciation: {
                ...DEFAULT_BE_DATA.present.pronunciation,
                ...(beData.present?.pronunciation || {}),
                left: {
                    ...DEFAULT_BE_DATA.present.pronunciation.left,
                    ...(beData.present?.pronunciation?.left || {}),
                    words: beData.present?.pronunciation?.left?.words || []
                },
                right: {
                    ...DEFAULT_BE_DATA.present.pronunciation.right,
                    ...(beData.present?.pronunciation?.right || {}),
                    words: beData.present?.pronunciation?.right?.words || []
                }
            },
            tutorNotes: Array.isArray(beData.present?.tutorNotes) ? beData.present.tutorNotes : []
        },
        understand: {
            ...DEFAULT_BE_DATA.understand,
            ...(beData.understand || {}),
            fillRows: beData.understand?.fillRows || [],
            patternDrills,
            activityBlocks: normalizeActivityBlocks(beData.understand?.activityBlocks || []),
            tutorNotes: normalizeUnderstandTutorNotes(Array.isArray(beData.understand?.tutorNotes) ? beData.understand.tutorNotes : [])
        },
        practice: {
            ...DEFAULT_BE_DATA.practice,
            ...(beData.practice || {}),
            steps: Array.isArray(beData.practice?.steps)
                ? beData.practice.steps.map((step: any) => ({
                    ...step,
                    tutorNotes: Array.isArray(step?.tutorNotes) ? step.tutorNotes : [],
                    dialogue: Array.isArray(step?.dialogue) ? step.dialogue : undefined,
                    wordBox: Array.isArray(step?.wordBox) ? step.wordBox : undefined
                }))
                : [],
            activityBlocks: normalizeActivityBlocks(beData.practice?.activityBlocks || [])
        },
        challenge: {
            ...DEFAULT_BE_DATA.challenge,
            ...(beData.challenge || {}),
            roleplayTable: beData.challenge?.roleplayTable
                ? {
                    ...beData.challenge.roleplayTable,
                    you: beData.challenge.roleplayTable.you || '',
                    coworkers: Array.isArray(beData.challenge.roleplayTable.coworkers)
                        ? beData.challenge.roleplayTable.coworkers
                        : []
                }
                : undefined,
            activityBlocks: normalizeActivityBlocks(beData.challenge?.activityBlocks || []),
            guideQuestions: [],
            tutorNotes: challengeTutorNotes
        },
        discussion: {
            ...DEFAULT_BE_DATA.discussion,
            ...(beData.discussion || {}),
            categories: Array.isArray(beData.discussion?.categories)
                ? beData.discussion.categories.map((category: any) => ({
                    ...category,
                    questions: Array.isArray(category?.questions) ? category.questions : []
                }))
                : [],
            activityBlocks: normalizeActivityBlocks(beData.discussion?.activityBlocks || []),
            tutorNotes: Array.isArray(beData.discussion?.tutorNotes) ? beData.discussion.tutorNotes : []
        },
        feedback: {
            ...DEFAULT_BE_DATA.feedback,
            ...(beData.feedback || {}),
            tutorNotes: Array.isArray(beData.feedback?.tutorNotes) ? beData.feedback.tutorNotes : []
        }
    };
};
function StaticHtml(_props0: {
    className?: string;
    value?: string;
    emptyText?: string;
}) {
    return createMemo(() => {
        if (!_props0["value"] && _props0["emptyText"]) {
            return <div class={`${_props0["className"] === undefined ? '' : _props0["className"]} beve-preview-empty`}>{_props0["emptyText"]}</div>;
        }
        return <div class={_props0["className"] === undefined ? '' : _props0["className"]} innerHTML={html(_props0["value"]).__html}/>;
    }) as unknown as JSX.Element;
}
export default function BusinessEnglishPreview(_props1: BusinessEnglishPreviewProps = {}) {
    const _state2 = useRoute();
    const id = createMemo(() => _props1["lessonId"] || _state2.params?.id);
    const isEmbedded = createMemo(() => (_props1["embedded"] === undefined ? false : _props1["embedded"]) || (typeof window !== 'undefined' && window.self !== window.top));
    const appResolvedTheme = createMemo(() => useThemeStore((state) => state.resolvedTheme));
    const [lesson, setLesson] = createSignal<LessonMaterial | null>(null);
    const [previewOverrides, setPreviewOverrides] = createSignal<PreviewOverrides | null>(null);
    const [hasSessionData, setHasSessionData] = createSignal(false);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal('');
    const [activePage, setActivePage] = createSignal<string>('page1');
    const [theme, setTheme] = createSignal<ThemeMode>((() => _props1["forcedTheme"] || getEmbeddedTheme() || appResolvedTheme())());
    const canvasRef = { current: null } as {
        current: (HTMLDivElement | null) | null;
    };
    const pageRefs = { current: {} } as {
        current: Record<string, HTMLDivElement | null> | null;
    };
    const page1IntroStudentRef = { current: null } as {
        current: (HTMLDivElement | null) | null;
    };
    const [page1IntroTutorMaxHeight, setPage1IntroTutorMaxHeight] = createSignal<number | null>(null);
    createEffect(on(() => [id()], () => {
        const _cleanup9 = untrack(() => {
            if (!id())
                return;
            const stored = sessionStorage.getItem(`business-english-preview-${id()}`);
            const cachedLesson = readCachedBusinessEnglishLesson<LessonMaterial>(id());
            if (stored) {
                try {
                    const parsed = normalizeLessonMedia(JSON.parse(stored), API_BASE_URL) as PreviewOverrides;
                    setPreviewOverrides(parsed);
                    setHasSessionData(true);
                    if (parsed.theme)
                        setTheme(parsed.theme);
                }
                catch (sessionError) {
                    console.error('Failed to parse Business English preview session data:', sessionError);
                }
            }
            if (cachedLesson) {
                setLesson(cachedLesson);
                setLoading(false);
                setError('');
            }
            if (cachedLesson) {
                const refreshTimeoutId = window.setTimeout(() => {
                    void loadLesson(id(), true);
                }, 1200);
                return () => window.clearTimeout(refreshTimeoutId);
            }
            void loadLesson(id(), false);
        });
        if (typeof _cleanup9 === "function")
            onCleanup(_cleanup9);
    }));
    createEffect(on(() => [loading()], () => {
        const _cleanup10 = untrack(() => {
            const canvas = canvasRef.current;
            if (!canvas)
                return;
            const handleScroll = () => {
                const keys = PCPP_PAGES.map((page) => page.key);
                for (let i = keys.length - 1; i >= 0; i -= 1) {
                    const el = pageRefs.current[keys[i]];
                    if (el && el.getBoundingClientRect().top <= 200) {
                        setActivePage(keys[i]);
                        break;
                    }
                }
            };
            canvas.addEventListener('scroll', handleScroll, { passive: true });
            return () => canvas.removeEventListener('scroll', handleScroll);
        });
        if (typeof _cleanup10 === "function")
            onCleanup(_cleanup10);
    }));
    createEffect(on(() => [previewOverrides(), lesson(), theme(), loading()], () => {
        const _cleanup11 = untrack(() => {
            const target = page1IntroStudentRef.current;
            if (!target)
                return;
            const updateHeight = () => {
                const nextHeight = Math.ceil(target.getBoundingClientRect().height);
                setPage1IntroTutorMaxHeight(nextHeight > 0 ? nextHeight : null);
            };
            updateHeight();
            if (typeof ResizeObserver === 'undefined') {
                window.addEventListener('resize', updateHeight);
                return () => window.removeEventListener('resize', updateHeight);
            }
            const observer = new ResizeObserver(() => updateHeight());
            observer.observe(target);
            window.addEventListener('resize', updateHeight);
            return () => {
                observer.disconnect();
                window.removeEventListener('resize', updateHeight);
            };
        });
        if (typeof _cleanup11 === "function")
            onCleanup(_cleanup11);
    }));
    createEffect(on(() => [], () => {
        const _cleanup12 = untrack(() => {
            const handleMessage = (event: MessageEvent) => {
                if (event.origin !== window.location.origin) {
                    return;
                }
                if (event.data?.type === 'business-english:set-theme' && (event.data.theme === 'light' || event.data.theme === 'dark')) {
                    setTheme(event.data.theme);
                }
            };
            window.addEventListener('message', handleMessage);
            return () => window.removeEventListener('message', handleMessage);
        });
        if (typeof _cleanup12 === "function")
            onCleanup(_cleanup12);
    }));
    createEffect(on(() => [_props1["forcedTheme"]], () => {
        const _cleanup13 = untrack(() => {
            if (_props1["forcedTheme"]) {
                setTheme(_props1["forcedTheme"]);
            }
        });
        if (typeof _cleanup13 === "function")
            onCleanup(_cleanup13);
    }));
    createEffect(on(() => [appResolvedTheme(), _props1["forcedTheme"], isEmbedded()], () => {
        const _cleanup14 = untrack(() => {
            if (_props1["forcedTheme"] || isEmbedded()) {
                return;
            }
            setTheme(appResolvedTheme());
        });
        if (typeof _cleanup14 === "function")
            onCleanup(_cleanup14);
    }));
    const loadLesson = async (lessonId: string, hasImmediateContent = false) => {
        try {
            if (!hasImmediateContent) {
                setLoading(true);
            }
            const result = await lessonApi.getPublicLessonMaterial(lessonId);
            const data = result.success ? result.lesson : null;
            if (!data) {
                throw new Error(result.error || 'Failed to load Business English preview');
            }
            cacheBusinessEnglishLesson(lessonId, data);
            setLesson(data);
            setError('');
        }
        catch (loadError) {
            console.error('Failed to load Business English lesson preview:', loadError);
            if (!sessionStorage.getItem(`business-english-preview-${lessonId}`)) {
                setError('Failed to load Business English preview');
            }
        }
        finally {
            setLoading(false);
        }
    };
    const scrollToPage = (key: string) => {
        const el = pageRefs.current[key];
        if (el)
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const toggleTheme = () => {
        const next = theme() === 'dark' ? 'light' : 'dark';
        setTheme(next);
        try {
            localStorage.setItem('beve-theme', next);
        }
        catch {
            // ignore
        }
    };
    const handleBack = () => {
        if (isEmbedded()) {
            if (_props1["onRequestClose"]) {
                _props1["onRequestClose"]();
            }
            else {
                window.parent?.postMessage({ type: 'closeMaterial' }, window.location.origin);
            }
            return;
        }
        if (window.history.length > 1) {
            window.history.back();
            return;
        }
        window.location.href = '/materials';
    };
    const handleClose = () => {
        if (isEmbedded()) {
            if (_props1["onRequestClose"]) {
                _props1["onRequestClose"]();
            }
            else {
                window.parent?.postMessage({ type: 'closeMaterial' }, window.location.origin);
            }
            return;
        }
        if (window.history.length > 1) {
            window.history.back();
            return;
        }
        window.location.href = '/materials';
    };
    return createMemo(() => {
        if (loading()) {
            return (<div class={`beve ${theme()}${isEmbedded() ? ' beve-preview--embedded' : ''}`}>
        <div class="beve-loading">
          <TutorIcon name="ri-loader-4-line"/>
          <span>Loading lesson preview...</span>
        </div>
      </div>);
        }
        if ((error() || !lesson()) && !hasSessionData()) {
            return (<div class={`beve ${theme()}${isEmbedded() ? ' beve-preview--embedded' : ''}`}>
        <div class="beve-error">
          <TutorIcon name="ri-error-warning-line"/>
          <span>{error() || 'Lesson not found'}</span>
          <button onClick={handleBack}>Back to Materials</button>
        </div>
      </div>);
        }
        const chapterName = createMemo(() => previewOverrides()?.chapterName ?? lesson()?.chapterName ?? 'Preview');
        const lessonName = createMemo(() => previewOverrides()?.lessonName ?? lesson()?.lessonName ?? 'Untitled Lesson');
        const goalTextEn = createMemo(() => previewOverrides()?.goalTextEn ?? lesson()?.goalTextEn ?? '');
        const goalTextKr = createMemo(() => previewOverrides()?.goalTextJp ?? lesson()?.goalTextJp ?? '');
        const beData = createMemo(() => mergeWithDefaults(previewOverrides()?.beData ?? lesson()?.beData));
        const level = createMemo(() => lesson()?.level ?? 0);
        const chapter = createMemo(() => lesson()?.chapter ?? 0);
        const lessonNumber = createMemo(() => lesson()?.lessonNumber ?? 0);
        const skill = createMemo(() => (lesson()?.skill || '').toUpperCase());
        const isHidden = (blockId: string) => (beData().hiddenBlocks || []).includes(blockId);
        const totalSteps = createMemo(() => beData().practice.steps.length);
        const page3StepIndices = createMemo(() => Array.from({ length: Math.ceil(totalSteps() / 2) }, (_, i) => i));
        const page4StepIndices = createMemo(() => Array.from({ length: totalSteps() - page3StepIndices().length }, (_, i) => i + page3StepIndices().length));
        const renderPageHeader = (pageNum: number) => (<div class="beve-page-header">
      <div class="beve-header-row1">
        <div class="beve-header-brand">
          <span class="beve-header-brand-text">
            <span class="brand-fluent">Fluent</span>
            <span class="brand-x">X</span>
            <span class="brand-verse">Verse</span>
          </span>
          <span class="beve-header-brand-sub">Business English</span>
        </div>
        <div class="beve-header-meta">
          <span class="beve-header-level">
            Level <strong>{level()}</strong>
          </span>
          <span class="beve-header-meta-divider">|</span>
          <span class="beve-header-page">
            Page <strong>{pageNum}</strong>
          </span>
        </div>
      </div>
      <div class="beve-header-row2">
        <span class="beve-header-chapter">
          Chapter {chapter()} / {chapterName() || 'Untitled'}
        </span>
        <div class="beve-header-row2-right">
          <span class="beve-skill-badge">{beData().lessonType.toLowerCase()}</span>
        </div>
      </div>
      <div class="beve-header-row3">
        <h2 class="beve-header-lesson">
          <span class="beve-header-lesson-number">Lesson {lessonNumber()}</span>{' '}
          <span class="beve-header-lesson-title">{lessonName() || 'Untitled'}</span>
        </h2>
      </div>
    </div>);
        const renderSectionBanner = (activeNum: number, title: string) => (<div class="beve-section-banner">
      <div class="beve-section-banner-left">
        <span class="beve-section-banner-title">{title}</span>
      </div>
      <div class="beve-chevron-bar">
        {SECTION_STEPS.map((step, index) => (<div class={`beve-chevron${step.num === activeNum ? ' active' : ''}${step.num < activeNum ? ' completed' : ''}`}>
            {index > 0 && <span class="beve-chevron-connector"/>}
            <span class="beve-chevron-num">{step.num}</span>
          </div>))}
      </div>
    </div>);
        const renderPageFooter = () => (<div class="beve-page-footer">
      <div class="beve-footer-content">
        <div class="beve-footer-left">
          <span class="beve-page-footer-brand">
            <span class="brand-fluent">Fluent</span>
            <span class="brand-x">X</span>
            <span class="brand-verse">Verse</span>
          </span>
          <span class="beve-footer-divider">/</span>
          <span class="beve-footer-course">Business English</span>
        </div>
        <div class="beve-footer-center"/>
        <div class="beve-footer-right">
          <span class="beve-footer-copy">&copy; {new Date().getFullYear()} FluentXVerse</span>
        </div>
      </div>
    </div>);
        const renderTutorNotes = (notes: TutorNote[], group?: UnderstandTutorGroup) => (<>
      <div class="beve-col-tutor-title">
        <TutorIcon name="ri-booklet-line"/> Teaching Notes
      </div>
      <div class="beve-tutor-notes">
        {(group ? notes.filter((note) => (note.group || 'comprehension') === group) : notes).length > 0 ? ((group ? notes.filter((note) => (note.group || 'comprehension') === group) : notes).map((note, index) => (<div class={`beve-tutor-note ${note.type}`}>
              <div class="beve-tutor-note-type">
                <TutorIcon name={noteIcons[note.type] || 'ri-file-text-line'}/> {note.type}
              </div>
              <StaticHtml className="beve-preview-static-rich" value={note.text} emptyText="No note text"/>
            </div>))) : (<div class="beve-preview-empty">No teaching notes yet.</div>)}
      </div>
    </>);
        const renderHintBox = () => (<div class="beve-hint-box">
      <div class="beve-hint-label">Key Expressions</div>
      <div class="beve-hint-patterns">
        {(beData().present.patterns || []).map((pattern, index) => (<div class="beve-hint-pattern">
            <span class="beve-hint-en" innerHTML={html(pattern.en).__html}/>
            <span class="beve-hint-kr" innerHTML={html(`(${pattern.kr})`).__html}/>
          </div>))}
      </div>
    </div>);
        const renderActivityBlock = (block: ActivityBlock) => {
            const icon = ACTIVITY_BLOCK_META[block.type]?.icon || 'ri-file-text-line';
            return (<div class="beve-activity-block">
        <div class="beve-activity-header">
          <TutorIcon name={icon}/>
          <div class="beve-activity-title">{block.title}</div>
        </div>

        {block.type === 'matching' && (<table class="beve-matching-table">
            <thead>
              <tr>
                <th>Left</th>
                <th>Right</th>
              </tr>
            </thead>
            <tbody>
              {(block.pairs || []).map((pair, index) => (<tr>
                  <td innerHTML={html(pair.left).__html}/>
                  <td innerHTML={html(pair.right).__html}/>
                </tr>))}
            </tbody>
          </table>)}

        {block.type === 'multipleChoice' &&
                    (block.items || []).map((item, questionIndex) => (<div class="beve-mcq-item">
              <div class="beve-mcq-question">
                <span class="beve-mcq-num">{questionIndex + 1}.</span>
                <StaticHtml className="beve-preview-static-rich" value={item.question}/>
              </div>
              <div class="beve-mcq-options">
                {(item.options || []).map((option, optionIndex) => (<div class={`beve-mcq-option${option.isCorrect ? ' correct' : ''}`}>
                    <span class="beve-preview-radio">
                      <TutorIcon name={option.isCorrect
                                ? 'ri-checkbox-circle-fill'
                                : 'ri-checkbox-blank-circle-line'}/>
                    </span>
                    <StaticHtml className="beve-preview-static-rich" value={option.text}/>
                  </div>))}
              </div>
            </div>))}

        {block.type === 'sentenceReorder' &&
                    (block.items || []).map((item, index) => (<div class="beve-reorder-item">
              <div class="beve-reorder-row">
                <span class="beve-reorder-label">Jumbled:</span>
                <StaticHtml className="beve-preview-static-rich" value={item.jumbled}/>
              </div>
              <div class="beve-reorder-row">
                <span class="beve-reorder-label">Answer:</span>
                <StaticHtml className="beve-preview-static-rich" value={item.answer}/>
              </div>
            </div>))}

        {block.type === 'errorCorrection' &&
                    (block.items || []).map((item, index) => (<div class="beve-error-item">
              <div class="beve-error-row">
                <span class="beve-error-label">×</span>
                <StaticHtml className="beve-preview-static-rich" value={item.sentence}/>
              </div>
              <div class="beve-error-row">
                <span class="beve-error-label">✓</span>
                <StaticHtml className="beve-preview-static-rich" value={item.corrected}/>
              </div>
              {item.hint && (<div class="beve-error-row">
                  <span class="beve-error-label">?</span>
                  <StaticHtml className="beve-preview-static-rich" value={item.hint}/>
                </div>)}
            </div>))}

        {block.type === 'dialogueCompletion' &&
                    (block.slots || []).map((slot, index) => (<div class={`beve-dialogue-slot ${slot.role}${slot.isBlank ? ' blank' : ''}`}>
              <div class="beve-dialogue-slot-header">
                <span class="beve-preview-role-pill">
                  {slot.role === 'tutor' ? 'Tutor' : 'Student'}
                </span>
                {slot.isBlank && <span class="beve-preview-blank-pill">Blank</span>}
              </div>
              <StaticHtml className="beve-preview-static-rich" value={slot.isBlank ? `${slot.text} ______` : slot.text}/>
            </div>))}

        {block.type === 'trueFalse' &&
                    (block.items || []).map((item, index) => (<div class="beve-tf-item">
              <div class="beve-tf-statement">
                <span class="beve-tf-num">{index + 1}.</span>
                <StaticHtml className="beve-preview-static-rich" value={item.statement}/>
              </div>
              <div class="beve-tf-answer">
                <span class={`beve-tf-btn${item.answer ? ' active' : ''}`}>TRUE</span>
                <span class={`beve-tf-btn${!item.answer ? ' active' : ''}`}>FALSE</span>
              </div>
            </div>))}

        {block.type === 'readingPassage' && (<>
            <div class="beve-reading-passage" innerHTML={html(block.passage).__html}/>
            <div class="beve-reading-questions">
              {(block.questions || []).map((question, index) => (<div class="beve-reading-q">
                  <span class="beve-reading-q-num">{index + 1}.</span>
                  <StaticHtml className="beve-preview-static-rich" value={question.question}/>
                </div>))}
            </div>
          </>)}

        {block.type === 'categorization' && (<div class="beve-categorize-grid">
            {(block.categories || []).map((category, index) => (<div class="beve-categorize-col">
                <div class="beve-categorize-col-header">
                  <TutorIcon name="ri-folder-2-line"/>
                  <StaticHtml className="beve-preview-static-rich" value={category.name}/>
                </div>
                {(category.items || []).map((item, itemIndex) => (<div class="beve-categorize-item">
                    <TutorIcon name="ri-check-line"/>
                    <StaticHtml className="beve-preview-static-rich" value={item}/>
                  </div>))}
              </div>))}
          </div>)}

        {block.type === 'image' && (<div class="beve-preview-image-grid">
            {(block.images || []).map((image, index) => (<figure class="beve-preview-image-card">
                {image.src ? (<img src={image.src} alt={image.label || `Activity ${index + 1}`}/>) : (<div class="beve-preview-image-placeholder">
                    <TutorIcon name="ri-image-line"/>
                  </div>)}
                {image.label && (<figcaption innerHTML={html(image.label).__html}/>)}
              </figure>))}
          </div>)}
      </div>);
        };
        const renderActivityBlocksArea = (blocks: ActivityBlock[]) => {
            if (!blocks.length)
                return null;
            return <div class="beve-activity-blocks-area">{blocks.map(renderActivityBlock)}</div>;
        };
        const renderPracticeStep = (stepIndex: number) => {
            const step = beData().practice.steps[stepIndex];
            if (!step)
                return null;
            return (<div class="beve-step-card">
        <div class="beve-step-header">
          <span class="step-num">{stepIndex + 1}</span>
          <div class="step-title-text">{step.title}</div>
        </div>
        <div class="beve-step-body">
          <div class="beve-step-instruction">
            <StaticHtml className="beve-preview-static-rich" value={step.instructionEn}/>
            {step.instructionKr && (<StaticHtml className="beve-step-instruction-kr" value={step.instructionKr}/>)}
          </div>

          {step.content && <StaticHtml className="beve-preview-static-rich" value={step.content}/>}

          {step.dialogue && step.dialogue.length > 0 && (<div class="beve-dialogue" style={cssStyle({ marginTop: step.content ? 12 : 0 })}>
              {step.dialogue.map((line, lineIndex) => (<div class={`beve-dialogue-line ${line.role}`}>
                  <span class="beve-dialogue-role">
                    {line.role === 'tutor' ? 'Tutor:' : 'Student:'}
                  </span>
                  <div style={cssStyle({ flex: 1 })}>
                    <StaticHtml className="beve-dialogue-text" value={line.en}/>
                    {line.kr && <StaticHtml className="beve-dialogue-text-kr" value={line.kr}/>}
                  </div>
                </div>))}
            </div>)}

          {step.wordBox && step.wordBox.length > 0 && (<div class="beve-word-box" style={cssStyle({ marginTop: 12 })}>
              <div class="beve-word-box-label">
                <TutorIcon name="ri-price-tag-3-line"/> Word Box
              </div>
              <div class="beve-word-box-items">
                {step.wordBox.map((item, index) => (<div class="beve-word-box-item">
                    <span>{item.word}</span>
                    {item.translation && (<span class="beve-word-box-trans">({item.translation})</span>)}
                  </div>))}
              </div>
            </div>)}
        </div>
      </div>);
        };
        const renderPracticeStepNotes = (stepIndex: number) => {
            const step = beData().practice.steps[stepIndex];
            if (!step) {
                return (<div class="beve-col-tutor-title">
          <TutorIcon name="ri-booklet-line"/> Teaching Notes
        </div>);
            }
            return (<>
        <div class="beve-col-tutor-title">
          <TutorIcon name="ri-booklet-line"/> Teaching Notes
        </div>
        <div class="beve-practice-note-panel-title">{step.title}</div>
        <div class="beve-tutor-notes">
          {(step.tutorNotes || []).length > 0 ? (step.tutorNotes.map((note, noteIndex) => (<div class={`beve-tutor-note ${note.type}`}>
                <div class="beve-tutor-note-type">
                  <TutorIcon name={noteIcons[note.type] || 'ri-file-text-line'}/> {note.type}
                </div>
                <StaticHtml className="beve-preview-static-rich" value={note.text}/>
              </div>))) : (<div class="beve-preview-empty">No teaching notes for this step yet.</div>)}
        </div>
      </>);
        };
        const renderPage1 = () => (<div class="beve-page" id="beve-page1" ref={(el) => { pageRefs.current.page1 = el; }}>
      {renderPageHeader(1)}
      <div class="beve-page-sections">
        <div class="beve-page-section">
          <div class="beve-col-student" ref={_element => page1IntroStudentRef.current = _element}>
            {renderSectionBanner(1, 'WARM-UP')}
            <div class="beve-goal-box">
              <div class="beve-goal-label">Lesson Goal</div>
              <StaticHtml className="beve-goal-en" value={beData().introduce.goalEn || goalTextEn()} emptyText="Goal not set"/>
              <StaticHtml className="beve-goal-kr" value={beData().introduce.goalKr || goalTextKr()} emptyText="목표 미설정"/>
            </div>
            <div class="beve-situation-box">
              <div class="beve-situation-label">
                <TutorIcon name="ri-briefcase-line"/> Situation and Task
              </div>
              <StaticHtml className="beve-situation-en" value={beData().introduce.situationEn} emptyText="Situation not set"/>
              <StaticHtml className="beve-situation-kr" value={beData().introduce.situationKr}/>
            </div>
          </div>
          <div class="beve-col-tutor" style={cssStyle(page1IntroTutorMaxHeight() ? { get maxHeight() {
                    return `${page1IntroTutorMaxHeight()}px`;
                } } : undefined)}>
            {renderTutorNotes(beData().introduce.tutorNotes)}
          </div>
        </div>

        <div class="beve-page-section">
          <div class="beve-col-student">
            {renderSectionBanner(2, 'KEY EXPRESSIONS')}
            <div class="beve-sub-heading">
              Key Expressions <span class="kr-label">핵심 표현</span>
            </div>
            <div class="beve-patterns-grid">
              {beData().present.patterns.length > 0 ? (beData().present.patterns.map((pattern, index) => (<div class="beve-pattern-card">
                    <StaticHtml className="beve-pattern-en" value={pattern.en} emptyText="Pattern"/>
                    <StaticHtml className="beve-pattern-kr" value={pattern.kr}/>
                  </div>))) : (<div class="beve-preview-empty">No key expressions yet.</div>)}
            </div>
          </div>
          <div class="beve-col-tutor">
            {renderTutorNotes(beData().present.tutorNotes)}
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>);
        const renderPage2 = () => (<div class="beve-page" id="beve-page2" ref={(el) => { pageRefs.current.page2 = el; }}>
      {renderPageHeader(2)}
      <div class="beve-page-sections">
        <div class="beve-page-section">
          <div class="beve-col-student">
            {renderSectionBanner(3, 'COMPREHENSION')}

            {!isHidden('comprehensionIntro') && (<div class="beve-situation-box">
                <StaticHtml className="beve-situation-en" value={beData().understand.instruction} emptyText="Comprehension instruction not set"/>
                <StaticHtml className="beve-situation-kr" value={beData().understand.instructionKr}/>
              </div>)}

            {!isHidden('patternDrills') && beData().understand.patternDrills.length > 0 && (<div class="beve-pattern-drills">
                {beData().understand.patternDrills.map((drill, drillIndex) => (<div class="beve-drill-card">
                    <div class="beve-drill-header">
                      <StaticHtml className="beve-drill-label" value={drill.label}/>
                      <StaticHtml className="beve-drill-label-kr" value={drill.labelKr}/>
                    </div>
                    <div class="beve-drill-template" innerHTML={html(drill.template).__html}/>
                    <table class="beve-drill-table">
                      <tbody>
                        {drill.examples.map((example, exampleIndex) => (<tr>
                            <td innerHTML={html(example.en).__html}/>
                            <td innerHTML={html(example.kr).__html}/>
                          </tr>))}
                      </tbody>
                    </table>
                  </div>))}
              </div>)}
          </div>
          <div class="beve-col-tutor">{renderTutorNotes(beData().understand.tutorNotes, 'comprehension')}</div>
        </div>

        {!isHidden('vocabulary') && beData().present.vocabulary.length > 0 && (<div class="beve-page-section">
            <div class="beve-col-student">
              <div class="beve-sub-heading" style={cssStyle({ marginTop: 0 })}>
                Word Bank <span class="kr-label">단어장</span>
              </div>
              <table class="beve-vocab-table">
                <thead>
                  <tr>
                    <th>Word</th>
                    <th>Part of Speech</th>
                    <th>Translation</th>
                    <th>Definition</th>
                  </tr>
                </thead>
                <tbody>
                  {beData().present.vocabulary.map((vocab, index) => (<tr>
                      <td class="beve-vocab-word">{vocab.word}</td>
                      <td class="beve-vocab-pos">{vocab.pos}</td>
                      <td class="beve-vocab-translation">{vocab.translation}</td>
                      <td>{vocab.definition || ''}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>
            <div class="beve-col-tutor">{renderTutorNotes(beData().understand.tutorNotes, 'wordBank')}</div>
          </div>)}

        {!isHidden('soundPractice') &&
                (beData().present.pronunciation.left.words.length > 0 ||
                    beData().present.pronunciation.right.words.length > 0) && (<div class="beve-page-section">
              <div class="beve-col-student">
                <div class="beve-sub-heading" style={cssStyle({ marginTop: 0 })}>
                  Sound Practice{' '}
                  <span class="kr-label">{beData().present.pronunciation.instructionKr}</span>
                </div>
                <div class="beve-pronun-box">
                  <StaticHtml className="beve-pronun-title" value={beData().present.pronunciation.instruction} emptyText="Pronunciation instruction not set"/>
                  <div class="beve-pronun-columns">
                    {(['left', 'right'] as const).map((side) => {
                    const column = beData().present.pronunciation[side];
                    return (<div class="beve-pronun-col">
                          <div class="beve-pronun-symbol">{column.symbol}</div>
                          <div class="beve-pronun-words">
                            {(column.words || []).map((word, index) => (<div class="beve-pronun-word">
                                <span>{word.en}</span>
                                <span style={cssStyle({ color: '#71717a', fontSize: 12 })}>{word.kr}</span>
                              </div>))}
                          </div>
                        </div>);
                })}
                  </div>
                </div>
              </div>
              <div class="beve-col-tutor">{renderTutorNotes(beData().understand.tutorNotes, 'soundPractice')}</div>
            </div>)}

        {beData().understand.activityBlocks.length > 0 && (<div class="beve-page-section">
            <div class="beve-col-student">{renderActivityBlocksArea(beData().understand.activityBlocks)}</div>
            <div class="beve-col-tutor">{renderTutorNotes(beData().understand.tutorNotes, 'activityBlocks')}</div>
          </div>)}
      </div>
      {renderPageFooter()}
    </div>);
        const renderPage3 = () => (<div class="beve-page" id="beve-page3" ref={(el) => { pageRefs.current.page3 = el; }}>
      {renderPageHeader(3)}
      <div class="beve-page-sections">
        {page3StepIndices().map((index, idx) => (<div class="beve-page-section">
            <div class="beve-col-student">
              {idx === 0 ? renderSectionBanner(4, 'DRILL') : null}
              {renderPracticeStep(index)}
            </div>
            <div class="beve-col-tutor">{renderPracticeStepNotes(index)}</div>
          </div>))}
        <div class="beve-page-section beve-page-section-full">
          <div class="beve-col-student">
            {beData().present.patterns.length > 0 && renderHintBox()}
            {renderActivityBlocksArea(beData().practice.activityBlocks)}
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>);
        const renderPage4 = () => (<div class="beve-page" id="beve-page4" ref={(el) => { pageRefs.current.page4 = el; }}>
      {renderPageHeader(4)}
      <div class="beve-page-sections">
        {page4StepIndices().length > 0 ? (page4StepIndices().map((index, idx) => (<div class="beve-page-section">
              <div class="beve-col-student">
                {idx === 0 ? renderSectionBanner(4, 'DRILL (CONTINUATION)') : null}
                {renderPracticeStep(index)}
              </div>
              <div class="beve-col-tutor">{renderPracticeStepNotes(index)}</div>
            </div>))) : (<div class="beve-page-section beve-page-section-full">
            <div class="beve-col-student">
              {renderSectionBanner(4, 'DRILL (CONTINUATION)')}
              <div class="beve-preview-empty">
                All practice steps fit on the previous page.
              </div>
            </div>
          </div>)}
        <div class="beve-page-section beve-page-section-full">
          <div class="beve-col-student">
            {beData().present.patterns.length > 0 && renderHintBox()}
            {renderActivityBlocksArea(beData().practice.activityBlocks)}
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>);
        const renderPage5 = () => ((() => {
            const challengeQuestionEntries = beData().challenge.tutorNotes
                .map((note, index) => ({ note, index }))
                .filter((_props3) => normalizeTutorNoteType(_props3["note"].type) === 'question');
            const firstQuestionIndex = challengeQuestionEntries.length > 0 ? challengeQuestionEntries[0].index : -1;
            const challengeLeadingNotes = firstQuestionIndex === -1
                ? beData().challenge.tutorNotes.map((note, index) => ({ note, index }))
                : beData().challenge.tutorNotes
                    .slice(0, firstQuestionIndex)
                    .map((note, index) => ({ note, index }))
                    .filter((_props4) => normalizeTutorNoteType(_props4["note"].type) !== 'question');
            const challengeTrailingNotes = firstQuestionIndex === -1
                ? []
                : beData().challenge.tutorNotes
                    .slice(firstQuestionIndex)
                    .map((note, offset) => ({ note, index: firstQuestionIndex + offset }))
                    .filter((_props5) => normalizeTutorNoteType(_props5["note"].type) !== 'question');
            return (<div class="beve-page" id="beve-page5" ref={(el) => { pageRefs.current.page5 = el; }}>
      {renderPageHeader(5)}
      <div class="beve-columns">
        <div class="beve-col-student">
          {renderSectionBanner(5, 'SIMULATION')}
          <div class="beve-challenge-box">
            <div class="beve-challenge-title">
              <TutorIcon name="ri-sword-line"/> Simulation
            </div>
            <StaticHtml className="beve-challenge-scenario" value={beData().challenge.scenarioEn} emptyText="Simulation scenario not set"/>
            <StaticHtml className="beve-challenge-scenario-kr" value={beData().challenge.scenarioKr}/>
          </div>

          {!isHidden('roleplayTable') && beData().challenge.roleplayTable && (<div class="beve-situation-box">
              <div class="beve-situation-label">Roleplay Assignments</div>
              <div class="beve-preview-roleplay-grid">
                <div>
                  <div class="beve-preview-role-label">YOU</div>
                  <StaticHtml className="beve-preview-static-rich" value={beData().challenge.roleplayTable.you}/>
                </div>
                <div>
                  <div class="beve-preview-role-label">YOUR COWORKERS</div>
                  <div class="beve-preview-role-list">
                    {(beData().challenge.roleplayTable.coworkers || []).map((coworker, index) => (<StaticHtml className="beve-preview-static-rich" value={coworker}/>))}
                  </div>
                </div>
              </div>
            </div>)}

          {renderActivityBlocksArea(beData().challenge.activityBlocks)}
          {beData().present.patterns.length > 0 && renderHintBox()}
        </div>
        <div class="beve-col-tutor">
          <div class="beve-col-tutor-title">
            <TutorIcon name="ri-booklet-line"/> Teaching Notes
          </div>
          <div class="beve-tutor-notes">
            {challengeLeadingNotes.length > 0 ? (challengeLeadingNotes.map((_props6) => (<div class={`beve-tutor-note ${_props6["note"].type}`}>
                  <div class="beve-tutor-note-type">
                    <TutorIcon name={noteIcons[_props6["note"].type] || 'ri-file-text-line'}/> {_props6["note"].type}
                  </div>
                  <StaticHtml className="beve-preview-static-rich" value={_props6["note"].text}/>
                </div>))) : challengeQuestionEntries.length === 0 && challengeTrailingNotes.length === 0 ? (<div class="beve-preview-empty">No teaching notes yet.</div>) : null}
            {challengeQuestionEntries.length > 0 && (<>
                <div class="beve-sub-heading" style={cssStyle({ borderBottom: 'none', marginBottom: 6, marginTop: challengeLeadingNotes.length > 0 ? 16 : 0 })}>
                  Prompt Questions
                </div>
                <div class="beve-guide-questions">
                  {challengeQuestionEntries.map((_props7, questionIndex) => (<div class="beve-guide-q">
                      <span style={cssStyle({ fontWeight: 700, color: '#7c3aed', marginRight: 6 })}>
                        {questionIndex + 1}.
                      </span>
                      <span innerHTML={html(_props7["note"].text).__html}/>
                    </div>))}
                </div>
              </>)}
            {challengeTrailingNotes.map((_props8) => (<div class={`beve-tutor-note ${_props8["note"].type}`}>
                <div class="beve-tutor-note-type">
                  <TutorIcon name={noteIcons[_props8["note"].type] || 'ri-file-text-line'}/> {_props8["note"].type}
                </div>
                <StaticHtml className="beve-preview-static-rich" value={_props8["note"].text}/>
              </div>))}
          </div>
        </div>
      </div>
      {renderPageFooter()}
    </div>);
        })());
        const renderPage6 = () => (<div class="beve-page" id="beve-page6" ref={(el) => { pageRefs.current.page6 = el; }}>
      {renderPageHeader(6)}
      <div class="beve-columns">
        <div class="beve-col-student">
          {renderSectionBanner(5, 'SIMULATION — OPEN TALK')}
          <div class="beve-situation-box">
            <StaticHtml className="beve-situation-en" value={beData().discussion.instructionEn} emptyText="Discussion instruction not set"/>
            <StaticHtml className="beve-situation-kr" value={beData().discussion.instructionKr}/>
          </div>
          <div class="beve-discussion-categories">
            {beData().discussion.categories.map((category, categoryIndex) => (<div class="beve-disc-cat">
                <StaticHtml className="beve-disc-cat-title" value={category.title} emptyText="Category"/>
                <div class="beve-disc-questions">
                  {(category.questions || []).map((question, questionIndex) => (<div class="beve-disc-q" data-num={`${questionIndex + 1}.`}>
                      <span innerHTML={html(question).__html}/>
                    </div>))}
                </div>
              </div>))}
          </div>
          {renderActivityBlocksArea(beData().discussion.activityBlocks)}
        </div>
        <div class="beve-col-tutor">{renderTutorNotes(beData().discussion.tutorNotes)}</div>
      </div>
      {renderPageFooter()}
    </div>);
        const renderPage7 = () => (<div class="beve-page" id="beve-page7" ref={(el) => { pageRefs.current.page7 = el; }}>
      {renderPageHeader(7)}
      <div class="beve-columns">
        <div class="beve-col-student">
          {renderSectionBanner(6, 'WRAP-UP')}

          <div class="beve-goal-box beve-readonly-ref">
            <div class="beve-goal-label">
              <TutorIcon name="ri-bookmark-line" style={cssStyle({ marginRight: 4 })}/> Lesson Goal
            </div>
            <StaticHtml className="beve-goal-en" value={beData().introduce.goalEn || goalTextEn()} emptyText="Goal not set"/>
            <StaticHtml className="beve-goal-kr" value={beData().introduce.goalKr || goalTextKr()} emptyText="목표 미설정"/>
          </div>

          <div class="beve-readonly-ref beve-key-expr-ref">
            <div class="beve-goal-label">
              <TutorIcon name="ri-key-2-line" style={cssStyle({ marginRight: 4 })}/> Key Expressions
            </div>
            {beData().present.patterns.length > 0 ? (beData().present.patterns.map((pattern, index) => (<div class="beve-key-expr-row">
                  <span class="beve-key-expr-num">{index + 1}.</span>
                  <div>
                    <StaticHtml className="beve-key-expr-en" value={pattern.en}/>
                    <StaticHtml className="beve-key-expr-kr" value={pattern.kr}/>
                  </div>
                </div>))) : (<div class="beve-preview-empty">No key expressions yet.</div>)}
          </div>

          {!isHidden('feedbackTemplate') && (<>
              <div class="beve-sub-heading" style={cssStyle({ marginTop: 0 })}>
                <TutorIcon name="ri-chat-check-line"/> Tutor&apos;s Review
              </div>
              <div class="beve-feedback-template">
                <StaticHtml className="beve-preview-static-rich" value={beData().feedback.feedbackTemplate} emptyText="Feedback template not set"/>
              </div>
            </>)}

          {!isHidden('nextLesson') && (<div class="beve-next-lesson">
              <TutorIcon name="ri-arrow-right-circle-line"/>
              <div>
                <div style={cssStyle({
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#a1a1aa',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    marginBottom: 2
                })}>
                  Next Lesson
                </div>
                <div>
                  <span>{beData().feedback.nextLessonLabel}</span>
                  {beData().feedback.nextLessonLabel && beData().feedback.nextLessonName ? ' — ' : ''}
                  <strong>{beData().feedback.nextLessonName}</strong>
                </div>
              </div>
            </div>)}
        </div>
        <div class="beve-col-tutor">{renderTutorNotes(beData().feedback.tutorNotes)}</div>
      </div>
      {renderPageFooter()}
    </div>);
        return (<div class={`beve ${theme()} beve-preview${isEmbedded() ? ' beve-preview--embedded' : ''}`}>
      <div class="beve-toolbar">
        <div class="beve-toolbar-left">
          <button class="beve-back-btn" onClick={handleBack}>
            <TutorIcon name="ri-arrow-left-line"/>
            <span>{isEmbedded() ? 'Close' : 'Back'}</span>
          </button>
          <div class="beve-toolbar-divider"/>
          <div class="beve-toolbar-title">
            <span class="beve-toolbar-badge">{LEVEL_BADGES[level()] || `LEVEL ${level()}`}</span>
            Lesson {lessonNumber()}: {lessonName() || 'Untitled'}
          </div>
        </div>
        <div class="beve-toolbar-center">
          <TutorIcon name="ri-eye-line"/> Business English Preview
        </div>
        <div class="beve-toolbar-right">
          <button class="beve-toolbar-btn" onClick={toggleTheme} title={`Switch to ${theme() === 'dark' ? 'light' : 'dark'} theme`}>
            <TutorIcon name={theme() === 'dark' ? 'ri-sun-line' : 'ri-moon-line'}/>
            {theme() === 'dark' ? 'Light' : 'Dark'}
          </button>
          {!isEmbedded() && (<button class="beve-toolbar-btn" onClick={handleClose}>
              <TutorIcon name="ri-close-line"/>
              Close
            </button>)}
        </div>
      </div>

      <div class="beve-body">
        <div class="beve-sidebar">
          <div class="beve-sidebar-header">Pages</div>
          <div class="beve-sidebar-pages">
            {PCPP_PAGES.map((page) => (<button class={`beve-sidebar-page ${activePage() === page.key ? 'active' : ''}`} onClick={() => scrollToPage(page.key)}>
                <span class="beve-page-num">{page.num}</span>
                <span class="beve-page-label">{page.label}</span>
              </button>))}
          </div>
        </div>

        <div class="beve-canvas" ref={_element => canvasRef.current = _element}>
          {renderPage1()}
          {renderPage2()}
          {renderPage3()}
          {renderPage4()}
          {renderPage5()}
          {renderPage6()}
          {renderPage7()}
        </div>
      </div>
    </div>);
    }) as unknown as JSX.Element;
}
