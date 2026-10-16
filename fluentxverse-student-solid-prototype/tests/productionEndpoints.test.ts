import { describe, expect, test } from 'bun:test';
import { studentEndpoints } from '../student/config/productionDomains';

describe('student deployment endpoints', () => {
  const production = { apiUrl: 'https://api.fluentxverse.com', socketUrl: 'https://ws.fluentxverse.com' };
  test('production cannot inherit local test endpoint overrides', () => {
    for (const hostname of ['student.fluentxverse.com', 'student.fluentxverse.xyz']) {
      expect(studentEndpoints(hostname, 'http://127.0.0.1:8780', 'http://127.0.0.1:8781')).toEqual(production);
    }
  });
  test('local development keeps its isolated API and socket', () => {
    expect(studentEndpoints('127.0.0.1')).toEqual({ apiUrl: 'http://127.0.0.1:8780', socketUrl: 'http://127.0.0.1:8781' });
  });
  test('workers.dev previews use explicit production build endpoints', () => {
    expect(studentEndpoints('fluentxverse-student.paulanthonyarriola.workers.dev', `${production.apiUrl}/`, 'wss://ws.fluentxverse.com/')).toEqual(production);
  });
  test('lookalike hosts do not select production automatically', () => {
    expect(studentEndpoints('student.fluentxverse.com.evil.test').apiUrl).toBe('http://127.0.0.1:8780');
  });
});
