export type Provider = 'google' | 'twitter' | 'apple';
export type Student = { userId: string; role: string; givenName?: string; email?: string };
export type AuthResult = {
  status: 'authenticated' | 'registration_required' | 'incomplete_registration' | 'not_found' | 'error';
  user?: Student;
  profile?: { provider?: string; email?: string };
  message?: string;
  error?: string;
};
export type Api = {
  me(): Promise<Student>;
  refresh(): Promise<void>;
  exchange(token: string): Promise<AuthResult>;
  password(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  nonce(address: string): Promise<{ message: string }>;
  wallet(address: string, signature: string, message: string): Promise<AuthResult>;
};
export type Identity = {
  initialize(): Promise<void>;
  originAllowed(): boolean | undefined;
  enabledProviders(): Provider[] | null;
  token(): Promise<string | null>;
  start(provider: Provider): Promise<string>;
  complete(url: URL): Promise<boolean>;
  logout(): Promise<void>;
};
export type SessionState = {
  phase: 'guest' | 'busy' | 'authenticated' | 'registration_required' | 'error';
  user: Student | null;
  message: string;
};
