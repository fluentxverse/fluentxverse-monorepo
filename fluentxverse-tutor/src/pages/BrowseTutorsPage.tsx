import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { tutorApi } from '../../api/tutor.api';
import { TutorCard } from '../../Components/Tutors/TutorCard';
import type { Tutor, TutorSearchParams } from '../../types/tutor.types';
import './BrowseTutorsPage.css';

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
  const [minRating, setMinRating] = useState<number>(0);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [sortBy, setSortBy] = useState<'rating' | 'price-low' | 'price-high' | 'popular' | 'newest'>('rating');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Filter options
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [availableSpecs, setAvailableSpecs] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

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
  const searchTutors = async (resetPage = false) => {
    try {
      setLoading(true);
      setError(null);

      const params: TutorSearchParams = {
        query: searchQuery || undefined,
        languages: selectedLanguages.length > 0 ? selectedLanguages : undefined,
        specializations: selectedSpecs.length > 0 ? selectedSpecs : undefined,
        minRating: minRating > 0 ? minRating : undefined,
        minHourlyRate: priceRange[0] > 0 ? priceRange[0] : undefined,
        maxHourlyRate: priceRange[1] < 10000 ? priceRange[1] : undefined,
        isAvailable: showAvailableOnly || undefined,
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
  };

  // Initial load and when filters change
  useEffect(() => {
    searchTutors(true);
  }, [selectedLanguages, selectedSpecs, minRating, priceRange, sortBy, showAvailableOnly]);

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

  // Toggle filter checkbox
  const toggleFilter = (
    value: string, 
    selected: string[], 
    setter: (val: string[]) => void
  ) => {
    if (selected.includes(value)) {
      setter(selected.filter(v => v !== value));
    } else {
      setter([...selected, value]);
    }
  };

  return (
    <div className="browse-tutors-page">
      {/* Hero Section */}
      <section className="browse-tutors__hero">
        <div className="container">
          <h1 className="browse-tutors__title">Find Your Perfect Tutor</h1>
          <p className="browse-tutors__subtitle">
            Connect with experienced tutors and start learning today
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="browse-tutors__search-form">
            <div className="browse-tutors__search-wrapper">
              <i className="ri-search-line browse-tutors__search-icon"></i>
              <input
                type="text"
                className="browse-tutors__search-input"
                placeholder="Search by name, specialization, or language..."
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
            </div>
            <button type="submit" className="browse-tutors__search-button">
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="container">
        <div className="browse-tutors__content">
          {/* Filters Sidebar */}
          <aside className={`browse-tutors__sidebar ${showFilters ? 'browse-tutors__sidebar--open' : ''}`}>
            <div className="browse-tutors__sidebar-header">
              <h3>Filters</h3>
              <button
                className="browse-tutors__filter-close"
                onClick={() => setShowFilters(false)}
              >
                <i className="ri-close-line"></i>
              </button>
            </div>

            {/* Sort By */}
            <div className="browse-tutors__filter-section">
              <h4 className="browse-tutors__filter-title">Sort By</h4>
              <select
                className="browse-tutors__sort-select"
                value={sortBy}
                onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as any)}
              >
                <option value="rating">Highest Rated</option>
                <option value="popular">Most Popular</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="newest">Newest First</option>
              </select>
            </div>

            {/* Availability */}
            <div className="browse-tutors__filter-section">
              <label className="browse-tutors__checkbox-label">
                <input
                  type="checkbox"
                  checked={showAvailableOnly}
                  onChange={(e) => setShowAvailableOnly((e.target as HTMLInputElement).checked)}
                />
                <span>Available Now</span>
              </label>
            </div>

            {/* Rating Filter */}
            <div className="browse-tutors__filter-section">
              <h4 className="browse-tutors__filter-title">Minimum Rating</h4>
              <div className="browse-tutors__rating-options">
                {[4.5, 4.0, 3.5, 0].map(rating => (
                  <label key={rating} className="browse-tutors__radio-label">
                    <input
                      type="radio"
                      name="rating"
                      checked={minRating === rating}
                      onChange={() => setMinRating(rating)}
                    />
                    <span>
                      {rating > 0 ? (
                        <>
                          {rating} <i className="ri-star-fill"></i> & up
                        </>
                      ) : (
                        'All Ratings'
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="browse-tutors__filter-section">
              <h4 className="browse-tutors__filter-title">
                Price Range: ₱{priceRange[0]} - ₱{priceRange[1]}
              </h4>
              <div className="browse-tutors__price-inputs">
                <input
                  type="number"
                  className="browse-tutors__price-input"
                  placeholder="Min"
                  value={priceRange[0]}
                  onChange={(e) => setPriceRange([Number((e.target as HTMLInputElement).value), priceRange[1]])}
                />
                <span>to</span>
                <input
                  type="number"
                  className="browse-tutors__price-input"
                  placeholder="Max"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], Number((e.target as HTMLInputElement).value)])}
                />
              </div>
            </div>

            {/* Languages */}
            {availableLanguages.length > 0 && (
              <div className="browse-tutors__filter-section">
                <h4 className="browse-tutors__filter-title">Languages</h4>
                <div className="browse-tutors__checkbox-list">
                  {availableLanguages.slice(0, 5).map(lang => (
                    <label key={lang} className="browse-tutors__checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedLanguages.includes(lang)}
                        onChange={() => toggleFilter(lang, selectedLanguages, setSelectedLanguages)}
                      />
                      <span>{lang}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Specializations */}
            {availableSpecs.length > 0 && (
              <div className="browse-tutors__filter-section">
                <h4 className="browse-tutors__filter-title">Specializations</h4>
                <div className="browse-tutors__checkbox-list">
                  {availableSpecs.slice(0, 5).map(spec => (
                    <label key={spec} className="browse-tutors__checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedSpecs.includes(spec)}
                        onChange={() => toggleFilter(spec, selectedSpecs, setSelectedSpecs)}
                      />
                      <span>{spec}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Main Content */}
          <main className="browse-tutors__main">
            {/* Results Header */}
            <div className="browse-tutors__results-header">
              <p className="browse-tutors__results-count">
                {loading && page === 1 ? (
                  'Searching...'
                ) : (
                  `${total} tutor${total !== 1 ? 's' : ''} found`
                )}
              </p>

              <button
                className="browse-tutors__filter-toggle"
                onClick={() => setShowFilters(!showFilters)}
              >
                <i className="ri-filter-line"></i>
                Filters
              </button>
            </div>

            {/* Error State */}
            {error && (
              <div className="browse-tutors__error">
                <i className="ri-error-warning-line"></i>
                <p>{error}</p>
              </div>
            )}

            {/* Tutors Grid */}
            {!error && (
              <>
                <div className="browse-tutors__grid">
                  {tutors.map(tutor => (
                    <TutorCard key={tutor.userId} tutor={tutor} />
                  ))}
                </div>

                {/* Empty State */}
                {!loading && tutors.length === 0 && (
                  <div className="browse-tutors__empty">
                    <i className="ri-user-search-line"></i>
                    <h3>No tutors found</h3>
                    <p>Try adjusting your filters or search query</p>
                  </div>
                )}

                {/* Load More */}
                {hasMore && !loading && (
                  <div className="browse-tutors__load-more">
                    <button
                      className="browse-tutors__load-more-button"
                      onClick={handleLoadMore}
                    >
                      Load More
                    </button>
                  </div>
                )}

                {/* Loading State */}
                {loading && (
                  <div className="browse-tutors__loading">
                    <div className="spinner"></div>
                    <p>Loading tutors...</p>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
