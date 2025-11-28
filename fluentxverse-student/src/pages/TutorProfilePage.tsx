import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { tutorApi } from '../api/tutor.api.ts';
import type { TutorProfile } from '../types/tutor.types';
import './TutorProfilePage.css';

export const TutorProfilePage = () => {
  const { params } = useRoute();
  const tutorId = params.tutorId;

  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTutor = async () => {
      try {
        setLoading(true);
        const data = await tutorApi.getTutorProfile(tutorId);
        setTutor(data);
      } catch (err) {
        setError('Failed to load tutor profile');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (tutorId) {
      loadTutor();
    }
  }, [tutorId]);

  if (loading) {
    return (
      <div className="tutor-profile-loading">
        <div className="spinner"></div>
        <p>Loading tutor profile...</p>
      </div>
    );
  }

  if (error || !tutor) {
    return (
      <div className="tutor-profile-error">
        <i className="ri-error-warning-line"></i>
        <h2>Tutor not found</h2>
        <p>{error || 'The tutor you are looking for does not exist.'}</p>
        <a href="/browse-tutors" className="btn-primary">Browse Tutors</a>
      </div>
    );
  }

  const displayName = tutor.displayName || `${tutor.firstName} ${tutor.lastName}`;
  const initials = `${tutor.firstName?.[0] || ''}${tutor.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="tutor-profile-page">
      <div className="container">
        {/* Header */}
        <div className="profile-header">
          <div className="profile-avatar-section">
            {tutor.profilePicture ? (
              <img src={tutor.profilePicture} alt={displayName} className="profile-avatar" />
            ) : (
              <div className="profile-avatar profile-avatar--placeholder">{initials}</div>
            )}
            
            <div className="profile-badges">
              {tutor.isVerified && (
                <span className="badge badge--verified">
                  <i className="ri-checkbox-circle-fill"></i> Verified
                </span>
              )}
              {tutor.isAvailable && (
                <span className="badge badge--available">
                  <i className="ri-record-circle-fill"></i> Available Now
                </span>
              )}
            </div>
          </div>

          <div className="profile-info">
            <h1 className="profile-name">{displayName}</h1>
            
            <div className="profile-stats">
              <div className="stat">
                <i className="ri-star-fill"></i>
                <span>{tutor.rating ? tutor.rating.toFixed(1) : 'New'}</span>
                {tutor.totalReviews && <span className="stat-detail">({tutor.totalReviews} reviews)</span>}
              </div>
              <div className="stat">
                <i className="ri-time-line"></i>
                <span>{tutor.totalSessions || 0} sessions</span>
              </div>
              {tutor.experienceYears && (
                <div className="stat">
                  <i className="ri-calendar-line"></i>
                  <span>{tutor.experienceYears} years experience</span>
                </div>
              )}
            </div>

            {tutor.languages && tutor.languages.length > 0 && (
              <div className="profile-languages">
                <i className="ri-global-line"></i>
                <span>{tutor.languages.join(', ')}</span>
              </div>
            )}
          </div>

          <div className="profile-actions">
            <div className="profile-price">
              <span className="price-label">Hourly Rate</span>
              <span className="price-value">₱{tutor.hourlyRate || 'TBD'}/hr</span>
            </div>
            <button className="btn-book">Book a Session</button>
            <button className="btn-message">
              <i className="ri-message-line"></i> Message
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="profile-content">
          {/* About */}
          <section className="profile-section">
            <h2>About</h2>
            <p>{tutor.introduction || tutor.bio || 'No introduction provided yet.'}</p>
          </section>

          {/* Specializations */}
          {tutor.specializations && tutor.specializations.length > 0 && (
            <section className="profile-section">
              <h2>Specializations</h2>
              <div className="tags-list">
                {tutor.specializations.map((spec, idx) => (
                  <span key={idx} className="tag">{spec}</span>
                ))}
              </div>
            </section>
          )}

          {/* Education & Certifications */}
          {(tutor.education?.length || tutor.certifications?.length) && (
            <section className="profile-section">
              <h2>Qualifications</h2>
              {tutor.education && tutor.education.length > 0 && (
                <div className="qualification-group">
                  <h3>Education</h3>
                  <ul>
                    {tutor.education.map((edu, idx) => (
                      <li key={idx}>{edu}</li>
                    ))}
                  </ul>
                </div>
              )}
              {tutor.certifications && tutor.certifications.length > 0 && (
                <div className="qualification-group">
                  <h3>Certifications</h3>
                  <ul>
                    {tutor.certifications.map((cert, idx) => (
                      <li key={idx}>{cert}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Teaching Style */}
          {tutor.teachingStyle && (
            <section className="profile-section">
              <h2>Teaching Style</h2>
              <p>{tutor.teachingStyle}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
