import { FunctionComponent } from 'preact';
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

const CallToAction: FunctionComponent<CallToActionProps> = ({
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
          <a href={primaryButtonLink} className="btn btn-primary">
            {primaryButtonText}
          </a>
          {secondaryButtonText && secondaryButtonLink && (
            <a href={secondaryButtonLink} className="btn btn-outline">
              {secondaryButtonText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
