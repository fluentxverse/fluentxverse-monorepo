import React from "react";
import "./TokenizationSection.css";
import { FaTree, FaCoins, FaMapMarkedAlt } from 'react-icons/fa';

const TokenizationSection = () => {
  const features = [
    {
      icon: <FaTree />,
      title: "Tree NFTs (ERC-1155)",
      description: "Unique digital assets representing verified trees with immutable ownership records and transparent history.",
      badge: "NFT",
      link: "/tree-nfts",
      clickable: true
    },
    {
      icon: <FaCoins />,
      title: "Yield Tokens (ERC-20)",
      description: "Fungible tokens representing agricultural yield, tradable on DEX platforms.",
      badge: "TOKEN",
      link: "/tree-nfts",
      clickable: true
    },
    {
      icon: <FaMapMarkedAlt />,
      title: "Field Plot Tokenization",
      description: "Coming soon: Tokenize field plots to represent land yield ownership.",
      badge: "SOON",
      clickable: false
    }
  ];

  const handleCardClick = (feature: any) => {
    if (feature.clickable && feature.link) {
      window.location.href = feature.link;
    }
  };

  return (
    <section className="tokenization-section">
      <div className="tokenization-container">
        <div className="tokenization-header">

          <h2 className="tokenization-title">
            Transform Agriculture with <span className="tokenization-green">Asset Tokenization</span>
          </h2>
          <p className="tokenization-subtitle">
            Revolutionize farming through blockchain technology, creating liquid, tradable assets from agricultural resources
          </p>
        </div>
        
        <div className="tokenization-grid">
          {features.map((feature, index) => (
            <div 
              className={`tokenization-card ${feature.clickable ? 'clickable' : ''}`} 
              key={index}
              onClick={() => handleCardClick(feature)}
              style={{ cursor: feature.clickable ? 'pointer' : 'default' }}
            >
              <div className="tokenization-card-header">
                <div className="tokenization-card-badge">{feature.badge}</div>
                <div className="tokenization-card-icon">
                  {feature.icon}
                </div>
              </div>
              <div className="tokenization-card-content">
                <h3 className="tokenization-card-title">{feature.title}</h3>
                <p className="tokenization-card-desc">{feature.description}</p>
                {feature.clickable && (
                  <div className="tokenization-card-action">
                    <span className="tokenization-learn-more">Learn More →</span>
                  </div>
                )}
              </div>
              <div className="tokenization-card-glow"></div>
            </div>
          ))}
        </div>

        <div className="tokenization-stats">
          <div className="tokenization-stat">
            <div className="tokenization-stat-number">$1.67B</div>
            <div className="tokenization-stat-label">Projected Market Size by 2032</div>
          </div>
          <div className="tokenization-stat">
            <div className="tokenization-stat-number">12.9%</div>
            <div className="tokenization-stat-label">Annual Growth Rate (CAGR)</div>
          </div>
          <div className="tokenization-stat">
            <div className="tokenization-stat-number">RWA</div>
            <div className="tokenization-stat-label">Real World Assets</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TokenizationSection;
