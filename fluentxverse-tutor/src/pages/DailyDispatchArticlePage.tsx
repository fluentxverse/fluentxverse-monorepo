/**
 * DailyDispatchArticlePage - Tutor App
 * Tutor view of a Daily Dispatch article (with tutor guides and answers)
 */
import { useState, useEffect } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import { useAuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
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

export default function DailyDispatchArticlePage() {
  const { params } = useRoute();
  const { user } = useAuthContext();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAnswers, setShowAnswers] = useState(true);

  const id = params?.id;

  useEffect(() => {
    if (id) {
      loadArticle(id);
    }
  }, [id]);

  const loadArticle = async (articleId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/dispatch/${articleId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load article');
      const data = await response.json();
      setArticle(data);
      document.title = `${data.title} | Daily Dispatch`;
    } catch (err) {
      console.error('Failed to load article:', err);
      setError('Failed to load article. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <>
        <SideBar />
        <div className="main-content">
          <DashboardHeader user={user || undefined} />
          <div className="dda-page">
            <div className="dda-loading">
              <div className="dda-spinner"></div>
              <p>Loading article...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !article) {
    return (
      <>
        <SideBar />
        <div className="main-content">
          <DashboardHeader user={user || undefined} />
          <div className="dda-page">
            <div className="dda-error-state">
              <i className="fi-sr-exclamation"></i>
              <h2>Error</h2>
              <p>{error || 'Article not found'}</p>
              <a href="/materials/daily-dispatch" className="dda-btn">Back to Articles</a>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SideBar />
      <div className="main-content">
        <DashboardHeader user={user || undefined} />
        <div className="dda-page">
          <div className="dda-container">
            {/* Back Link & Controls */}
            <div className="dda-toolbar">
              <a href="/materials/daily-dispatch" className="dda-back-link">
                <i className="fi-sr-angle-left"></i>
                Back to Articles
              </a>
              <div className="dda-toolbar-actions">
                <button
                  className={`dda-toggle-btn ${showAnswers ? 'active' : ''}`}
                  onClick={() => setShowAnswers(!showAnswers)}
                >
                  <i className={showAnswers ? 'fi-sr-eye' : 'fi-sr-eye-crossed'}></i>
                  {showAnswers ? 'Hide Answers' : 'Show Answers'}
                </button>
              </div>
            </div>

            {/* Article Header */}
            <header className="dda-header">
              <span className="dda-category">{article.category}</span>
              <h1 className="dda-title">{article.title}</h1>
              <div className="dda-meta">
                <span><i className="fi-sr-calendar"></i> {formatDate(article.createdAt)}</span>
                <span><i className="fi-sr-tag"></i> {article.topic}</span>
              </div>
            </header>

            {/* Warm-Up Questions */}
            <section className="dda-section">
              <h2 className="dda-section-title">
                <i className="fi-sr-comment-alt"></i>
                Conversation Starters
              </h2>
              <p className="dda-instruction">Ask the student these warm-up questions to introduce the topic:</p>
              <ul className="dda-list">
                {article.warmUpQuestions.filter(q => q.trim()).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </section>

            {/* Vocabulary */}
            <section className="dda-section">
              <h2 className="dda-section-title">
                <i className="fi-sr-book-alt"></i>
                Key Vocabulary
              </h2>
              <p className="dda-instruction">Have the student read each word aloud, explain its meaning, and practice using it in a sentence:</p>
              <div className="dda-vocabulary">
                {article.vocabulary.filter(v => v.word.trim()).map((vocab, i) => (
                  <div key={i} className="dda-vocab-card">
                    <div className="dda-vocab-header">
                      <span className="dda-vocab-word">{vocab.word}</span>
                      {vocab.pronunciation && (
                        <span className="dda-vocab-pronunciation">{vocab.pronunciation}</span>
                      )}
                      {vocab.partOfSpeech && (
                        <span className="dda-vocab-pos">({vocab.partOfSpeech})</span>
                      )}
                    </div>
                    <p className="dda-vocab-definition"><strong>Meaning:</strong> {vocab.definition}</p>
                    {vocab.exampleSentence && (
                      <p className="dda-vocab-example"><strong>Usage:</strong> {vocab.exampleSentence}</p>
                    )}
                    {vocab.additionalInfo && (
                      <p className="dda-vocab-note"><strong>Note:</strong> {vocab.additionalInfo}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Reading Passage */}
            <section className="dda-section">
              <h2 className="dda-section-title">
                <i className="fi-sr-document"></i>
                Reading Passage
              </h2>
              <p className="dda-instruction">Have the student read the article aloud. Pause after each comprehension question to discuss:</p>
              <article className="dda-article-content">
                {article.articleContent.paragraphs.filter(p => p.text.trim()).map((para) => (
                  <div key={para.id} className="dda-paragraph">
                    <p>{para.text}</p>
                    {para.comprehensionQuestion && para.comprehensionQuestion.question && (
                      <div className="dda-qa-box">
                        <div className="dda-question">
                          <span className="dda-qa-label">Q:</span>
                          <span>{para.comprehensionQuestion.question}</span>
                        </div>
                        {showAnswers && para.comprehensionQuestion.answer && (
                          <div className="dda-answer">
                            <span className="dda-qa-label">A:</span>
                            <span>{para.comprehensionQuestion.answer}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </article>
              {article.articleContent.source && (
                <p className="dda-source">Source: {article.articleContent.source}</p>
              )}
            </section>

            {/* Summary Question */}
            {article.summaryQuestion && (
              <section className="dda-section">
                <h2 className="dda-section-title">
                  <i className="fi-sr-lightbulb-on"></i>
                  Comprehension Check
                </h2>
                <p className="dda-instruction">Ask the student to summarize the article by answering this question:</p>
                <div className="dda-summary-box">
                  <p>{article.summaryQuestion}</p>
                </div>
              </section>
            )}

            {/* Discussion Topics */}
            <section className="dda-section">
              <h2 className="dda-section-title">
                <i className="fi-sr-users"></i>
                Discussion Topics
              </h2>
              <p className="dda-instruction">Guide the student through these discussion questions to practice expressing opinions:</p>
              
              {article.discussionA.topic && (
                <div className="dda-discussion">
                  <h3><span className="dda-badge">A</span> {article.discussionA.topic}</h3>
                  <ul className="dda-list">
                    {article.discussionA.questions.filter(q => q.trim()).map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {article.discussionB.topic && (
                <div className="dda-discussion">
                  <h3><span className="dda-badge">B</span> {article.discussionB.topic}</h3>
                  <ul className="dda-list">
                    {article.discussionB.questions.filter(q => q.trim()).map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
