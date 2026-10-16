export function isPrivyOriginAllowed(domains: string[], origin: string): boolean | undefined {
  if (!domains.length || domains.includes('*')) return true;
  const normalized = origin.replace(/\/$/, '');
  if (domains.some(domain => domain.replace(/\/$/, '') === normalized)) return true;
  // Let Privy's SDK decide wildcard policies rather than making an optimistic guess.
  if (domains.some(domain => domain.includes('*'))) return undefined;
  return false;
}

export function originError(origin: string): Error {
  return Object.assign(new Error(`Privy has not approved ${origin}. Add this exact origin under Configuration > App settings > Domains in the Privy dashboard, then check configuration again.`), { code: 'invalid_origin' });
}
