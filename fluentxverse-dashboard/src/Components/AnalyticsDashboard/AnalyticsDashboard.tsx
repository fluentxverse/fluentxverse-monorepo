import { useState, useEffect } from 'preact/hooks';
import { lessonApi, type LessonStats } from '../../api/lesson.api';
import './AnalyticsDashboard.css';

interface AnalyticsDashboardProps {
  lessonId?: string;
  mode?: 'single' | 'overview';
  onClose?: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function AnalyticsDashboard({
  lessonId,
  mode = 'single',
  onClose
}: AnalyticsDashboardProps) {
  const [stats, setStats] = useState<LessonStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (mode === 'single' && lessonId) {
      loadLessonStats();
    }
  }, [lessonId, mode, timeRange]);

  const loadLessonStats = async () => {
    if (!lessonId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await lessonApi.getLessonStats(lessonId);
      if (result.success && result.stats) {
        setStats(result.stats);
      } else {
        setError(result.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const renderSingleLessonView = () => {
    if (!stats) return null;

    return (
      <div className="ad-single-view">
        {/* Summary Cards */}
        <div className="ad-summary-cards">
          <div className="ad-card">
            <div className="ad-card-icon views">
              <i className="ri-eye-line" />
            </div>
            <div className="ad-card-content">
              <span className="ad-card-value">{formatNumber(stats.totalViews)}</span>
              <span className="ad-card-label">Total Views</span>
            </div>
          </div>
          <div className="ad-card">
            <div className="ad-card-icon users">
              <i className="ri-user-line" />
            </div>
            <div className="ad-card-content">
              <span className="ad-card-value">{formatNumber(stats.uniqueViewers)}</span>
              <span className="ad-card-label">Unique Viewers</span>
            </div>
          </div>
          <div className="ad-card">
            <div className="ad-card-icon time">
              <i className="ri-time-line" />
            </div>
            <div className="ad-card-content">
              <span className="ad-card-value">{formatDuration(stats.avgTimeSpent)}</span>
              <span className="ad-card-label">Avg. Time Spent</span>
            </div>
          </div>
          <div className="ad-card">
            <div className="ad-card-icon completion">
              <i className="ri-checkbox-circle-line" />
            </div>
            <div className="ad-card-content">
              <span className="ad-card-value">{Math.round(stats.completionRate * 100)}%</span>
              <span className="ad-card-label">Completion Rate</span>
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="ad-section">
          <h4>
            <i className="ri-bar-chart-2-line" />
            Score Breakdown
          </h4>
          <div className="ad-scores-grid">
            <div className="ad-score-card">
              <span className="ad-score-label">Vocabulary</span>
              <span className="ad-score-value">{stats.avgVocabularyScore ? `${Math.round(stats.avgVocabularyScore)}%` : 'N/A'}</span>
            </div>
            <div className="ad-score-card">
              <span className="ad-score-label">Grammar</span>
              <span className="ad-score-value">{stats.avgGrammarScore ? `${Math.round(stats.avgGrammarScore)}%` : 'N/A'}</span>
            </div>
            <div className="ad-score-card">
              <span className="ad-score-label">Exercises</span>
              <span className="ad-score-value">{stats.avgExerciseScore ? `${Math.round(stats.avgExerciseScore)}%` : 'N/A'}</span>
            </div>
            <div className="ad-score-card">
              <span className="ad-score-label">Overall</span>
              <span className="ad-score-value">{stats.avgOverallScore ? `${Math.round(stats.avgOverallScore)}%` : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="ad-section">
          <h4>
            <i className="ri-information-line" />
            Additional Metrics
          </h4>
          <div className="ad-metrics-list">
            <div className="ad-metric">
              <span className="ad-metric-label">Total Starts</span>
              <span className="ad-metric-value">{formatNumber(stats.totalStarts)}</span>
            </div>
            <div className="ad-metric">
              <span className="ad-metric-label">Total Completions</span>
              <span className="ad-metric-value">{formatNumber(stats.totalCompletions)}</span>
            </div>
            <div className="ad-metric">
              <span className="ad-metric-label">Bookmarks</span>
              <span className="ad-metric-value">{formatNumber(stats.bookmarkCount)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ad-container">
      <div className="ad-header">
        <h3>
          <i className="ri-bar-chart-grouped-line" />
          Lesson Analytics
        </h3>
        <div className="ad-controls">
          {onClose && (
            <button type="button" className="ad-close" onClick={onClose}>
              <i className="ri-close-line" />
            </button>
          )}
        </div>
      </div>

      <div className="ad-content">
        {isLoading ? (
          <div className="ad-loading">
            <i className="ri-loader-4-line spinning" />
            Loading analytics...
          </div>
        ) : error ? (
          <div className="ad-error">
            <i className="ri-error-warning-line" />
            {error}
          </div>
        ) : (
          renderSingleLessonView()
        )}
      </div>
    </div>
  );
}
