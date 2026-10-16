import { expect, test } from 'bun:test';
import { mediaUrl } from '../src/utils/mediaUrl';

test('legacy profile images and videos are proxied through the public API', () => {
  const base = 'https://api.fluentxverse.xyz';
  for (const host of ['fluentxverse-seaweed-filer:8888', 'seaweed-filer:8888', 'localhost:8888', '127.0.0.1:8888']) {
    expect(mediaUrl(`http://${host}/user/tutor/profile/photo.png?t=123`, base)).toBe(`${base}/lesson/files/user/tutor/profile/photo.png?t=123`);
    expect(mediaUrl(`http://${host}/user/tutor/video/intro.mp4`, base)).toBe(`${base}/lesson/files/user/tutor/video/intro.mp4`);
  }
  expect(mediaUrl('/user/tutor/profile/photo.png', base)).toBe(`${base}/lesson/files/user/tutor/profile/photo.png`);
});

test('public media, app assets and local previews remain unchanged', () => {
  for (const value of ['https://cdn.example.com/photo.png', '/assets/avatar.png', 'blob:https://student.fluentxverse.xyz/preview', 'data:image/png;base64,AA==']) expect(mediaUrl(value)).toBe(value);
  expect(mediaUrl(null)).toBeUndefined();
  expect(mediaUrl('')).toBeUndefined();
});

test('owned profile media follows the current API domain without rewriting external hosts', () => {
  const base = 'https://api.fluentxverse.com';
  expect(mediaUrl('https://api.fluentxverse.xyz/lesson/files/user/tutor/profile/photo.png?t=123#photo', base)).toBe(`${base}/lesson/files/user/tutor/profile/photo.png?t=123#photo`);
  expect(mediaUrl('https://api.fluentxverse.xyz/user/tutor/video/intro.mp4', base)).toBe(`${base}/lesson/files/user/tutor/video/intro.mp4`);
  for (const value of ['https://api.fluentxverse.xyz.evil.test/lesson/files/user/photo.png', 'https://api.fluentxverse.xyz/lessons/test.png', 'https://api.fluentxverse.xyz:8443/lesson/files/user/photo.png']) expect(mediaUrl(value, base)).toBe(value);
});
