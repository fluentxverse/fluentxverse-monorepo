import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { appArtwork, appArtworkSrc } from '../../shared/appArtwork';

test('both apps ship identical artwork with distinct semantic filenames', () => {
  expect(new Set(Object.values(appArtwork)).size).toBe(Object.keys(appArtwork).length);
  for (const [name, filename] of Object.entries(appArtwork)) {
    const student = readFileSync(new URL(`../../fluentxverse-student-solid-prototype/public/assets/img/home-icons/${filename}`, import.meta.url));
    const tutor = readFileSync(new URL(`../public/assets/img/home-icons/${filename}`, import.meta.url));
    expect(student.equals(tutor)).toBe(true);
    expect(appArtworkSrc(name as keyof typeof appArtwork)).toBe(`/assets/img/home-icons/${filename}`);
    expect(student.length).toBeGreaterThan(1000);
    if (!['home', 'schedule', 'training', 'community', 'growth', 'pay', 'dispatch'].includes(name))
      expect(student.length).toBeLessThan(30000);
  }
});

test('notifications, messages, issues and legal headings keep their semantic artwork', () => {
  for (const [file, expected] of [
    ['../tutor/pages/NotificationsPage.tsx', 'name="notifications"'],
    ['../tutor/pages/InboxPage.tsx', 'name="inbox"'],
    ['../tutor/pages/BusinessEnglishPage.tsx', 'name="business"'],
    ['../tutor/Components/TutorLessonIssueReportDialog.tsx', 'name="issue"'],
    ['../../fluentxverse-student-solid-prototype/student/Components/Header/LessonNotifications.tsx', 'notifications-v1.webp'],
    ['../../fluentxverse-student-solid-prototype/student/Components/StudentLessonIssueReport.tsx', 'issue-v1.webp'],
    ['../../fluentxverse-student-solid-prototype/student/Components/Common/LegalDocument.tsx', 'privacy-v1.webp'],
  ]) expect(readFileSync(new URL(file!, import.meta.url), 'utf8')).toContain(expected!);
});
