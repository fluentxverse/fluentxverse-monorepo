import React from "react";
import "./NarrativeSection.css";
import { FaRocket, FaMobile, FaShieldAlt } from 'react-icons/fa';

const NarrativeSection = () => (
  <section className="narrative-section">
    <div className="narrative-background">
      <div className="narrative-floating-element element-1"></div>
      <div className="narrative-floating-element element-2"></div>
      <div className="narrative-floating-element element-3"></div>
    </div>
    
    <div className="narrative-content">
      <div className="narrative-text-panel">
        <div className="narrative-badge">

          BUILDING THE FUTURE OF AGRICULTURE
        </div>
        <h2 className="narrative-title">
          The future of agriculture is <span className="narrative-gradient-text">real-time, AI-driven, and on-chain.</span>
        </h2>
        <p className="narrative-description">
          FluentXVerse is building a new layer of intelligence for farms. Our sensors gather field data continuously. AI interprets it instantly. And our platform ensures every insight is verifiable and globally accessible.
        </p>
        
        <div className="narrative-features">
          <div className="narrative-feature-item">
            <div className="narrative-feature-icon">
              <FaMobile />
            </div>
            <span>Mobile-First Platform</span>
          </div>
          <div className="narrative-feature-item">
            <div className="narrative-feature-icon">
              <FaShieldAlt />
            </div>
            <span>Blockchain Security</span>
          </div>
        </div>
        
        <a href="/assets/whitepaper.pdf" target="_blank" rel="noopener noreferrer" className="narrative-cta-button">
          <span>Explore Our Vision</span>
          <div className="narrative-button-glow"></div>
        </a>
      </div>
      
      <div className="narrative-visual-panel">
        <div className="narrative-image-container">
          <div className="narrative-image-backdrop"></div>
          <img
            src="/assets/img/banner/hero1.png"
            alt="Decentragri AI Farm"
            className="narrative-image"
            loading="lazy"
          />
          <div className="narrative-image-glow"></div>
        </div>
        
        <div className="narrative-tech-indicators">
          <div className="narrative-tech-item">
            <div className="narrative-tech-pulse"></div>
            <span>AI Processing</span>
          </div>
          <div className="narrative-tech-item">
            <div className="narrative-tech-pulse"></div>
            <span>Real-time Data</span>
          </div>
          <div className="narrative-tech-item">
            <div className="narrative-tech-pulse"></div>
            <span>Blockchain Sync</span>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default NarrativeSection;
