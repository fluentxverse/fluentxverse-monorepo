import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const reports = [];
for (const app of ['student', 'tutor']) {
    const dist = path.join(root, `fluentxverse-${app}-solid-prototype/dist`);
    const manifest = JSON.parse(await readFile(path.join(dist, '.vite/manifest.json'), 'utf8'));
    const boot = new Set();
    const visit = key => {
        if (boot.has(key)) return;
        if (!manifest[key]) throw new Error(`Missing ${app} manifest entry: ${key}`);
        boot.add(key);
        for (const imported of manifest[key].imports || []) visit(imported);
    };
    for (const [key, chunk] of Object.entries(manifest)) if (chunk.isEntry) visit(key);
    // Student's tiny launcher always imports App; that dependency is not optional.
    if (manifest['student/App.tsx']) visit('student/App.tsx');
    let bytes = 0, gzip = 0;
    for (const key of boot) {
        const data = await readFile(path.join(dist, manifest[key].file));
        bytes += data.length; gzip += gzipSync(data).length;
        if (/pages\/(ClassroomPage|SpeakingExamPage|ExamPage|ConversationalSkillsLessonPage|BusinessEnglishPreviewPage)|pdf\.worker|lessonPass\.worker|anonymousReview\.worker/.test(key))
            throw new Error(`${app}: heavy route entered the startup graph: ${key}`);
    }
    if (bytes > 400000 || gzip > 135000) throw new Error(`${app}: startup budget exceeded (${bytes} bytes / ${gzip} gzip)`);
    const classroom = manifest[`${app}/pages/ClassroomPage.tsx`];
    if (!classroom?.isDynamicEntry) throw new Error(`${app}: classroom must remain an on-demand route`);
    reports.push({ app, startupBytes: bytes, startupGzipBytes: gzip, files: [...boot].map(key => manifest[key].file), classroomBytes: (await stat(path.join(dist, classroom.file))).size });
    console.log(`PASS ${app} startup: ${(bytes / 1024).toFixed(1)} KiB raw, ${(gzip / 1024).toFixed(1)} KiB gzip; heavy routes excluded`);
}
await mkdir(path.join(root, 'output/release'), { recursive: true });
await writeFile(path.join(root, 'output/release/bundle-budgets.json'), JSON.stringify(reports, null, 2));
