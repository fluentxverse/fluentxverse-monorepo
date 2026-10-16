import type { Api, AuthResult, SessionState, Student } from './types';

export function validateStudent(user: Student, expectedId?: string): Student {
  if (!user?.userId || user.role !== 'student' || (expectedId && user.userId !== expectedId)) {
    throw new Error('The API did not confirm the expected student session.');
  }
  return user;
}

export function createSession(api: Api, publish: (state: SessionState) => void) {
  let generation = 0;
  let user: Student | null = null;
  let recovery: Promise<void> | null = null;
  let disposed = false;
  const emit = (phase: SessionState['phase'], message: string) => {
    if (!disposed) publish({ phase, user, message });
  };
  const run = async (action: () => Promise<Student | null>, message: string) => {
    const current = ++generation;
    emit('busy', message);
    try {
      const result = await action();
      if (disposed || current !== generation) return;
      user = result;
      emit(result ? 'authenticated' : 'registration_required', result ? 'Student session confirmed by /student/me.' : 'Registration is required. No account was created.');
    } catch (error) {
      if (disposed || current !== generation) return;
      user = null;
      emit('error', error instanceof Error ? error.message : 'The compatibility check failed.');
    }
  };
  const confirm = async (result: AuthResult) => {
    if (['registration_required', 'incomplete_registration', 'not_found'].includes(result.status)) return null;
    if (result.status !== 'authenticated' || !result.user) throw new Error(result.error || result.message || 'Authentication failed.');
    // A successful exchange is not proof that the browser accepted the session cookie.
    return validateStudent(await api.me(), result.user.userId);
  };
  return {
    check: () => run(async () => validateStudent(await api.me()), 'Checking student session...'),
    password: (email: string, password: string) => run(async () => {
      await api.password(email, password);
      return validateStudent(await api.me());
    }, 'Signing in...'),
    exchange: (token: string) => run(async () => confirm(await api.exchange(token)), 'Exchanging identity for a student session...'),
    wallet: (address: string, signature: string, message: string) => run(async () => confirm(await api.wallet(address, signature, message)), 'Verifying wallet sign-in...'),
    recover: (token: () => Promise<string | null>) => {
      if (recovery) return recovery;
      const expected = user?.userId;
      recovery = run(async () => {
        try { return validateStudent(await api.me(), expected); }
        catch (error) {
          if ((error as { status?: number }).status !== 401) throw error;
          try { await api.refresh(); }
          catch (refreshError) {
            if ((refreshError as { status?: number }).status !== 401) throw refreshError;
            const accessToken = await token();
            if (!accessToken) throw new Error('Sign-in is required to restore the session.');
            const result = await api.exchange(accessToken);
            if (result.status !== 'authenticated' || !result.user) throw new Error('Session recovery requires an existing student.');
            validateStudent(result.user, expected);
          }
          return validateStudent(await api.me(), expected);
        }
      }, 'Restoring student session...').finally(() => { recovery = null; });
      return recovery;
    },
    logout: async () => {
      ++generation;
      user = null;
      emit('busy', 'Signing out...');
      try { await api.logout(); emit('guest', 'Signed out.'); }
      catch { emit('error', 'Server sign-out failed. Retry before leaving this test session.'); }
    },
    dispose: () => { disposed = true; ++generation; user = null; },
  };
}
