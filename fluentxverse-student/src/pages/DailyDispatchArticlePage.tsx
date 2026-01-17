/**
 * DailyDispatchArticlePage - Student App
 * Student view of a Daily Dispatch article (without tutor guides/answers)
 */
import { useState, useEffect } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
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
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          <Header />
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
          <Header />
          <div className="dda-page">
            <div className="dda-error-state">
              <i className="fas fa-exclamation-circle"></i>
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
        <Header />
        <div className="dda-page">
          <div className="dda-container">
            {/* Back Link */}
            <a href="/materials/daily-dispatch" className="dda-back-link">
              <i className="fas fa-arrow-left"></i>
              Back to Articles
            </a>

            {/* Article Header */}
            <header className="dda-header">
              <span className="dda-category">{article.category}</span>
              <h1 className="dda-title">{article.title}</h1>
              <div className="dda-meta">
                <span><i className="fas fa-calendar"></i> {formatDate(article.createdAt)}</span>
                <span><i className="fas fa-tag"></i> {article.topic}</span>
              </div>
            </header>

            {/* Warm-Up Questions */}
            <section className="dda-section">
              <h2 className="dda-section-title">
                <i className="fas fa-comments"></i>
                Warm-Up Questions
              </h2>
              <ul className="dda-list">
                {article.warmUpQuestions.filter(q => q.trim()).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </section>

            {/* Vocabulary */}
            <section className="dda-section">
              <h2 className="dda-section-title">
                <i className="fas fa-book"></i>
                Key Vocabulary
              </h2>
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
                    <p className="dda-vocab-definition">{vocab.definition}</p>
                    {vocab.exampleSentence && (
                      <p className="dda-vocab-example">
                        <strong>Example:</strong> {vocab.exampleSentence}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Reading Passage */}
            <section className="dda-section">
              <h2 className="dda-section-title">
                <i className="fas fa-newspaper"></i>
                Reading Passage
              </h2>
              <article className="dda-article-content">
                {article.articleContent.paragraphs.filter(p => p.text.trim()).map((para) => (
                  <div key={para.id} className="dda-paragraph">
                    <p>{para.text}</p>
                    {para.comprehensionQuestion && para.comprehensionQuestion.question && (
                      <div className="dda-question-box">
                        <i className="fas fa-question-circle"></i>
                        <span>{para.comprehensionQuestion.question}</span>
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
                  <i className="fas fa-lightbulb"></i>
                  Summary Question
                </h2>
                <div className="dda-summary-box">
                  <p>{article.summaryQuestion}</p>
                </div>
              </section>
            )}

            {/* Discussion Topics */}
            <section className="dda-section">
              <h2 className="dda-section-title">
                <i className="fas fa-users"></i>
                Discussion Topics
              </h2>
              
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
