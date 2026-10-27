import { describe, expect, test } from 'bun:test';
import { onchainEducationPillars } from '../src/data/onchainEducation';

describe('public onchain education case', () => {
  test('all five themes have unique deep links and two concrete benefits', () => {
    expect(onchainEducationPillars.map(p => p.id)).toEqual(['credentials', 'learning-records', 'learning-incentives', 'educator-payments', 'community-governance']);
    for (const p of onchainEducationPillars) {
      expect(p.benefits).toHaveLength(2);
      expect(p.introduction.length).toBeGreaterThan(50);
      expect(p.boundary.length).toBeGreaterThan(50);
    }
  });
  test('potential programs are not misrepresented as live products or guarantees', () => {
    expect(onchainEducationPillars[0].boundary).toContain('does not eliminate all credential fraud');
    expect(onchainEducationPillars[1].boundary).toContain('not a permanent storage guarantee');
    expect(onchainEducationPillars[2].boundary).toContain('not a live FluentXVerse');
    expect(onchainEducationPillars[3].boundary).toContain('transfers and automated course royalties are not enabled');
    expect(onchainEducationPillars[4].benefits[0].text).toContain('permanent public student dossier');
    expect(onchainEducationPillars[4].boundary).toContain('future directions');
    expect(JSON.stringify(onchainEducationPillars)).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
