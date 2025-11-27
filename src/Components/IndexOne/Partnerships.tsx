import React, { useEffect, useState } from 'react';
import './Partnerships.css';

const Partnerships = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleMafcClick = () => {
    window.open('https://www.facebook.com/people/MAFC-San-Jose-Partido/61553669726982/', '_blank');
  };

  return (
    <section className={`partnerships-section ${isVisible ? 'visible' : ''}`}>
      <div className="partnerships-inner">
        <div className="section-header">
          <h2 className="section-title">
            <span>Integration</span>
            <span className="text-accent">Partners</span>
          </h2>
          <p className="section-subtitle">
            Collaborating with industry leaders to drive agricultural innovation
          </p>
        </div>

        <div className="partners-grid">
          <div className="partner-item" onClick={handleMafcClick}>
            <div className="partner-logo-container">
              <img
                src="/assets/img/partners/mafc-logo.png"
                alt="Municipal Agricultural and Fishery Council"
                className="partner-logo"
                loading="lazy"
              />
            </div>
            <div className="partner-details">
              <h3 className="partner-name">Municipal Agricultural and Fishery Council</h3>
              <p className="partner-location">San Jose, Camarines Sur</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Partnerships;
