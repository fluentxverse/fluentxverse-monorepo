import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { getIceConfiguration } from '../src/socket/iceConfiguration';

describe('temporary TURN credentials', () => {
  test('returns STUN only when no relay is configured', () => {
    const previousUrls = process.env.TURN_URLS;
    const previousSecret = process.env.TURN_SHARED_SECRET;
    try {
      delete process.env.TURN_URLS;
      delete process.env.TURN_SHARED_SECRET;
      expect(getIceConfiguration('student-a').iceServers).toHaveLength(1);
    } finally {
      if (previousUrls === undefined) delete process.env.TURN_URLS;
      else process.env.TURN_URLS = previousUrls;
      if (previousSecret === undefined) delete process.env.TURN_SHARED_SECRET;
      else process.env.TURN_SHARED_SECRET = previousSecret;
    }
  });

  test('signs a short-lived credential for the authenticated user', () => {
    const previousUrls = process.env.TURN_URLS;
    const previousSecret = process.env.TURN_SHARED_SECRET;
    try {
      process.env.TURN_URLS = 'turn:relay.example:3478?transport=udp,turns:relay.example:443?transport=tcp';
      process.env.TURN_SHARED_SECRET = 'test-shared-secret';
      const relay = getIceConfiguration('student-a').iceServers[1];
      expect(relay?.urls).toEqual([
        'turn:relay.example:3478?transport=udp',
        'turns:relay.example:443?transport=tcp'
      ]);
      const username = relay?.username || '';
      expect(username.endsWith(':student-a')).toBe(true);
      expect(Number(username.split(':')[0])).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(relay?.credential).toBe(createHmac('sha1', 'test-shared-secret').update(username).digest('base64'));
    } finally {
      if (previousUrls === undefined) delete process.env.TURN_URLS;
      else process.env.TURN_URLS = previousUrls;
      if (previousSecret === undefined) delete process.env.TURN_SHARED_SECRET;
      else process.env.TURN_SHARED_SECRET = previousSecret;
    }
  });
});
