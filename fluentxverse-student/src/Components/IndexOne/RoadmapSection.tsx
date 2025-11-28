import React from "react";
import "./RoadmapSection.css";
import { FaRocket, FaLeaf, FaNetworkWired, FaGlobe, FaUsers, FaChartLine } from 'react-icons/fa';

const RoadmapSection = () => {
  const roadmapItems = [
    {
      phase: "Phase 1",
      title: "Foundation & MVP",
      status: "current",
      icon: <FaRocket />,
      achievements: [
        "Release FluentXVerse mobile app",
        "Deploy environmental IoT sensors on 100 pilot farms",
        "Local cooperative and government partnerships",
        "Implement on-chain data tracking for soil and yield metrics",
        "Launch pilot projects in Bulacan and Camarines Sur, Philippines",
        "Collect baseline sustainability and productivity data"
      ]
    },
    {
      phase: "Phase 2",
      title: "Pilot Expansion",
      status: "upcoming",
      icon: <FaLeaf />,
      achievements: [
        "Begin decentralized soil & plant genome mapping pilot",
        "Tokenize 10,000 trees (including nut, mango, banana, cacao)",
        "Tokenized identity system for farmers",
        "Deploy educational programs in 5+ municipalities",
        "Collect baseline sustainability and productivity data"
      ]
    },
    {
      phase: "Phase 3",
      title: "Smart Farming Platform",
      status: "upcoming",
      icon: <FaNetworkWired />,
      achievements: [
        "Award 1,000+ farmer grants via DAO-led funding pools",
        "Launch an AI + LLM platform for full-cycle autonomous smart farming",
        "Standardize FluentXVerse protocols with ISO / FAO-compliant formats",
        "Launch Farmer to Consumer farm produce marketplace"
      ]
    },
    {
      phase: "Phase 4",
      title: "Global Expansion",
      status: "upcoming",
      icon: <FaGlobe />,
      achievements: [
        "Advocate for blockchain agriculture policies in 10+ countries",
        "Launch open-source genome + biotech data",
        "Tokenize 100 million hectares of land & trees",
        "Reach 100,000+ smallholder farmers globally",
        "Integrate with UN SDG metrics and carbon markets at scale"
      ]
    },
    {
      phase: "Phase 5",
      title: "Climate Resilience",
      status: "future",
      icon: <FaUsers />,
      achievements: [
        "Expand to arid and disaster-prone regions using AI for crop adaptation",
        "Introduce satellite data integrations for macro-level insights",
        "Begin carbon marketplace integration",
        "Enable regenerative farming incentives directly via smart contracts"
      ]
    }
  ];

  return (
    <section className="roadmap-section">
      <div className="roadmap-background">
        <div className="roadmap-floating-element element-1"></div>
        <div className="roadmap-floating-element element-2"></div>
        <div className="roadmap-floating-element element-3"></div>
      </div>
      
      <div className="roadmap-container">
        <div className="roadmap-header">
          <div className="roadmap-badge">
            <FaChartLine />
            DEVELOPMENT ROADMAP
          </div>
          <h2 className="roadmap-title">
            Our Journey to <span className="roadmap-gradient-text">Transform Agriculture</span>
          </h2>
          <p className="roadmap-description">
            From concept to global impact, here's how we're building the future of decentralized agriculture, 
            one milestone at a time.
          </p>
        </div>

        <div className="roadmap-timeline">
          <div className="roadmap-line"></div>
          {roadmapItems.map((item, index) => (
            <div 
              key={index} 
              className={`roadmap-item ${item.status}`}
              style={{ '--delay': `${index * 0.2}s` } as React.CSSProperties}
            >
              <div className="roadmap-connector">
                <div className="roadmap-dot">
                  <div className="roadmap-icon">
                    {item.icon}
                  </div>
                </div>
              </div>
              
              <div className="roadmap-content">
                <div className="roadmap-card">
                  <div className="roadmap-card-header">
                    <div className="roadmap-phase-badge">{item.phase}</div>
                    <div className={`roadmap-status-badge ${item.status}`}>
                      {item.status === 'completed' && '✓ Completed'}
                      {item.status === 'current' && ' In Progress'}
                      {item.status === 'upcoming' && ' Planned'}
                      {item.status === 'future' && ' Future'}
                    </div>
                  </div>
                  
                  <h3 className="roadmap-card-title">{item.title}</h3>
                  
                  <div className="roadmap-achievements">
                    {item.achievements.map((achievement, achievementIndex) => (
                      <div key={achievementIndex} className="roadmap-achievement">
                        <div className="roadmap-achievement-icon">
                          {item.status === 'completed' ? '✓' : '•'}
                        </div>
                        <span>{achievement}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="roadmap-cta">
          <div className="roadmap-cta-card">
            <h3>Join Our Journey</h3>
            <p>Be part of the agricultural revolution. Connect with us to learn how you can contribute to building a sustainable future.</p>
            <div className="roadmap-cta-buttons">
              <a href="/contact" className="roadmap-primary-btn">
                <span>Get Involved</span>
                <div className="roadmap-btn-glow"></div>
              </a>
              <a href="/assets/whitepaper/whitepaper.pdf" target="_blank" rel="noopener noreferrer" className="roadmap-secondary-btn">
                <span>Read Whitepaper</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RoadmapSection;
