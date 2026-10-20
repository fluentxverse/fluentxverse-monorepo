import { ErrorBoundary as Boundary, type ParentProps } from 'solid-js';
import { RotateCcw } from 'lucide-solid';
import './ErrorBoundary.css';
export default function ErrorBoundary(props: ParentProps) {
  return <Boundary fallback={(_error, reset) => <div class="error-boundary-fallback" role="alert">
    <img src="/assets/img/home-icons/issue-v1.webp" alt="" width="64" height="64" />
    <h2>Something went wrong</h2><p>Please try again or refresh the page.</p>
    <button type="button" onClick={reset}><RotateCcw size={17} />Try again</button>
  </div>}>{props.children}</Boundary>;
}
