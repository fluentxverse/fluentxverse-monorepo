import { Component, ComponentChildren } from 'preact';

interface ErrorBoundaryProps {
  children: ComponentChildren;
  fallback?: ComponentChildren;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child component tree
 * and display a fallback UI instead of crashing the whole app.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    
    // In production, you could send this to an error reporting service
    // e.g., Sentry, LogRocket, etc.
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary-fallback">
          <style>{`
            .error-boundary-fallback {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              padding: 2rem;
              text-align: center;
              background: #fef2f2;
              border-radius: 12px;
              margin: 1rem;
            }
            .error-boundary-fallback h2 {
              color: #dc2626;
              margin-bottom: 1rem;
              font-size: 1.5rem;
            }
            .error-boundary-fallback p {
              color: #6b7280;
              margin-bottom: 1.5rem;
              max-width: 400px;
            }
            .error-boundary-fallback button {
              background: linear-gradient(135deg, #0245ae 0%, #4a9eff 100%);
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.2s, box-shadow 0.2s;
            }
            .error-boundary-fallback button:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(2, 69, 174, 0.3);
            }
            .error-boundary-fallback .error-details {
              margin-top: 1rem;
              padding: 1rem;
              background: #fee2e2;
              border-radius: 8px;
              font-family: monospace;
              font-size: 0.875rem;
              color: #991b1b;
              max-width: 100%;
              overflow-x: auto;
            }
          `}</style>
          <h2>Something went wrong</h2>
          <p>
            We're sorry, but something unexpected happened. Please try again or refresh the page.
          </p>
          <button onClick={this.handleRetry}>
            Try Again
          </button>
          {import.meta.env.DEV && this.state.error && (
            <div className="error-details">
              {this.state.error.message}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
