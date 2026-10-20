import { ErrorBoundary as Boundary, type ParentProps } from 'solid-js';
export default function ErrorBoundary(props: ParentProps) {
    return <Boundary fallback={(_error, reset) => <div role="alert" style={{ padding: '40px', 'text-align': 'center' }}>
    <img src="/assets/img/home-icons/issue-v1.webp" width="64" height="64" alt=""/>
    <h2>Something went wrong</h2><p>Please try again or refresh the page.</p>
    <button type="button" onClick={reset}>Try again</button>
  </div>}>{props.children}</Boundary>;
}
