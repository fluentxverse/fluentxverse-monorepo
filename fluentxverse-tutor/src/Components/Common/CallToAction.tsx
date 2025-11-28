import React from 'react';

import { Link } from 'wouter';
import './CallToAction.css';

interface CallToActionProps {
  title?: string;
  subtitle?: string;
  primaryButtonText?: string;
  primaryButtonLink?: string;
  secondaryButtonText?: string;
  secondaryButtonLink?: string;
  className?: string;
}

const CallToAction: React.FC<CallToActionProps> = ({
  title = "Ready to Transform Your Farming Experience?",
  subtitle = "Join hundreds of farmers already benefiting from our innovative solutions",
  primaryButtonText = "Get in Touch",
  primaryButtonLink = "/contact",
  secondaryButtonText,
  secondaryButtonLink,
  className = ""
}) => {
  return (
    <section className={`cta-section ${className}`}>
      <div className="container">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
        <div className="cta-buttons">
          <Link to={primaryButtonLink} className="btn btn-primary">
            {primaryButtonText}
          </Link>
          {secondaryButtonText && secondaryButtonLink && (
            <Link to={secondaryButtonLink} className="btn btn-outline">
              {secondaryButtonText}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
