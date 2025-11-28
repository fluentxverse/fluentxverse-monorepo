import { h } from 'preact';
import { Link } from 'react-router-dom';
import type { Tutor } from '../../types/tutor.types';
import './TutorCard.css';

interface TutorCardProps {
  tutor: Tutor;
}

export const TutorCard = ({ tutor }: TutorCardProps) => {
  const displayName = tutor.displayName || `${tutor.firstName} ${tutor.lastName}`;
  const initials = `${tutor.firstName?.[0] || ''}${tutor.lastName?.[0] || ''}`.toUpperCase();
  const hourlyRate = tutor.hourlyRate ? `₱${tutor.hourlyRate}/hr` : 'Rate not set';
  const rating = tutor.rating ? tutor.rating.toFixed(1) : 'New';
  const reviewCount = tutor.totalReviews || 0;
  const sessionCount = tutor.totalSessions || 0;

  return (
    <div className="tutor-card">
      <div className="tutor-card__header">
        <Link to={`/tutor/${tutor.userId}`} className="tutor-card__avatar-link">
          {tutor.profilePicture ? (
            <img 
              src={tutor.profilePicture} 
              alt={displayName}
              className="tutor-card__avatar"
            />
          ) : (
            <div className="tutor-card__avatar tutor-card__avatar--placeholder">
              {initials}
            </div>
          )}
        </Link>
        
        {tutor.isVerified && (
          <span className="tutor-card__badge tutor-card__badge--verified">
            <i className="ri-checkbox-circle-fill"></i> Verified
          </span>
        )}
        
        {tutor.isAvailable && (
          <span className="tutor-card__badge tutor-card__badge--available">
            <i className="ri-record-circle-fill"></i> Available
          </span>
        )}
      </div>

      <div className="tutor-card__body">
        <Link to={`/tutor/${tutor.userId}`} className="tutor-card__name-link">
          <h3 className="tutor-card__name">{displayName}</h3>
        </Link>

        {tutor.bio && (
          <p className="tutor-card__bio">
            {tutor.bio.length > 100 ? `${tutor.bio.substring(0, 100)}...` : tutor.bio}
          </p>
        )}

        {tutor.languages && tutor.languages.length > 0 && (
          <div className="tutor-card__languages">
            <i className="ri-global-line"></i>
            <span>{tutor.languages.slice(0, 3).join(', ')}</span>
            {tutor.languages.length > 3 && <span> +{tutor.languages.length - 3}</span>}
          </div>
        )}

        {tutor.specializations && tutor.specializations.length > 0 && (
          <div className="tutor-card__specializations">
            {tutor.specializations.slice(0, 3).map((spec, idx) => (
              <span key={idx} className="tutor-card__tag">{spec}</span>
            ))}
            {tutor.specializations.length > 3 && (
              <span className="tutor-card__tag">+{tutor.specializations.length - 3}</span>
            )}
          </div>
        )}

        <div className="tutor-card__stats">
          <div className="tutor-card__stat">
            <i className="ri-star-fill"></i>
            <span className="tutor-card__stat-value">{rating}</span>
            {reviewCount > 0 && (
              <span className="tutor-card__stat-label">({reviewCount})</span>
            )}
          </div>
          
          <div className="tutor-card__stat">
            <i className="ri-time-line"></i>
            <span className="tutor-card__stat-value">{sessionCount}</span>
            <span className="tutor-card__stat-label">sessions</span>
          </div>
        </div>
      </div>

      <div className="tutor-card__footer">
        <div className="tutor-card__price">
          <span className="tutor-card__price-value">{hourlyRate}</span>
        </div>
        
        <Link 
          to={`/tutor/${tutor.userId}`}
          className="tutor-card__button"
        >
          View Profile
        </Link>
      </div>
    </div>
  );
};
