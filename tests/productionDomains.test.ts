import { describe, expect, test } from 'bun:test';
import { productionEndpoints as student } from '../fluentxverse-student/src/config/productionDomains';
import { productionEndpoints as tutor } from '../fluentxverse-tutor/src/config/productionDomains';
import { productionEndpoints as dashboard } from '../fluentxverse-dashboard/src/config/productionDomains';

for (const [app, endpoints] of Object.entries({ student, tutor, dashboard })) {
  describe(`${app} production endpoints`, () => {
    for (const domain of ['fluentxverse.com', 'fluentxverse.xyz']) {
      test(`${domain} stays same-site for authentication and signaling`, () => {
        for (const prefix of ['', 'www.', 'student.', 'tutor.', 'dashboard.']) {
          expect(endpoints(prefix + domain)).toEqual({apiUrl:`https://api.${domain}`,socketUrl:`https://ws.${domain}`});
        }
      });
    }
    test('rejects local, lookalike, unknown subdomains and suffix matches', () => {
      for (const host of ['localhost','127.0.0.1','student.fluentxverse.com.evil.example','evilfluentxverse.com',
        'evil.fluentxverse.com','student.fluentxverse.xyz.evil.example','fluentxverse.com:8443']) {
        expect(endpoints(host)).toBeUndefined();
      }
    });
  });
}
