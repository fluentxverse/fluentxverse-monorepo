import type { Api, Student } from './types';

export type Scenario = 'existing' | 'new' | 'rejected-cookie' | 'wrong-role' | 'offline' | 'expired';
const demo: Student = { userId: 'solid-demo-student', role: 'student', givenName: 'Shet', email: 'demo@example.test' };
export function createSimulation(scenario: () => Scenario): Api {
  let user: Student | null = null;
  let expired = true;
  const reject = () => { throw Object.assign(new Error('No active student session.'), { status: 401 }); };
  const exchange: Api['exchange'] = async () => {
    if (scenario() === 'offline') throw new Error('Simulated network failure.');
    if (scenario() === 'new') return { status: 'registration_required', profile: { provider: 'google' } };
    user = scenario() === 'rejected-cookie' ? null : scenario() === 'wrong-role' ? { ...demo, role: 'tutor' } : demo;
    expired = false;
    return { status: 'authenticated', user: demo };
  };
  return {
    me: async () => { if (scenario() === 'expired' && expired) reject(); return user || reject(); },
    refresh: async () => { if (!user) reject(); expired = false; },
    exchange,
    password: async () => { await exchange(''); },
    logout: async () => { user = null; expired = true; },
    nonce: async address => ({ message: `FluentXVerse Solid prototype simulation\nWallet: ${address}\nNo transaction or production login is authorized.` }),
    wallet: async () => exchange(''),
  };
}
