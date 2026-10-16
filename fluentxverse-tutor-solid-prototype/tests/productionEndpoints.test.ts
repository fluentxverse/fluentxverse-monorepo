import { describe, expect, test } from 'bun:test';
import { tutorEndpoints } from '../tutor/config/productionDomains';

describe('tutor deployment endpoints', () => {
  const production = { apiUrl: 'https://api.fluentxverse.com', socketUrl: 'https://ws.fluentxverse.com' };
  test('public domains cannot inherit local harness endpoints', () => {
    for (const hostname of ['tutor.fluentxverse.com', 'tutor.fluentxverse.xyz']) {
      expect(tutorEndpoints(hostname, 'http://127.0.0.1:8782', 'http://127.0.0.1:8783')).toEqual(production);
    }
  });
  test('local development keeps isolated defaults', () => {
    expect(tutorEndpoints('127.0.0.1')).toEqual({ apiUrl: 'http://127.0.0.1:8782', socketUrl: 'http://127.0.0.1:8783' });
  });
  test('workers.dev previews use explicit public build values', () => {
    expect(tutorEndpoints('fluentxverse-tutor.paulanthonyarriola.workers.dev', production.apiUrl + '/', 'wss://ws.fluentxverse.com/')).toEqual(production);
  });
  test('lookalike domains do not select production', () => {
    expect(tutorEndpoints('tutor.fluentxverse.com.evil.test').apiUrl).toBe('http://127.0.0.1:8782');
  });
});
