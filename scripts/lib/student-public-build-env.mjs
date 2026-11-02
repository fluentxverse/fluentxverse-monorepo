import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { join } from 'node:path';

export function studentPublicBuildEnv(root) {
  const env = parseEnv(readFileSync(join(root, 'fluentxverse-student-solid-prototype/.env.production'), 'utf8'));
  const appId = env.VITE_PRIVY_APP_ID?.trim();
  if (!appId) throw new Error('Missing public student social sign-in app ID');
  // Never pass server credentials or unrelated environment settings into Vite.
  return { VITE_PRIVY_APP_ID: appId };
}
