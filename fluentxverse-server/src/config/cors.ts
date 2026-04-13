const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  'http://192.168.0.102:5173',
  'http://192.168.0.102:5174',
  'http://192.168.0.102:5175',
  'https://fluentxverse.xyz',
  'https://student.fluentxverse.xyz',
  'https://tutor.fluentxverse.xyz',
  'https://dashboard.fluentxverse.xyz',
];

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '');

const parseHostname = (value: string): string | null => {
  const normalized = normalizeOrigin(value);
  if (!normalized) return null;

  try {
    return new URL(normalized).hostname;
  } catch {
    try {
      return new URL(`https://${normalized}`).hostname;
    } catch {
      return null;
    }
  }
};

export const getAllowedOrigins = (
  envValue = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || ''
) => {
  const envOrigins = envValue
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins].map(normalizeOrigin))];
};

export const isAllowedOrigin = (
  origin: string | null | undefined,
  allowedOrigins = getAllowedOrigins()
) => {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  const protocolVariants = new Set([
    normalizedOrigin,
    normalizedOrigin.replace(/^https:/i, 'http:'),
    normalizedOrigin.replace(/^http:/i, 'https:'),
  ]);

  if (allowedOrigins.some(allowedOrigin => protocolVariants.has(normalizeOrigin(allowedOrigin)))) {
    return true;
  }

  const originHostname = parseHostname(normalizedOrigin);
  if (!originHostname) {
    return false;
  }

  return allowedOrigins.some(allowedOrigin => parseHostname(allowedOrigin) === originHostname);
};

