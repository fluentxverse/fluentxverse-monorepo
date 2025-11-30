import { h, Fragment } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { Link } from 'react-router-dom';
import { tutorApi } from '../api/tutor.api';
import type { Tutor, TutorSearchParams } from '../types/tutor.types.ts';
import Header from '../Components/Header/Header';
import './BrowseTutorsPage.css';

// Type assertion helper to fix Preact/React compatibility
const jsx = (el: any) => el as any;

// Tutor Card Component (inline for better control)
const TutorCard = ({ tutor }: { tutor: Tutor }) => {
  const displayName = tutor.displayName || `${tutor.firstName} ${tutor.lastName}`;
  const initials = `${tutor.firstName?.[0] || ''}${tutor.lastName?.[0] || ''}`.toUpperCase();
  const hourlyRate = tutor.hourlyRate ? `₱${tutor.hourlyRate}` : 'Free';
  const rating = tutor.rating ? tutor.rating.toFixed(1) : 'New';
  const reviewCount = tutor.totalReviews || 0;
  const sessionCount = tutor.totalSessions || 0;

  const handleCardClick = (e: any) => {
    // Don't navigate if clicking the Book Trial button
    if (e.target.closest('.tutor-card-new__cta')) {
      return;
    }
    window.location.href = `/tutor/${tutor.userId}`;
  };

  const handleBookTrial = (e: any) => {
    e.stopPropagation();
    window.location.href = `/register?tutorId=${tutor.userId}`;
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
      {/* Availability Badge */}
      {tutor.isAvailable && (
        <div className="tutor-card-new__available-badge">
          <span className="tutor-card-new__pulse"></span>
          Available Now
        </div>
      )}

      {/* Profile Section */}
      <div className="tutor-card-new__profile">
        <div className="tutor-card-new__avatar-link">
          {jsx(avatarContent)}
          {jsx(verifiedBadge)}
        </div>

        <div className="tutor-card-new__info">
          <h3 className="tutor-card-new__name">{displayName}</h3>
          
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

      {/* Footer */}
      <div className="tutor-card-new__footer">
        <div className="tutor-card-new__price">
          <span className="tutor-card-new__price-value">{hourlyRate}</span>
          <span className="tutor-card-new__price-label">/hour</span>
        </div>
        <button onClick={handleBookTrial} className="tutor-card-new__cta">
          Book Trial
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
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'price-low' | 'price-high' | 'popular' | 'newest'>('rating');
  const [page, setPage] = useState(1);

  // Filter options
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [availableSpecs, setAvailableSpecs] = useState<string[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Generate next 7 days with formatted labels
  const generateDateOptions = () => {
    const options = [{ label: 'All Dates', value: 'all' }];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const dayName = days[date.getDay()];
      const label = `${month}/${day} ${dayName}`;
      const value = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      options.push({ label, value });
    }
    
    return options;
  };

  const dateOptions = generateDateOptions();

  // Quick filter options - use first 3 specific dates
  const quickFilters = [
    { label: 'All Tutors', value: 'all' },
    ...dateOptions.slice(1, 4).map(d => ({ label: d.label, value: d.value })),
    { label: 'Budget Friendly', value: 'budget' },
  ];
  const [activeQuickFilter, setActiveQuickFilter] = useState('all');

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [languages, specs] = await Promise.all([
          tutorApi.getFilterLanguages(),
          tutorApi.getFilterSpecializations()
        ]);
        setAvailableLanguages(languages);
        setAvailableSpecs(specs);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };

    loadFilterOptions();
  }, []);

  // Search tutors
  const searchTutors = useCallback(async (resetPage = false) => {
    try {
      setLoading(true);
      setError(null);

      const params: TutorSearchParams = {
        query: searchQuery || undefined,
        languages: selectedLanguages.length > 0 ? selectedLanguages : undefined,
        specializations: selectedSpecs.length > 0 ? selectedSpecs : undefined,
        dateFilter: selectedDate !== 'all' ? selectedDate : undefined,
        sortBy,
        page: resetPage ? 1 : page,
        limit: 12
      };

      const result = await tutorApi.searchTutors(params);

      if (resetPage) {
        setTutors(result.tutors);
        setPage(1);
      } else {
        setTutors(prev => [...prev, ...result.tutors]);
      }

      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to search tutors:', err);
      setError('Failed to load tutors. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedLanguages, selectedSpecs, selectedDate, sortBy, page]);

  // Initial load and when filters change
  useEffect(() => {
    searchTutors(true);
  }, [selectedLanguages, selectedSpecs, selectedDate, sortBy]);

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

  // Toggle language filter
  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev => 
      prev.includes(lang) 
        ? prev.filter(l => l !== lang)
        : [...prev, lang]
    );
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
    if (value === 'budget') {
      setSelectedDate('all');
      setSortBy('price-low');
    } else if (value === 'all') {
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
    setSelectedLanguages([]);
    setSelectedSpecs([]);
    setSelectedDate('all');
    setSortBy('rating');
    setActiveQuickFilter('all');
  };

  const hasActiveFilters = selectedLanguages.length > 0 || selectedSpecs.length > 0 || 
    selectedDate !== 'all';

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
                    placeholder="Search by name, language, or specialty..."
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
          <div className="browse-hero__stats">
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
          </div>
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
              {/* Sort Dropdown */}
              <div className="browse-sort">
                <label className="browse-sort__label">Sort by:</label>
                <select 
                  className="browse-sort__select"
                  value={sortBy}
                  onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as any)}
                >
                  <option value="rating">Top Rated</option>
                  <option value="popular">Most Popular</option>
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
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

              {/* Languages */}
              {availableLanguages.length > 0 && (
                <div className="browse-filter-group">
                  <h4 className="browse-filter-group__title">Languages</h4>
                  <div className="browse-filter-group__list">
                    {availableLanguages.map(lang => (
                      <label key={lang} className="browse-filter-checkbox">
                        <input 
                          type="checkbox" 
                          checked={selectedLanguages.includes(lang)}
                          onChange={() => toggleLanguage(lang)}
                        />
                        <span className="browse-filter-checkbox__mark"></span>
                        <span className="browse-filter-checkbox__label">{lang}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
                    {selectedLanguages.map(lang => (
                      <span key={lang} className="browse-active-filter">
                        {lang}
                        <button onClick={() => toggleLanguage(lang)}>
                          <i className="ri-close-line"></i>
                        </button>
                      </span>
                    ))}
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
                      <TutorCard key={tutor.userId} tutor={tutor} />
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
    </>
  );
};
