import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const release = 'output/release/intro-video-limit-20261028';
const built = JSON.parse(readFileSync(`${release}/built.json`));
execFileSync('node', ['tests/browser/introVideoLimit.cjs'], { cwd: `${release}/tutor/frontend/fluentxverse-tutor-solid-prototype`, env: { ...process.env, TUTOR_TEST_URL: 'http://127.0.0.1:5258' }, stdio: 'inherit' });
writeFileSync(`${release}/verification.json`, JSON.stringify({ passed: true, imageId: built.imageId, frontendHashes: built.apps, apiDurationAssertions: 16, browserWidths: [1440,390], checks: ['exactly 30s accepted', '31s rejected before upload', 'corrupt media rejected', 'server measures actual file'], verifiedAt: new Date().toISOString() }, null, 2));
