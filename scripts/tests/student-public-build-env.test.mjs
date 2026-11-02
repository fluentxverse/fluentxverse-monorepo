import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { studentPublicBuildEnv } from '../lib/student-public-build-env.mjs';

test('student release passes only the public social app ID and rejects missing configuration', () => {
  const root = mkdtempSync(join(tmpdir(), 'student-public-env-'));
  const directory = join(root, 'fluentxverse-student-solid-prototype');
  mkdirSync(directory);
  try {
    writeFileSync(join(directory, '.env.production'), 'VITE_PRIVY_APP_ID="public-test-id"\nPRIVY_APP_SECRET=must-not-export\nVITE_ENABLE_TICKETING=true\n');
    assert.deepEqual(studentPublicBuildEnv(root), { VITE_PRIVY_APP_ID: 'public-test-id' });
    writeFileSync(join(directory, '.env.production'), 'VITE_PRIVY_APP_ID=\n');
    assert.throws(() => studentPublicBuildEnv(root), /Missing public/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
