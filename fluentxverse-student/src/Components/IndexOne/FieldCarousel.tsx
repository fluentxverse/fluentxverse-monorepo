import { useState, useEffect } from 'preact/hooks';
import { Link } from 'wouter';
import { FaMapMarkerAlt, FaLeaf, FaUsers, FaChartLine } from 'react-icons/fa';
import './FieldCarousel.css';

const FieldCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      id: 1,
      image: '/assets/img/banner/carousel_pics.jpg',
      title: 'Sustainable Rice Farming',
      description: 'Hardworking farmers carefully plant rice seedlings in lush, water-filled paddies, showcasing the traditional methods that sustain communities and feed nations.',
      location: 'Bicol Region, Philippines',
      stats: {
        area: '150 hectares',
        farmers: '450+ farmers',
        yield: '8.2 tons/ha'
      },
      tags: ['Organic', 'IoT Sensors', 'Climate Resilient']
    },
    {
      id: 2,
      image: '/assets/img/banner/carousel_pics2.jpg',
      title: 'Rice Seedbed Preparation',
      description: 'Nurturing the next generation of rice plants in carefully prepared seedbeds. These young seedlings will soon be transplanted to the fields.',
      location: 'Bulacan, Philippines',
      stats: {
        area: '85 hectares',
        farmers: '500+ farmers',
        yield: '7.8 tons/ha'
      },
      tags: ['Smart Irrigation', 'AI Monitoring', 'Sustainable']
    }
  ];

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <section className="field-carousel-section">
      <div className="field-carousel-background">
        <div className="field-floating-element element-1"></div>
        <div className="field-floating-element element-2"></div>
        <div className="field-floating-element element-3"></div>
      </div>
      
      <div className="field-carousel-container">
        <div className="field-section-header">
          <div className="field-badge">
            <FaLeaf />
            OUR SMART FARMS
          </div>
          <h2 className="field-section-title">
            Sustainable <span className="field-gradient-text">Agriculture</span> in Action
          </h2>
          <p className="field-section-description">
            Discover our network of technology-enhanced farms where tradition meets innovation, 
            creating sustainable solutions for the future of agriculture.
          </p>
        </div>
        
        <div className="field-carousel-wrapper">
          <div className="field-carousel">
            {slides.map((slide, index) => (
              <div 
                key={slide.id}
                className={`field-slide ${index === currentSlide ? 'active' : ''}`}
              >
                <div className="field-slide-image">
                  <img src={slide.image} alt={slide.title} />
                  <div className="field-slide-overlay"></div>
                </div>
                
                <div className="field-slide-content">
                  <div className="field-slide-info">
                    <div className="field-slide-header">
                      <div className="field-location">
                        <FaMapMarkerAlt />
                        <span>{slide.location}</span>
                      </div>
                      <div className="field-tags">
                        {slide.tags.map((tag, tagIndex) => (
                          <span key={tagIndex} className="field-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                    
                    <h3 className="field-slide-title">{slide.title}</h3>
                    <p className="field-slide-description">{slide.description}</p>
                    
                    <div className="field-stats">
                      <div className="field-stat">
                        <div className="field-stat-icon">
                          <FaLeaf />
                        </div>
                        <div className="field-stat-content">
                          <span className="field-stat-value">{slide.stats.area}</span>
                          <span className="field-stat-label">Farm Area</span>
                        </div>
                      </div>
                      <div className="field-stat">
                        <div className="field-stat-icon">
                          <FaUsers />
                        </div>
                        <div className="field-stat-content">
                          <span className="field-stat-value">{slide.stats.farmers}</span>
                          <span className="field-stat-label">Active Farmers</span>
                        </div>
                      </div>
                      <div className="field-stat">
                        <div className="field-stat-icon">
                          <FaChartLine />
                        </div>
                        <div className="field-stat-content">
                          <span className="field-stat-value">{slide.stats.yield}</span>
                          <span className="field-stat-label">Avg Yield</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <button className="field-carousel-control prev" onClick={prevSlide} aria-label="Previous slide">
            <i className="fas fa-chevron-left"></i>
          </button>
          <button className="field-carousel-control next" onClick={nextSlide} aria-label="Next slide">
            <i className="fas fa-chevron-right"></i>
          </button>
          
          <div className="field-carousel-indicators">
            {slides.map((_, index) => (
              <button
                key={index}
                className={`field-indicator ${index === currentSlide ? 'active' : ''}`}
                onClick={() => setCurrentSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
        
        <div className="field-cta-section">
          <div className="field-cta-card">
            <h3>Explore Our Farm Network</h3>
            <p>Join our growing community of tech-enabled farmers and discover how IoT sensors and AI are transforming agriculture.</p>
            <div className="field-cta-buttons">
              <Link href="/contact" className="field-primary-btn">
                <span>Join Our Network</span>
                <div className="field-btn-glow"></div>
              </Link>
              <Link href="/tree-nfts" className="field-secondary-btn">
                <span>View Tree NFTs</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FieldCarousel;
