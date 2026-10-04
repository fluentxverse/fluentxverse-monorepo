import { createHmac } from 'node:crypto';

export function getIceConfiguration(userId: string) {
  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ];
  const urls = process.env.TURN_URLS?.split(',').map(url => url.trim()).filter(Boolean);
  const secret = process.env.TURN_SHARED_SECRET;
  if (urls?.length && secret) {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${userId}`;
    iceServers.push({
      urls,
      username,
      credential: createHmac('sha1', secret).update(username).digest('base64')
    });
  }
  return { iceServers };
}
