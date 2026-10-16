import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import type { Tutor } from '../../types/tutor.types';
import ProfileAvatar from '../Common/ProfileAvatar';
import './TutorCard.css';
interface TutorCardProps {
    tutor: Tutor;
}
export const TutorCard = (_props0: TutorCardProps) => {
    const displayName = createMemo(() => _props0["tutor"].displayName || `${_props0["tutor"].firstName} ${_props0["tutor"].lastName}`);
    const initials = createMemo(() => `${_props0["tutor"].firstName?.[0] || ''}${_props0["tutor"].lastName?.[0] || ''}`.toUpperCase());
    const hourlyRate = createMemo(() => _props0["tutor"].hourlyRate ? `₱${_props0["tutor"].hourlyRate}/hr` : 'Rate not set');
    const rating = createMemo(() => _props0["tutor"].rating ? _props0["tutor"].rating.toFixed(1) : 'New');
    const reviewCount = createMemo(() => _props0["tutor"].totalReviews || 0);
    const sessionCount = createMemo(() => _props0["tutor"].totalSessions || 0);
    return (<div class="tutor-card">
      <div class="tutor-card__header">
        <a href={`/tutor/${_props0["tutor"].userId}`} class="tutor-card__avatar-link">
          <ProfileAvatar src={_props0["tutor"].profilePicture} alt={displayName()} className="tutor-card__avatar" fallbackClassName="tutor-card__avatar--placeholder" fallback={initials()}/>
        </a>
        
        {_props0["tutor"].isVerified && (<span class="tutor-card__badge tutor-card__badge--verified">
            <i class="ri-checkbox-circle-fill"></i> Verified
          </span>)}
        
        {_props0["tutor"].isAvailable && (<span class="tutor-card__badge tutor-card__badge--available">
            <i class="ri-record-circle-fill"></i> Available
          </span>)}
      </div>

      <div class="tutor-card__body">
        <a href={`/tutor/${_props0["tutor"].userId}`} class="tutor-card__name-link">
          <h3 class="tutor-card__name">{displayName()}</h3>
        </a>

        {_props0["tutor"].bio && (<p class="tutor-card__bio">
            {_props0["tutor"].bio.length > 100 ? `${_props0["tutor"].bio.substring(0, 100)}...` : _props0["tutor"].bio}
          </p>)}

        {_props0["tutor"].languages && _props0["tutor"].languages.length > 0 && (<div class="tutor-card__languages">
            <i class="ri-global-line"></i>
            <span>{_props0["tutor"].languages.slice(0, 3).join(', ')}</span>
            {_props0["tutor"].languages.length > 3 && <span> +{_props0["tutor"].languages.length - 3}</span>}
          </div>)}

        {_props0["tutor"].specializations && _props0["tutor"].specializations.length > 0 && (<div class="tutor-card__specializations">
            {_props0["tutor"].specializations.slice(0, 3).map((spec, idx) => (<span class="tutor-card__tag">{spec}</span>))}
            {_props0["tutor"].specializations.length > 3 && (<span class="tutor-card__tag">+{_props0["tutor"].specializations.length - 3}</span>)}
          </div>)}

        <div class="tutor-card__stats">
          <div class="tutor-card__stat">
            <i class="ri-star-fill"></i>
            <span class="tutor-card__stat-value">{rating()}</span>
            {reviewCount() > 0 && (<span class="tutor-card__stat-label">({reviewCount()})</span>)}
          </div>
          
          <div class="tutor-card__stat">
            <i class="ri-time-line"></i>
            <span class="tutor-card__stat-value">{sessionCount()}</span>
            <span class="tutor-card__stat-label">sessions</span>
          </div>
        </div>
      </div>

      <div class="tutor-card__footer">
        <div class="tutor-card__price">
          <span class="tutor-card__price-value">{hourlyRate()}</span>
        </div>
        
        <a href={`/tutor/${_props0["tutor"].userId}`} class="tutor-card__button">
          View Profile
        </a>
      </div>
    </div>);
};
