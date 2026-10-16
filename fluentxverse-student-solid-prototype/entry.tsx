import { render } from 'solid-js/web';

if (import.meta.env.DEV && location.pathname.replace(/\/$/, '') === '/compatibility') {
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) link.disabled = true;
  await import('./src/main');
} else {
  const { default: App } = await import('./student/App');
  render(() => <App />, document.getElementById('app')!);
}
