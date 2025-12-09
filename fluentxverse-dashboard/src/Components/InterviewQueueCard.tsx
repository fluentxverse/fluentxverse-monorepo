import { useState, useEffect } from 'preact/hooks';
import { interviewApi } from '../api/interview.api';
import './InterviewQueueCard.css';

interface TodayInterview {
  id: string;
  time: string;
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  status: string;
}

interface InterviewQueueCardProps {
  onRefresh?: () => void;
}

const InterviewQueueCard = ({ onRefresh }: InterviewQueueCardProps) => {
  const [queue, setQueue] = useState<TodayInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextInterview, setNextInterview] = useState<TodayInterview | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    loadQueue();
    // Refresh every 30 seconds
    const interval = setInterval(loadQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update countdown every second
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [nextInterview]);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const data = await interviewApi.getTodayQueue();
      setQueue(data);
      
      // Find next upcoming interview
      const now = new Date();
      const upcoming = data.filter(interview => {
        const time = parseTime(interview.time);
        return time > now && interview.status !== 'completed' && interview.status !== 'cancelled';
      }).sort((a, b) => parseTime(a.time).getTime() - parseTime(b.time).getTime());
      
      setNextInterview(upcoming[0] || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  const parseTime = (timeStr: string): Date => {
    const now = new Date();
    const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (timeParts) {
      let h = parseInt(timeParts[1]);
      const m = parseInt(timeParts[2]);
      const ampm = timeParts[3];
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
      }
      now.setHours(h, m, 0, 0);
    }
    return now;
  };

  const updateCountdown = () => {
    if (!nextInterview) {
      setCountdown('');
      return;
    }
    
    const now = new Date();
    const interviewTime = parseTime(nextInterview.time);
    const diff = interviewTime.getTime() - now.getTime();
    
    if (diff <= 0) {
      setCountdown('Starting now!');
      return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    } else if (minutes > 0) {
      setCountdown(`${minutes}m ${seconds}s`);
    } else {
      setCountdown(`${seconds}s`);
    }
  };

  const handleCancelClick = (id: string) => {
    setCancellingId(id);
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingId) return;
    
    try {
      setCancelLoading(true);
      await interviewApi.adminCancelBooking(cancellingId);
      await loadQueue();
      onRefresh?.();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel interview');
    } finally {
      setCancelLoading(false);
      setShowCancelModal(false);
      setCancellingId(null);
    }
  };

  const getStatusInfo = (interview: TodayInterview) => {
    const now = new Date();
    const interviewTime = parseTime(interview.time);
    const endTime = new Date(interviewTime);
    endTime.setHours(endTime.getHours() + 1);
    
    if (interview.status === 'completed') {
      return { label: 'Completed', class: 'completed', icon: 'ri-check-line' };
    }
    if (interview.status === 'cancelled') {
      return { label: 'Cancelled', class: 'cancelled', icon: 'ri-close-line' };
    }
    if (interview.status === 'in_progress') {
      return { label: 'In Progress', class: 'in-progress', icon: 'ri-record-circle-line' };
    }
    if (now > endTime) {
      return { label: 'Missed', class: 'missed', icon: 'ri-time-line' };
    }
    if (now >= interviewTime && now <= endTime) {
      return { label: 'Starting', class: 'starting', icon: 'ri-notification-line' };
    }
    return { label: 'Scheduled', class: 'scheduled', icon: 'ri-calendar-check-line' };
  };

  const completedCount = queue.filter(i => i.status === 'completed').length;
  const upcomingCount = queue.filter(i => {
    const status = getStatusInfo(i);
    return status.class === 'scheduled' || status.class === 'starting';
  }).length;

  if (loading && queue.length === 0) {
    return (
      <div className="interview-queue-card">
        <div className="queue-header">
          <h3><i className="ri-calendar-todo-line"></i> Today's Interview Queue</h3>
        </div>
        <div className="queue-loading">
          <i className="ri-loader-4-line spinning"></i>
          <span>Loading queue...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="interview-queue-card">
      <div className="queue-header">
        <div className="queue-title">
          <h3><i className="ri-calendar-todo-line"></i> Today's Interview Queue</h3>
          <div className="queue-stats">
            <span className="stat completed"><i className="ri-check-line"></i> {completedCount} done</span>
            <span className="stat upcoming"><i className="ri-time-line"></i> {upcomingCount} upcoming</span>
          </div>
        </div>
        <button className="refresh-btn" onClick={loadQueue} disabled={loading}>
          <i className={`ri-refresh-line ${loading ? 'spinning' : ''}`}></i>
        </button>
      </div>

      {/* Next Interview Countdown */}
      {nextInterview && (
        <div className="next-interview-banner">
          <div className="next-info">
            <span className="next-label">Next Interview</span>
            <span className="next-tutor">{nextInterview.tutorName}</span>
            <span className="next-time">{nextInterview.time}</span>
          </div>
          <div className="countdown">
            <span className="countdown-label">Starts in</span>
            <span className="countdown-time">{countdown}</span>
          </div>
          <a 
            href={`/interview/room/${nextInterview.id}?tutorId=${nextInterview.tutorId}`}
            className="join-next-btn"
          >
            <i className="ri-video-line"></i> Join Room
          </a>
        </div>
      )}

      {/* Queue List */}
      <div className="queue-list">
        {queue.length === 0 ? (
          <div className="queue-empty">
            <i className="ri-calendar-check-line"></i>
            <p>No interviews scheduled for today</p>
            <a href="/interviews" className="schedule-link">
              <i className="ri-add-line"></i> Open Schedule
            </a>
          </div>
        ) : (
          queue.map((interview) => {
            const status = getStatusInfo(interview);
            const canJoin = status.class === 'starting' || status.class === 'in-progress' || status.class === 'scheduled';
            const canCancel = status.class === 'scheduled';
            
            return (
              <div className={`queue-item ${status.class}`} key={interview.id}>
                <div className="item-time">
                  <i className="ri-time-line"></i>
                  <span>{interview.time}</span>
                </div>
                
                <div className="item-tutor">
                  <div className="tutor-avatar">
                    <span>{interview.tutorName.charAt(0)}</span>
                  </div>
                  <div className="tutor-details">
                    <span className="tutor-name">{interview.tutorName}</span>
                    <span className="tutor-email">{interview.tutorEmail}</span>
                  </div>
                </div>
                
                <div className={`item-status ${status.class}`}>
                  <i className={status.icon}></i>
                  <span>{status.label}</span>
                </div>
                
                <div className="item-actions">
                  {canJoin && (
                    <a 
                      href={`/interview/room/${interview.id}?tutorId=${interview.tutorId}`}
                      className="action-btn join"
                      title="Join Interview"
                    >
                      <i className="ri-video-line"></i>
                    </a>
                  )}
                  {canCancel && (
                    <button 
                      className="action-btn cancel"
                      title="Cancel Interview"
                      onClick={() => handleCancelClick(interview.id)}
                    >
                      <i className="ri-close-circle-line"></i>
                    </button>
                  )}
                  {status.class === 'completed' && (
                    <a 
                      href={`/tutors?id=${interview.tutorId}`}
                      className="action-btn view"
                      title="View Result"
                    >
                      <i className="ri-file-list-3-line"></i>
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal-content cancel-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="ri-error-warning-line"></i> Cancel Interview</h3>
              <button className="modal-close" onClick={() => setShowCancelModal(false)}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to cancel this interview?</p>
              <p className="warning-text">
                <i className="ri-information-line"></i>
                The tutor will be notified and will need to book a new slot.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCancelModal(false)}>
                Keep Interview
              </button>
              <button 
                className="btn-danger" 
                onClick={handleConfirmCancel}
                disabled={cancelLoading}
              >
                {cancelLoading ? (
                  <><i className="ri-loader-4-line spinning"></i> Cancelling...</>
                ) : (
                  <><i className="ri-close-circle-line"></i> Cancel Interview</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewQueueCard;
