import { h, Fragment } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { Link } from 'react-router-dom';
import { tutorApi } from '../api/tutor.api';
import type { Tutor, TutorSearchParams } from '../types/tutor.types.ts';
import Header from '../Components/Header/Header';
import { BookingModal } from '../Components/Booking/BookingModal';
import './BrowseTutorsPage.css';

// Type assertion helper to fix Preact/React compatibility
const jsx = (el: any) => el as any;

// Tutor Card Component (inline for better control)
const TutorCard = ({ tutor, onBookClick }: { tutor: Tutor; onBookClick: (tutor: Tutor) => void }) => {
  const displayName = tutor.displayName || `${tutor.firstName} ${tutor.lastName}`;
  const initials = `${tutor.firstName?.[0] || ''}${tutor.lastName?.[0] || ''}`.toUpperCase();
  const rating = tutor.rating ? tutor.rating.toFixed(1) : 'New';
  const reviewCount = tutor.totalReviews || 0;
  const sessionCount = tutor.totalSessions || 0;

  const handleCardClick = (e: any) => {
    // Don't navigate if clicking the Book Now button
    if (e.target.closest('.tutor-card-new__cta')) {
      return;
    }
    window.location.href = `/tutor/${tutor.userId}`;
  };

  const handleBookNow = (e: any) => {
    e.stopPropagation();
    onBookClick(tutor);
  };

  const avatarContent = tutor.profilePicture ? (
    <img 
      src={tutor.profilePicture} 
      alt={displayName}
      className="tutor-card-new__avatar"
    />
  ) : (
    <div className="tutor-card-new__avatar tutor-card-new__avatar--placeholder">
      {initials}
    </div>
  );

  const verifiedBadge = tutor.isVerified ? (
    <div className="tutor-card-new__verified">
      <i className="ri-checkbox-circle-fill"></i>
    </div>
  ) : null;

  return (
    <div className="tutor-card-new" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      {/* Profile Section */}
      <div className="tutor-card-new__profile">
        <div className="tutor-card-new__avatar-link">
          {jsx(avatarContent)}
          {jsx(verifiedBadge)}
        </div>

        <div className="tutor-card-new__info">
          <div className="tutor-card-new__name-row">
            <h3 className="tutor-card-new__name">{displayName}</h3>
            {/* Availability Badge */}
            {tutor.isAvailable && (
              <div className="tutor-card-new__available-badge">
                <span className="tutor-card-new__pulse"></span>
                Available Now
              </div>
            )}
          </div>
          
          {/* Rating */}
          <div className="tutor-card-new__rating">
            <i className="ri-star-fill"></i>
            <span className="tutor-card-new__rating-value">{rating}</span>
            {reviewCount > 0 && (
              <span className="tutor-card-new__reviews">({reviewCount} reviews)</span>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {tutor.bio && (
        <p className="tutor-card-new__bio">
          {tutor.bio.length > 120 ? `${tutor.bio.substring(0, 120)}...` : tutor.bio}
        </p>
      )}

      {/* Languages */}
      {tutor.languages && tutor.languages.length > 0 && (
        <div className="tutor-card-new__languages">
          <i className="ri-translate-2"></i>
          <span>{tutor.languages.slice(0, 3).join(' • ')}</span>
          {tutor.languages.length > 3 && <span className="tutor-card-new__more">+{tutor.languages.length - 3}</span>}
        </div>
      )}

      {/* Specializations */}
      {tutor.specializations && tutor.specializations.length > 0 && (
        <div className="tutor-card-new__tags">
          {tutor.specializations.slice(0, 3).map((spec, idx) => (
            <span key={idx} className="tutor-card-new__tag">{spec}</span>
          ))}
          {tutor.specializations.length > 3 && (
            <span className="tutor-card-new__tag tutor-card-new__tag--more">+{tutor.specializations.length - 3}</span>
          )}
        </div>
      )}

      {/* Stats Row */}
      <div className="tutor-card-new__stats">
        <div className="tutor-card-new__stat">
          <i className="ri-video-chat-line"></i>
          <span>{sessionCount} lessons</span>
        </div>
        {tutor.country && (
          <div className="tutor-card-new__stat">
            <i className="ri-map-pin-line"></i>
            <span>{tutor.country}</span>
          </div>
        )}
      </div>

      {/* Footer with Book Now */}
      <div className="tutor-card-new__footer">
        <button onClick={handleBookNow} className="tutor-card-new__cta">
          Book Now
          <i className="ri-arrow-right-line"></i>
        </button>
      </div>
    </div>
  );
};

// Skeleton Loader
const TutorCardSkeleton = () => (
  <div className="tutor-card-skeleton">
    <div className="tutor-card-skeleton__profile">
      <div className="tutor-card-skeleton__avatar"></div>
      <div className="tutor-card-skeleton__info">
        <div className="tutor-card-skeleton__name"></div>
        <div className="tutor-card-skeleton__rating"></div>
      </div>
    </div>
    <div className="tutor-card-skeleton__bio"></div>
    <div className="tutor-card-skeleton__bio tutor-card-skeleton__bio--short"></div>
    <div className="tutor-card-skeleton__tags">
      <div className="tutor-card-skeleton__tag"></div>
      <div className="tutor-card-skeleton__tag"></div>
    </div>
    <div className="tutor-card-skeleton__footer"></div>
  </div>
);

export const BrowseTutorsPage = () => {
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  // Booking modal state
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  
  // Set page title
  useEffect(() => {
    document.title = 'Browse Tutors | FluentXVerse';
    return () => {
      document.title = 'FluentXVerse';
    };
  }, []);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [startTime, setStartTime] = useState<string>('05:00');
  const [endTime, setEndTime] = useState<string>('24:30');
  const [sortBy, setSortBy] = useState<'rating' | 'price-low' | 'price-high' | 'popular' | 'newest'>('rating');
  const [page, setPage] = useState(1);

  // Filter options
  const [availableSpecs, setAvailableSpecs] = useState<string[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Handle booking modal
  const handleBookClick = (tutor: Tutor) => {
    setSelectedTutor(tutor);
    setBookingModalOpen(true);
  };

  const handleCloseBookingModal = () => {
    setBookingModalOpen(false);
    setSelectedTutor(null);
  };

  // Generate next 7 days with formatted labels
  const generateDateOptions = () => {
    const options = [{ label: 'All Dates', value: 'all' }];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();
      const dayName = days[date.getDay()];
      const label = `${month}/${day} ${dayName}`;
      // Format as YYYY-MM-DD in local timezone to avoid UTC shift
      const value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      options.push({ label, value });
    }
    
    return options;
  };

  const dateOptions = generateDateOptions();

  // Generate time options (30-min intervals from 05:00 to 24:30)
  const generateTimeOptions = () => {
    const times = [];
    for (let h = 5; h < 24; h++) {
      times.push(`${String(h).padStart(2, '0')}:00`);
      if (h < 23 || h === 23) {
        times.push(`${String(h).padStart(2, '0')}:30`);
      }
    }
    times.push('24:30'); // Add final slot
    return times;
  };

  const timeOptions = generateTimeOptions();

  // Get valid end time options (must be AFTER start time, not same)
  const getEndTimeOptions = (currentStartTime: string) => {
    const startIdx = timeOptions.findIndex(t => t === currentStartTime);
    if (startIdx === -1) return timeOptions.slice(1); // Skip first option
    // Return times AFTER start time (startIdx + 1)
    return timeOptions.slice(startIdx + 1);
  };

  // Get valid start time options (must be BEFORE end time)
  const getStartTimeOptions = (currentEndTime: string) => {
    const endIdx = timeOptions.findIndex(t => t === currentEndTime);
    if (endIdx === -1) return timeOptions.slice(0, -1); // Skip last option
    // Return times BEFORE end time (0 to endIdx, exclusive)
    return timeOptions.slice(0, endIdx);
  };

  // Handle start time change - adjust end time if needed
  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    // If end time is not after start time, set end time to next slot after start
    const startIdx = timeOptions.findIndex(t => t === newStartTime);
    const endIdx = timeOptions.findIndex(t => t === endTime);
    if (endIdx <= startIdx && startIdx < timeOptions.length - 1) {
      setEndTime(timeOptions[startIdx + 1]);
    }
  };

  // Handle end time change - adjust start time if needed
  const handleEndTimeChange = (newEndTime: string) => {
    setEndTime(newEndTime);
    // If start time is not before end time, set start time to previous slot
    const startIdx = timeOptions.findIndex(t => t === startTime);
    const endIdx = timeOptions.findIndex(t => t === newEndTime);
    if (startIdx >= endIdx && endIdx > 0) {
      setStartTime(timeOptions[endIdx - 1]);
    }
  };

  // Quick filter options - all dates (remove budget friendly)
  const quickFilters = [
    { label: 'All Tutors', value: 'all' },
    ...dateOptions.slice(1).map(d => ({ label: d.label, value: d.value })),
  ];
  const [activeQuickFilter, setActiveQuickFilter] = useState('all');


  // Search tutors
  const searchTutors = useCallback(async (resetPage = false) => {
    try {
      setLoading(true);
      setError(null);

      const params: TutorSearchParams = {
        query: searchQuery || undefined,
        specializations: selectedSpecs.length > 0 ? selectedSpecs : undefined,
        dateFilter: selectedDate !== 'all' ? selectedDate : undefined,
        startTime: startTime !== '06:00' ? startTime : undefined,
        endTime: endTime !== '24:30' ? endTime : undefined,
        sortBy,
        page: resetPage ? 1 : page,
        limit: 12
      };

      const result = await tutorApi.searchTutors(params);

      // If "All Dates" is selected, show only tutors with any open schedule
      const filteredTutors = selectedDate === 'all'
        ? result.tutors.filter(t => t.isAvailable)
        : result.tutors;

      if (resetPage) {
        setTutors(filteredTutors);
        setPage(1);
      } else {
        setTutors(prev => [...prev, ...filteredTutors]);
      }

      // Adjust count/hasMore based on filtered results when on "All Dates"
      const totalCount = selectedDate === 'all' ? filteredTutors.length : result.total;
      setTotal(totalCount);
      setHasMore(selectedDate === 'all' ? false : result.hasMore);
    } catch (err) {
      console.error('Failed to search tutors:', err);
      setError('Failed to load tutors. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedSpecs, selectedDate, startTime, endTime, sortBy, page]);

  // Initial load and when filters change
  useEffect(() => {
    searchTutors(true);
  }, [selectedSpecs, selectedDate, startTime, endTime, sortBy]);

  // Handle search submit
  const handleSearch = (e: Event) => {
    e.preventDefault();
    searchTutors(true);
  };

  // Load more
  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    searchTutors(false);
  };

  // Toggle specialization filter
  const toggleSpec = (spec: string) => {
    setSelectedSpecs(prev => 
      prev.includes(spec) 
        ? prev.filter(s => s !== spec)
        : [...prev, spec]
    );
  };

  // Handle quick filters
  const handleQuickFilter = (value: string) => {
    setActiveQuickFilter(value);
    if (value === 'all') {
      setSelectedDate('all');
      setSortBy('rating');
    } else {
      // It's a date value
      setSelectedDate(value);
      setSortBy('rating');
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedSpecs([]);
    setSelectedDate('all');
    setStartTime('06:00');
    setEndTime('24:30');
    setSortBy('rating');
    setActiveQuickFilter('all');
  };

  const hasActiveFilters = selectedSpecs.length > 0 || 
    selectedDate !== 'all' ||
    startTime !== '06:00' ||
    endTime !== '24:30';

  return (
    <>
      <Header />
      <div className="browse-page">
          {/* Hero Section */}
          <section className="browse-hero">
            <div className="browse-hero__bg">
              <div className="browse-hero__image" aria-hidden="true"></div>
              <div className="browse-hero__gradient"></div>
              <div className="browse-hero__pattern"></div>
            </div>
            
            <div className="browse-hero__content">
              <h1 className="browse-hero__title">
                Find Your Perfect
                <span className="browse-hero__highlight"> English Tutor</span>
              </h1>
              <p className="browse-hero__subtitle">
                Connect with expert tutors for personalized 1-on-1 lessons
              </p>

              {/* Search Bar */}
              <form className="browse-search" onSubmit={handleSearch}>
                <div className="browse-search__input-wrapper">
                  <i className="ri-search-line browse-search__icon"></i>
                  <input
                    type="text"
                    className="browse-search__input"
                    placeholder="Search by name"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                  />
                  {searchQuery && (
                    <button 
                      type="button" 
                      className="browse-search__clear"
                      onClick={() => { setSearchQuery(''); searchTutors(true); }}
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  )}
                </div>
                <button type="submit" className="browse-search__btn">
              <i className="ri-search-line"></i>
              <span>Search</span>
            </button>
          </form>

          {/* Quick Stats */}
          {/* <div className="browse-hero__stats">
            <div className="browse-hero__stat">
              <span className="browse-hero__stat-value">{total}+</span>
              <span className="browse-hero__stat-label">Active Tutors</span>
            </div>
            <div className="browse-hero__stat-divider"></div>
            <div className="browse-hero__stat">
              <span className="browse-hero__stat-value">10+</span>
              <span className="browse-hero__stat-label">Languages</span>
            </div>
            <div className="browse-hero__stat-divider"></div>
            <div className="browse-hero__stat">
              <span className="browse-hero__stat-value">4.8</span>
              <span className="browse-hero__stat-label">Avg Rating</span>
            </div>
          </div> */}
        </div>
      </section>

      {/* Main Content */}
      <section className="browse-main">
        <div className="browse-container">
          {/* Top Bar with Quick Filters */}
          <div className="browse-topbar">
            <div className="browse-topbar__left">
              {/* Quick Filters */}
              <div className="browse-quick-filters">
                {quickFilters.map(filter => (
                  <button
                    key={filter.value}
                    className={`browse-quick-filter ${activeQuickFilter === filter.value ? 'browse-quick-filter--active' : ''}`}
                    onClick={() => handleQuickFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="browse-topbar__right">
              {/* Time Range Filter */}
              <div className="browse-topbar__time-range">
                <label className="browse-topbar__time-label">Time:</label>
                <select 
                  className="browse-topbar__time-select"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange((e.target as HTMLSelectElement).value)}
                >
                  {getStartTimeOptions(endTime).map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                <span className="browse-topbar__time-separator">~</span>
                <select 
                  className="browse-topbar__time-select"
                  value={endTime}
                  onChange={(e) => handleEndTimeChange((e.target as HTMLSelectElement).value)}
                >
                  {getEndTimeOptions(startTime).map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>

              {/* Mobile Filter Toggle */}
              <button 
                className="browse-filter-toggle"
                onClick={() => setShowMobileFilters(true)}
              >
                <i className="ri-filter-3-line"></i>
                Filters
                {hasActiveFilters && <span className="browse-filter-toggle__badge"></span>}
              </button>
            </div>
          </div>

          {/* Content Layout */}
          <div className="browse-layout">
            {/* Sidebar Filters */}
            <aside className={`browse-sidebar ${showMobileFilters ? 'browse-sidebar--open' : ''}`}>
              <div className="browse-sidebar__header">
                <h3>Filters</h3>
                <button 
                  className="browse-sidebar__close"
                  onClick={() => setShowMobileFilters(false)}
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>

              {hasActiveFilters && (
                <button className="browse-clear-filters" onClick={clearFilters}>
                  <i className="ri-refresh-line"></i>
                  Clear all filters
                </button>
              )}

              {/* Availability Date */}
              <div className="browse-filter-group">
                <h4 className="browse-filter-group__title">Availability Date</h4>
                <div className="browse-filter-group__list">
                  {dateOptions.map(opt => (
                    <label key={opt.value} className="browse-filter-checkbox">
                      <input 
                        type="radio"
                        name="date-filter"
                        checked={selectedDate === opt.value}
                        onChange={() => setSelectedDate(opt.value)}
                      />
                      <span className="browse-filter-checkbox__mark"></span>
                      <span className="browse-filter-checkbox__label">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Time Range */}
              <div className="browse-filter-group">
                <h4 className="browse-filter-group__title">Time Range</h4>
                <div className="browse-filter-group__time-range">
                  <div className="browse-filter-group__time-input">
                    <label>Start time</label>
                    <select 
                      value={startTime}
                      onChange={(e) => handleStartTimeChange((e.target as HTMLSelectElement).value)}
                      className="browse-filter-group__select"
                    >
                      {getStartTimeOptions(endTime).map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                  <span className="browse-filter-group__time-separator">~</span>
                  <div className="browse-filter-group__time-input">
                    <label>End time</label>
                    <select 
                      value={endTime}
                      onChange={(e) => handleEndTimeChange((e.target as HTMLSelectElement).value)}
                      className="browse-filter-group__select"
                    >
                      {getEndTimeOptions(startTime).map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Specializations */}
              {availableSpecs.length > 0 && (
                <div className="browse-filter-group">
                  <h4 className="browse-filter-group__title">Specializations</h4>
                  <div className="browse-filter-group__list">
                    {availableSpecs.map(spec => (
                      <label key={spec} className="browse-filter-checkbox">
                        <input 
                          type="checkbox" 
                          checked={selectedSpecs.includes(spec)}
                          onChange={() => toggleSpec(spec)}
                        />
                        <span className="browse-filter-checkbox__mark"></span>
                        <span className="browse-filter-checkbox__label">{spec}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Mobile Apply Button */}
              <button 
                className="browse-sidebar__apply"
                onClick={() => setShowMobileFilters(false)}
              >
                Show {total} tutors
              </button>
            </aside>

            {/* Mobile Overlay */}
            {showMobileFilters && (
              <div 
                className="browse-sidebar__overlay"
                onClick={() => setShowMobileFilters(false)}
              ></div>
            )}

            {/* Results */}
            <div className="browse-results">
              {/* Results Count */}
              <div className="browse-results__header">
                <p className="browse-results__count">
                  {loading && tutors.length === 0 ? (
                    'Finding tutors...'
                  ) : (
                    <>
                      Showing <strong>{tutors.length}</strong> of <strong>{total}</strong> tutors
                    </>
                  )}
                </p>

                {/* Active Filter Tags */}
                {hasActiveFilters && (
                  <div className="browse-active-filters">
                    {selectedSpecs.map(spec => (
                      <span key={spec} className="browse-active-filter">
                        {spec}
                        <button onClick={() => toggleSpec(spec)}>
                          <i className="ri-close-line"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Error State */}
              {error && (
                <div className="browse-error">
                  <i className="ri-error-warning-line"></i>
                  <h3>Something went wrong</h3>
                  <p>{error}</p>
                  <button onClick={() => searchTutors(true)} className="browse-error__btn">
                    <i className="ri-refresh-line"></i>
                    Try Again
                  </button>
                </div>
              )}

              {/* Tutors Grid */}
              {!error && (
                <>
                  <div className="browse-grid">
                    {/* Show skeleton loaders when loading initially */}
                    {loading && tutors.length === 0 && (
                      <>
                        {[...Array(6)].map((_, i) => (
                          <TutorCardSkeleton key={i} />
                        ))}
                      </>
                    )}

                    {/* Show tutor cards */}
                    {tutors.map((tutor) => (
                      <TutorCard key={tutor.userId} tutor={tutor} onBookClick={handleBookClick} />
                    ))}
                  </div>

                  {/* Empty State */}
                  {!loading && tutors.length === 0 && (
                    <div className="browse-empty">
                      <div className="browse-empty__icon">
                        <i className="ri-user-search-line"></i>
                      </div>
                      <h3>No tutors found</h3>
                      <p>Try adjusting your filters or search query</p>
                      <button onClick={clearFilters} className="browse-empty__btn">
                        Clear all filters
                      </button>
                    </div>
                  )}

                  {/* Load More */}
                  {hasMore && !loading && (
                    <div className="browse-load-more">
                      <button 
                        onClick={handleLoadMore}
                        className="browse-load-more__btn"
                        disabled={loading}
                      >
                        <span>Load More Tutors</span>
                        <i className="ri-arrow-down-line"></i>
                      </button>
                    </div>
                  )}

                  {/* Loading more indicator */}
                  {loading && tutors.length > 0 && (
                    <div className="browse-loading-more">
                      <div className="browse-loading-more__spinner"></div>
                      <span>Loading more tutors...</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        </section>
      </div>

      {/* Booking Modal */}
      {selectedTutor && (
        <BookingModal
          isOpen={bookingModalOpen}
          onClose={handleCloseBookingModal}
          tutorId={selectedTutor.userId}
          tutorName={selectedTutor.displayName || `${selectedTutor.firstName} ${selectedTutor.lastName}`}
          tutorAvatar={selectedTutor.profilePicture}
          hourlyRate={selectedTutor.hourlyRate}
        />
      )}
    </>
  );
};
