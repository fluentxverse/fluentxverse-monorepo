import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { ArrowLeft, CircleAlert, CalendarDays, Tag, Folder, CircleHelp, Link } from "lucide-solid";
import { useRoute } from "../routing";
import { API_BASE_URL } from '../config/api';
import DailyDispatchLogo from '../assets/icons/daily-dispatch-logo.svg';
import { useThemeStore } from '../context/ThemeContext';
import { useEmbeddedTheme } from '../hooks/useEmbeddedTheme';
import './DailyDispatchArticlePage.css';
interface VocabularyWord {
    word: string;
    pronunciation: string;
    partOfSpeech: string;
    definition: string;
    exampleSentence: string;
    additionalInfo: string | null;
}
interface ArticleQuestion {
    question: string;
    answer: string;
}
interface Paragraph {
    id: string;
    text: string;
    comprehensionQuestion?: ArticleQuestion | null;
}
interface ArticleContent {
    paragraphs: Paragraph[];
    source: string;
}
interface Discussion {
    topic: string;
    questions: string[];
}
interface Article {
    id: string;
    createdAt: string;
    title: string;
    category: string;
    topic: string;
    warmUpQuestions: string[];
    vocabulary: VocabularyWord[];
    articleContent: ArticleContent;
    summaryQuestion: string;
    discussionA: Discussion;
    discussionB: Discussion;
}
interface ArchiveItem {
    month: string;
    count: number;
}
export default function DailyDispatchArticlePage() {
    const _state0 = useRoute();
    const [data, setData] = createSignal<Article | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal('');
    const [fontSize, setFontSize] = createSignal<'S' | 'M' | 'L'>('M');
    const [searchQuery, setSearchQuery] = createSignal('');
    const [archives, setArchives] = createSignal<ArchiveItem[]>([]);
    const [isInClassroom, setIsInClassroom] = createSignal(false);
    const isDarkMode = createMemo(() => useThemeStore(state => state.isDarkMode));
    const classroomTheme = useEmbeddedTheme();
    const articleTheme = createMemo(() => classroomTheme() || (isDarkMode() ? 'dark' : 'light'));
    const id = createMemo(() => _state0.params?.id);
    // Detect if loaded in iframe (classroom context)
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            const inIframe = window.self !== window.top;
            setIsInClassroom(inIframe);
            document.documentElement.classList.toggle('classroom-mode', inIframe);
            if (inIframe) {
                document.body.classList.add('classroom-mode');
            }
            else {
                document.body.classList.remove('classroom-mode');
            }
            return () => {
                document.documentElement.classList.remove('classroom-mode');
                document.body.classList.remove('classroom-mode');
            };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [isInClassroom(), articleTheme()], () => {
        const _cleanup2 = untrack(() => {
            if (!isInClassroom())
                return;
            const elements = [document.documentElement, document.body];
            const root = document.documentElement;
            const previousScheme = root.style.colorScheme;
            root.style.colorScheme = articleTheme();
            elements.forEach(element => { element.dataset.dispatchTheme = articleTheme(); });
            return () => {
                elements.forEach(element => { delete element.dataset.dispatchTheme; });
                if (root.style.colorScheme === articleTheme())
                    root.style.colorScheme = previousScheme;
            };
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    createEffect(on(() => [id()], () => {
        const _cleanup3 = untrack(() => {
            loadArchives();
            if (id()) {
                loadArticle(id());
            }
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const loadArchives = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/dispatch/archives`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                // API returns { success: true, archives: [...] }
                if (data.success && Array.isArray(data.archives)) {
                    setArchives(data.archives);
                }
                else if (Array.isArray(data)) {
                    // Fallback if API returns array directly
                    setArchives(data);
                }
            }
        }
        catch (err) {
            console.error('Failed to load archives:', err);
        }
    };
    const loadArticle = async (articleId: string) => {
        try {
            setLoading(true);
            setError('');
            const response = await fetch(`${API_BASE_URL}/dispatch/${articleId}`, {
                credentials: 'include'
            });
            if (!response.ok)
                throw new Error('Failed to load article');
            const article = await response.json();
            setData(article);
            document.title = `${article.title} | Daily Dispatch`;
        }
        catch (err) {
            console.error('Failed to load article:', err);
            setError('Failed to load article. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    const formatDate = (dateStr: string) => {
        if (!dateStr)
            return 'Date not set';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    return createMemo(() => {
        if (loading()) {
            return (<div class="ddp-loading" data-theme={articleTheme()}>
        <div class="ddp-loading-spinner"/>
        <p>Loading article...</p>
      </div>);
        }
        if (error() || !data()) {
            return (<div class="ddp-error" data-theme={articleTheme()}>
        <CircleAlert size={18} aria-hidden="true"/>
        <h2>Error</h2>
        <p>{error() || 'Article not found'}</p>
        <button class="ddp-btn" onClick={() => id() && loadArticle(id())}>Try again</button><a href="/materials/daily-dispatch" class="ddp-btn">Back to Articles</a>
      </div>);
        }
        const CATEGORIES = [
            'Technology',
            'Business',
            'Science',
            'Entertainment',
            'Sports',
            'Health & Wellness',
            'Environment',
            'Lifestyle',
            'Education',
        ];
        return (<div class={`ddp-container dds-container ddp-font-${fontSize().toLowerCase()}`} data-theme={articleTheme()}>
      {/* Header Bar with Logo and Categories */}
      <nav class="ddp-header-bar no-print">
        <div class="ddp-header-bar-inner">
          <a href="/materials/daily-dispatch" class="ddp-toolbar-brand">
            <img src="/assets/img/home-icons/dispatch-v1.png" alt="Daily Dispatch" class="ddp-logo"/>
            <span>Daily Dispatch</span>
          </a>
          <div class="ddp-categories-list">
            {CATEGORIES.map((cat) => (<span class={`ddp-category-item ${data().category === cat ? 'active' : ''}`}>
                {cat}
              </span>))}
          </div>
        </div>
      </nav>

      {/* Main Layout with Content and Sidebar */}
      <div class="ddp-layout">
        {/* Main Content */}
        <div class="ddp-content">
          {/* Newspaper Header */}
          <header class="ddp-header">
            <div class="ddp-header-line"/>
            <h1 class="ddp-title">{data().title || 'Untitled Article'}</h1>
            <div class="ddp-header-line"/>
            <div class="ddp-meta">
              <span class="ddp-date">
                <CalendarDays size={18} aria-hidden="true"/>
                {formatDate(data().createdAt)}
              </span>
              <span class="ddp-divider">|</span>
              <span class="ddp-topic">
                <Tag size={18} aria-hidden="true"/>
                {data().topic || 'Topic not set'}
              </span>
              <span class="ddp-divider">|</span>
              <span class="ddp-category">
                <Folder size={18} aria-hidden="true"/>
                {data().category || 'Uncategorized'}
              </span>
            </div>
          </header>

          {/* Warm-Up Questions (no tutor instruction) */}
          <section class="ddp-section">
            <div class="ddp-section-header">
              <div class="ddp-section-line"/>
              <h2>WARM-UP QUESTIONS</h2>
              <div class="ddp-section-line"/>
            </div>
            <ul class="ddp-list ddp-indent">
              {data().warmUpQuestions.filter(q => q.trim()).map((q, i) => (<li>{q}</li>))}
              {data().warmUpQuestions.filter(q => q.trim()).length === 0 && (<li class="ddp-empty">No warm-up questions</li>)}
            </ul>
          </section>

          {/* Key Vocabulary (no tutor instruction) */}
          <section class="ddp-section">
            <div class="ddp-section-header">
              <div class="ddp-section-line"/>
              <h2>KEY VOCABULARY</h2>
              <div class="ddp-section-line"/>
            </div>
            <div class="ddp-vocabulary">
              {data().vocabulary.filter(v => v.word.trim()).map((vocab, i) => (<div class="ddp-vocab-item">
                  <div class="ddp-vocab-header">
                    <span class="ddp-vocab-word">{vocab.word}</span>
                    {vocab.pronunciation && (<span class="ddp-vocab-pronunciation">{vocab.pronunciation}</span>)}
                    {vocab.partOfSpeech && (<span class="ddp-vocab-pos">({vocab.partOfSpeech})</span>)}
                  </div>
                  <div class="ddp-vocab-body">
                    <p><strong>Meaning:</strong> {vocab.definition}</p>
                    {vocab.exampleSentence && (<p><strong>Example:</strong> {vocab.exampleSentence}</p>)}
                    {vocab.additionalInfo && (<p><strong>Note:</strong> {vocab.additionalInfo}</p>)}
                  </div>
                </div>))}
              {data().vocabulary.filter(v => v.word.trim()).length === 0 && (<p class="ddp-empty">No vocabulary words</p>)}
            </div>
          </section>

          {/* Reading Passage (questions only, no answers) */}
          <section class="ddp-section">
            <div class="ddp-section-header">
              <div class="ddp-section-line"/>
              <h2>READING PASSAGE</h2>
              <div class="ddp-section-line"/>
            </div>
            <article class="ddp-article">
              {data().articleContent.paragraphs.filter(p => p.text.trim()).map((para) => (<div class="ddp-paragraph">
                  <p>{para.text}</p>
                  {para.comprehensionQuestion && para.comprehensionQuestion.question && (<div class="ddp-qa dds-question-only">
                      <p class="ddp-question">
                        <span class="ddp-qa-label">
                          <CircleHelp size={18} aria-hidden="true"/>
                        </span>
                        {para.comprehensionQuestion.question}
                      </p>
                      {/* Answer is hidden for student view */}
                    </div>)}
                </div>))}
              {data().articleContent.paragraphs.filter(p => p.text.trim()).length === 0 && (<p class="ddp-empty">No article content</p>)}
            </article>
            {data().articleContent.source && (<p class="ddp-source">
                <Link size={18} aria-hidden="true"/>
                Source: {data().articleContent.source}
              </p>)}
          </section>

          {/* Summary Question (no tutor instruction) */}
          {data().summaryQuestion && (<section class="ddp-section">
              <div class="ddp-section-header">
                <div class="ddp-section-line"/>
                <h2>SUMMARY QUESTION</h2>
                <div class="ddp-section-line"/>
              </div>
              <div class="ddp-comprehension">
                <p class="ddp-summary-question">{data().summaryQuestion}</p>
              </div>
            </section>)}

          {/* Discussion Topics (no tutor instruction) */}
          <section class="ddp-section">
            <div class="ddp-section-header">
              <div class="ddp-section-line"/>
              <h2>DISCUSSION TOPICS</h2>
              <div class="ddp-section-line"/>
            </div>
            
            {data().discussionA.topic && (<div class="ddp-discussion">
                <h3>
                  <span class="ddp-discussion-badge">A</span>
                  {data().discussionA.topic}
                </h3>
                <ul class="ddp-discussion-list">
                  {data().discussionA.questions.filter(q => q.trim()).map((q, i) => (<li>{q}</li>))}
                </ul>
              </div>)}

            {data().discussionB.topic && (<div class="ddp-discussion">
                <h3>
                  <span class="ddp-discussion-badge">B</span>
                  {data().discussionB.topic}
                </h3>
                <ul class="ddp-discussion-list">
                  {data().discussionB.questions.filter(q => q.trim()).map((q, i) => (<li>{q}</li>))}
                </ul>
              </div>)}

            {!data().discussionA.topic && !data().discussionB.topic && (<p class="ddp-empty">No discussion topics</p>)}
          </section>

          {/* Footer */}
          <footer class="ddp-footer">
            <div class="ddp-footer-line"/>
            <p>FluentXVerse Daily Dispatch</p>
          </footer>
        </div>

        {/* Sidebar */}
        <aside class="ddp-sidebar no-print">
          <a class="dispatch-library-link" href="/materials/daily-dispatch"><ArrowLeft size={16}/>All articles</a>
          {/* Font Size */}
          <div class="ddp-sidebar-section">
            <h3 class="ddp-sidebar-title">
              <span>Font</span>
              <span class="ddp-sidebar-subtitle">size</span>
            </h3>
            <div class="ddp-font-size-btns">
              {(['S', 'M', 'L'] as const).map((size) => (<button aria-label={`Font size ${size === 'S' ? 'small' : size === 'M' ? 'medium' : 'large'}`} aria-pressed={fontSize() === size} class={`ddp-font-size-btn ${fontSize() === size ? 'active' : ''}`} onClick={() => setFontSize(size)}>
                  {size}
                </button>))}
            </div>
          </div>

          {/* Archives */}
          <div class="ddp-sidebar-section">
            <h3 class="ddp-sidebar-title">Archives</h3>
            {archives().length > 0 ? (<ul class="ddp-archives-list">
                {archives().map((archive, i) => (<li>
                    <a href={`/materials/daily-dispatch/archives/${encodeURIComponent(archive.month)}`}>
                      {archive.month}
                    </a>
                    <span class="ddp-archive-count">({archive.count})</span>
                  </li>))}
              </ul>) : (<p class="ddp-sidebar-empty">No archives yet</p>)}
          </div>
        </aside>
      </div>
    </div>);
    }) as unknown as JSX.Element;
}
