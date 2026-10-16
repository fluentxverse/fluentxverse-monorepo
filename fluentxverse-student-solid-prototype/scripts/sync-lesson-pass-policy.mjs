import { readFile, mkdir, writeFile } from 'node:fs/promises';
const source = new URL('../../fluentxverse-server/src/shared/lessonPasses.ts', import.meta.url);
const target = new URL('../student/shared/lessonPasses.ts', import.meta.url);
let content;
try { content = await readFile(source, 'utf8'); }
catch (error) { if (error.code !== 'ENOENT') throw error; await readFile(target, 'utf8'); process.exit(0); }
const generated = '// Generated from fluentxverse-server/src/shared/lessonPasses.ts.\n' + content;
if (await readFile(target, 'utf8').catch(() => '') !== generated) {
  await mkdir(new URL('../student/shared/', import.meta.url), { recursive: true }); await writeFile(target, generated);
}
