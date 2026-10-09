export function materialFrameUrl(url: string, theme: 'light' | 'dark', origin: string): string {
  const parsed = new URL(url, origin);
  if (/^\/(business-english|conversational-skills)-preview\//.test(parsed.pathname)) {
    parsed.searchParams.set('theme', theme);
    return parsed.href;
  }
  return url;
}
