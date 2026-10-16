import { readFile, mkdir, writeFile } from 'node:fs/promises';

const source = new URL('../../fluentxverse-server/src/shared/anonymousReviews.ts', import.meta.url);
const target = new URL('../student/shared/anonymousReviews.ts', import.meta.url);
const header = '// Generated from fluentxverse-server/src/shared/anonymousReviews.ts.\n';
let content;
try { content = await readFile(source, 'utf8'); }
catch (error) {
  // Standalone frontend Docker builds use the committed generated copy.
  if (error.code !== 'ENOENT') throw error;
  await readFile(target, 'utf8'); process.exit(0);
}
const generated = header + content;
if (await readFile(target, 'utf8').catch(() => '') !== generated) {
  await mkdir(new URL('../student/shared/', import.meta.url), { recursive: true });
  await writeFile(target, generated);
}
