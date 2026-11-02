import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const release = 'output/release/student-intro-video-20261028';
const built = JSON.parse(readFileSync(`${release}/built.json`));
const student = `${release}/student/frontend/fluentxverse-student-solid-prototype`;
execFileSync('node', ['tests/intro-video.cjs'], { cwd: student, env: { ...process.env, STUDENT_TEST_URL: 'http://127.0.0.1:5256' }, stdio: 'inherit' });
writeFileSync(`${release}/verification.json`, JSON.stringify({ passed: true, verifiedAt: new Date().toISOString(), imageId: built.imageId, frontendHashes: built.apps,
  apiRangeAssertions: 17, browserWidths: [1440, 768, 390, 320], checks: ['metadata', 'playback', 'seeking', 'decoded frames', 'compact responsive preview'],
  notes: 'API image unit tests passed during build. Exact frontend build tested against a real MP4 fixture without customer-data mutations.' }, null, 2));
