import { JSX } from 'preact';
import './LoadingSpinner.css';

export const LoadingSpinner = (): JSX.Element => {
  return (
    <div className="fxv-spinner-wrapper" aria-label="Loading">
      <div className="fxv-spinner" />
    </div>
  );
};

export default LoadingSpinner;