/**
 * DailyDispatchArticlePage - Tutor App
 * Full-page view for Daily Dispatch news article lessons
 * Supports both Tutor View (with answers) and Student View (without answers)
 */
import { useState, useEffect } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { API_BASE_URL } from '../config/api';
import DailyDispatchLogo from '../assets/icons/daily-dispatch-logo.svg';
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
  const { params } = useRoute();
  const [data, setData] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fontSize, setFontSize] = useState<'S' | 'M' | 'L'>('M');
  const [searchQuery, setSearchQuery] = useState('');
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [isInClassroom, setIsInClassroom] = useState(false);
  
  // Check if mode=student is in URL params
  const urlParams = new URLSearchParams(window.location.search);
  const initialStudentMode = urlParams.get('mode') === 'student';
  const [isStudentView, setIsStudentView] = useState(initialStudentMode);

  const id = params?.id;

  // Detect if loaded in iframe (classroom context)
  useEffect(() => {
    const inIframe = window.self !== window.top;
    setIsInClassroom(inIframe);
    if (inIframe) {
      document.body.classList.add('classroom-mode');
    } else {
      document.body.classList.remove('classroom-mode');
    }
    return () => {
      document.body.classList.remove('classroom-mode');
    };
  }, []);

  useEffect(() => {
    loadArchives();
    if (id) {
      loadArticle(id);
    }
  }, [id]);

  const loadArchives = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/archives`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        // API returns { success: true, archives: [...] }
        if (data.success && Array.isArray(data.archives)) {
          setArchives(data.archives);
        } else if (Array.isArray(data)) {
          // Fallback if API returns array directly
          setArchives(data);
        }
      }
    } catch (err) {
      console.error('Failed to load archives:', err);
    }
  };

  const loadArticle = async (articleId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/dispatch/${articleId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load article');
      const article = await response.json();
      setData(article);
      document.title = `${article.title} | Daily Dispatch`;
    } catch (err) {
      console.error('Failed to load article:', err);
      setError('Failed to load article. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Date not set';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="ddp-loading">
        <div className="ddp-loading-spinner" />
        <p>Loading article...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="ddp-error">
        <i className="ri-error-warning-line" />
        <h2>Error</h2>
        <p>{error || 'Article not found'}</p>
        <a href="/materials/daily-dispatch" className="ddp-btn">Back to Articles</a>
      </div>
    );
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

  // Student View (no instructions, no answers)
  if (isStudentView) {
    return (
      <div className={`ddp-container dds-container ddp-font-${fontSize.toLowerCase()}`}>
        {/* Header Bar */}
        <nav className="ddp-header-bar no-print">
          <div className="ddp-header-bar-inner">
            <a href="/materials/daily-dispatch" className="ddp-toolbar-brand">
              <img src={DailyDispatchLogo} alt="Daily Dispatch" className="ddp-logo" />
              <span>Daily Dispatch</span>
            </a>
            <div className="ddp-categories-list">
              {CATEGORIES.map((cat) => (
                <span 
                  key={cat} 
                  className={`ddp-category-item ${data.category === cat ? 'active' : ''}`}
                >
                  {cat}
                </span>
              ))}
            </div>
            <button 
              className="ddp-view-toggle"
              onClick={() => setIsStudentView(false)}
            >
              <i className="ri-eye-line" />
              Switch to Tutor View
            </button>
          </div>
        </nav>

        {/* Main Layout */}
        <div className="ddp-layout">
          <div className="ddp-content">
            {/* Header */}
            <header className="ddp-header">
              <div className="ddp-view-badge student">STUDENT VIEW</div>
              <h1 className="ddp-title">{data.title || 'Untitled Article'}</h1>
              <div className="ddp-meta">
                <span className="ddp-date">{formatDate(data.createdAt)}</span>
                <span className="ddp-divider">|</span>
                <span className="ddp-topic">{data.topic || 'Topic not set'}</span>
                <span className="ddp-divider">|</span>
                <span className="ddp-category">{data.category || 'Uncategorized'}</span>
              </div>
            </header>

            {/* Warm-Up Questions */}
            <section className="ddp-section">
              <div className="ddp-section-header">
                <div className="ddp-section-line" />
                <h2>WARM-UP QUESTIONS</h2>
                <div className="ddp-section-line" />
              </div>
              <ul className="ddp-list ddp-indent">
                {data.warmUpQuestions.filter(q => q.trim()).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </section>

            {/* Key Vocabulary */}
            <section className="ddp-section">
              <div className="ddp-section-header">
                <div className="ddp-section-line" />
                <h2>KEY VOCABULARY</h2>
                <div className="ddp-section-line" />
              </div>
              <div className="ddp-vocabulary">
                {data.vocabulary.filter(v => v.word.trim()).map((vocab, i) => (
                  <div key={i} className="ddp-vocab-item">
                    <div className="ddp-vocab-header">
                      <span className="ddp-vocab-word">{vocab.word}</span>
                      {vocab.pronunciation && (
                        <span className="ddp-vocab-pronunciation">{vocab.pronunciation}</span>
                      )}
                      {vocab.partOfSpeech && (
                        <span className="ddp-vocab-pos">({vocab.partOfSpeech})</span>
                      )}
                    </div>
                    <div className="ddp-vocab-body">
                      <p><strong>Meaning:</strong> {vocab.definition}</p>
                      {vocab.exampleSentence && (
                        <p><strong>Example:</strong> {vocab.exampleSentence}</p>
                      )}
                      {vocab.additionalInfo && (
                        <p><strong>Note:</strong> {vocab.additionalInfo}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Reading Passage (questions only, no answers) */}
            <section className="ddp-section">
              <div className="ddp-section-header">
                <div className="ddp-section-line" />
                <h2>READING PASSAGE</h2>
                <div className="ddp-section-line" />
              </div>
              <article className="ddp-article">
                {data.articleContent.paragraphs.filter(p => p.text.trim()).map((para) => (
                  <div key={para.id} className="ddp-paragraph">
                    <p>{para.text}</p>
                    {para.comprehensionQuestion && para.comprehensionQuestion.question && (
                      <div className="ddp-qa dds-question-only">
                        <p className="ddp-question">
                          <span className="ddp-qa-label">
                            <i className="ri-question-line" />
                          </span>
                          {para.comprehensionQuestion.question}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </article>
              {data.articleContent.source && (
                <p className="ddp-source">Source: {data.articleContent.source}</p>
              )}
            </section>

            {/* Summary Question */}
            {data.summaryQuestion && (
              <section className="ddp-section">
                <div className="ddp-section-header">
                  <div className="ddp-section-line" />
                  <h2>SUMMARY QUESTION</h2>
                  <div className="ddp-section-line" />
                </div>
                <div className="ddp-comprehension">
                  <p className="ddp-summary-question">{data.summaryQuestion}</p>
                </div>
              </section>
            )}

            {/* Discussion Topics */}
            <section className="ddp-section">
              <div className="ddp-section-header">
                <div className="ddp-section-line" />
                <h2>DISCUSSION TOPICS</h2>
                <div className="ddp-section-line" />
              </div>
              
              {data.discussionA.topic && (
                <div className="ddp-discussion">
                  <h3>
                    <span className="ddp-discussion-badge">A</span>
                    {data.discussionA.topic}
                  </h3>
                  <ul className="ddp-discussion-list">
                    {data.discussionA.questions.filter(q => q.trim()).map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {data.discussionB.topic && (
                <div className="ddp-discussion">
                  <h3>
                    <span className="ddp-discussion-badge">B</span>
                    {data.discussionB.topic}
                  </h3>
                  <ul className="ddp-discussion-list">
                    {data.discussionB.questions.filter(q => q.trim()).map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <footer className="ddp-footer">
              <p>FluentXVerse Daily Dispatch</p>
            </footer>
          </div>

          {/* Sidebar */}
          <aside className="ddp-sidebar no-print">
            <div className="ddp-sidebar-section">
              <h3 className="ddp-sidebar-title">
                <span>Search</span>
                <span className="ddp-sidebar-subtitle">Search by title</span>
              </h3>
              <div className="ddp-sidebar-search">
                <input
                  type="text"
                  placeholder="search"
                  value={searchQuery}
                  onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                />
                <button className="ddp-sidebar-search-btn">search</button>
              </div>
            </div>

            <div className="ddp-sidebar-section">
              <h3 className="ddp-sidebar-title">
                <span>Font</span>
                <span className="ddp-sidebar-subtitle">size</span>
              </h3>
              <div className="ddp-font-size-btns">
                {(['S', 'M', 'L'] as const).map((size) => (
                  <button
                    key={size}
                    className={`ddp-font-size-btn ${fontSize === size ? 'active' : ''}`}
                    onClick={() => setFontSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="ddp-sidebar-section">
              <h3 className="ddp-sidebar-title">Archives</h3>
              {archives.length > 0 ? (
                <ul className="ddp-archives-list">
                  {archives.map((archive, i) => (
                    <li key={i}>
                      <a href={`/materials/daily-dispatch/archives/${encodeURIComponent(archive.month)}`}>
                        {archive.month}
                      </a>
                      <span className="ddp-archive-count">({archive.count})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ddp-sidebar-empty">No archives yet</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // Tutor View (with instructions and answers)
  return (
    <div className={`ddp-container ddp-font-${fontSize.toLowerCase()}`}>
      {/* Header Bar */}
      <nav className="ddp-header-bar no-print">
        <div className="ddp-header-bar-inner">
          <a href="/materials/daily-dispatch" className="ddp-toolbar-brand">
            <img src={DailyDispatchLogo} alt="Daily Dispatch" className="ddp-logo" />
            <span>Daily Dispatch</span>
          </a>
          <div className="ddp-categories-list">
            {CATEGORIES.map((cat) => (
              <span 
                key={cat} 
                className={`ddp-category-item ${data.category === cat ? 'active' : ''}`}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="ddp-layout">
        <div className="ddp-content">
          {/* Header */}
          <header className="ddp-header">
            <div className="ddp-view-badge tutor">TUTOR VIEW</div>
            <h1 className="ddp-title">{data.title || 'Untitled Article'}</h1>
            <div className="ddp-meta">
              <span className="ddp-date">{formatDate(data.createdAt)}</span>
              <span className="ddp-divider">|</span>
              <span className="ddp-topic">{data.topic || 'Topic not set'}</span>
              <span className="ddp-divider">|</span>
              <span className="ddp-category">{data.category || 'Uncategorized'}</span>
            </div>
          </header>

          {/* Conversation Starters */}
          <section className="ddp-section">
            <div className="ddp-section-header">
              <div className="ddp-section-line" />
              <h2>CONVERSATION STARTERS</h2>
              <div className="ddp-section-line" />
            </div>
            <p className="ddp-instruction">Ask the student these warm-up questions to introduce the topic:</p>
            <ul className="ddp-list ddp-indent">
              {data.warmUpQuestions.filter(q => q.trim()).map((q, i) => (
                <li key={i}>{q}</li>
              ))}
              {data.warmUpQuestions.filter(q => q.trim()).length === 0 && (
                <li className="ddp-empty">No warm-up questions added</li>
              )}
            </ul>
          </section>

          {/* Key Vocabulary */}
          <section className="ddp-section">
            <div className="ddp-section-header">
              <div className="ddp-section-line" />
              <h2>KEY VOCABULARY</h2>
              <div className="ddp-section-line" />
            </div>
            <p className="ddp-instruction">Have the student read each word aloud, explain its meaning, and practice using it in a sentence:</p>
            <div className="ddp-vocabulary">
              {data.vocabulary.filter(v => v.word.trim()).map((vocab, i) => (
                <div key={i} className="ddp-vocab-item">
                  <div className="ddp-vocab-header">
                    <span className="ddp-vocab-word">{vocab.word}</span>
                    {vocab.pronunciation && (
                      <span className="ddp-vocab-pronunciation">{vocab.pronunciation}</span>
                    )}
                    {vocab.partOfSpeech && (
                      <span className="ddp-vocab-pos">({vocab.partOfSpeech})</span>
                    )}
                  </div>
                  <div className="ddp-vocab-body">
                    <p><strong>Meaning:</strong> {vocab.definition}</p>
                    {vocab.exampleSentence && (
                      <p><strong>Usage:</strong> {vocab.exampleSentence}</p>
                    )}
                    {vocab.additionalInfo && (
                      <p><strong>Note:</strong> {vocab.additionalInfo}</p>
                    )}
                  </div>
                </div>
              ))}
              {data.vocabulary.filter(v => v.word.trim()).length === 0 && (
                <p className="ddp-empty">No vocabulary words added</p>
              )}
            </div>
          </section>

          {/* Reading Passage (with answers) */}
          <section className="ddp-section">
            <div className="ddp-section-header">
              <div className="ddp-section-line" />
              <h2>READING PASSAGE</h2>
              <div className="ddp-section-line" />
            </div>
            <p className="ddp-instruction">Have the student read the article aloud. Pause after each comprehension question to discuss:</p>
            <article className="ddp-article">
              {data.articleContent.paragraphs.filter(p => p.text.trim()).map((para) => (
                <div key={para.id} className="ddp-paragraph">
                  <p>{para.text}</p>
                  {para.comprehensionQuestion && (
                    <div className="ddp-qa">
                      <p className="ddp-question">
                        <span className="ddp-qa-label">Q</span> {para.comprehensionQuestion.question}
                      </p>
                      <p className="ddp-answer">
                        <span className="ddp-qa-label">A</span> {para.comprehensionQuestion.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              {data.articleContent.paragraphs.filter(p => p.text.trim()).length === 0 && (
                <p className="ddp-empty">No article content added</p>
              )}
            </article>
            {data.articleContent.source && (
              <p className="ddp-source">This article was provided by {data.articleContent.source}.</p>
            )}
          </section>

          {/* Comprehension Check */}
          {data.summaryQuestion && (
            <section className="ddp-section">
              <div className="ddp-section-header">
                <div className="ddp-section-line" />
                <h2>COMPREHENSION CHECK</h2>
                <div className="ddp-section-line" />
              </div>
              <p className="ddp-instruction">Ask the student to summarize the article by answering this question:</p>
              <div className="ddp-comprehension">
                <p className="ddp-summary-question">{data.summaryQuestion}</p>
              </div>
            </section>
          )}

          {/* Discussion Topics */}
          <section className="ddp-section">
            <div className="ddp-section-header">
              <div className="ddp-section-line" />
              <h2>DISCUSSION TOPICS</h2>
              <div className="ddp-section-line" />
            </div>
            <p className="ddp-instruction">Guide the student through these discussion questions to practice expressing opinions:</p>
            
            {data.discussionA.topic && (
              <div className="ddp-discussion">
                <h3>
                  <span className="ddp-discussion-badge">A</span>
                  {data.discussionA.topic}
                </h3>
                <ul className="ddp-discussion-list">
                  {data.discussionA.questions.filter(q => q.trim()).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.discussionB.topic && (
              <div className="ddp-discussion">
                <h3>
                  <span className="ddp-discussion-badge">B</span>
                  {data.discussionB.topic}
                </h3>
                <ul className="ddp-discussion-list">
                  {data.discussionB.questions.filter(q => q.trim()).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {!data.discussionA.topic && !data.discussionB.topic && (
              <p className="ddp-empty">No discussion topics added</p>
            )}
          </section>

          <footer className="ddp-footer">
            <p>FluentXVerse Daily Dispatch</p>
          </footer>
        </div>

        {/* Sidebar */}
        <aside className="ddp-sidebar no-print">
          <div className="ddp-sidebar-section">
            <h3 className="ddp-sidebar-title">
              <span>Search</span>
              <span className="ddp-sidebar-subtitle">Search by title</span>
            </h3>
            <div className="ddp-sidebar-search">
              <input
                type="text"
                placeholder="search"
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
              <button className="ddp-sidebar-search-btn">search</button>
            </div>
          </div>

          <div className="ddp-sidebar-section">
            <h3 className="ddp-sidebar-title">
              <span>Font</span>
              <span className="ddp-sidebar-subtitle">size</span>
            </h3>
            <div className="ddp-font-size-btns">
              {(['S', 'M', 'L'] as const).map((size) => (
                <button
                  key={size}
                  className={`ddp-font-size-btn ${fontSize === size ? 'active' : ''}`}
                  onClick={() => setFontSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="ddp-sidebar-section">
            <h3 className="ddp-sidebar-title">Archives</h3>
            {archives.length > 0 ? (
              <ul className="ddp-archives-list">
                {archives.map((archive, i) => (
                  <li key={i}>
                    <a href={`/materials/daily-dispatch/archives/${encodeURIComponent(archive.month)}`}>
                      {archive.month}
                    </a>
                    <span className="ddp-archive-count">({archive.count})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ddp-sidebar-empty">No archives yet</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
