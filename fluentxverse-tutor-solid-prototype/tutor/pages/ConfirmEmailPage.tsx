import { createEffect, createSignal, onCleanup, Show, untrack } from 'solid-js';
import { ArrowRight, CheckCircle2, Mail, RefreshCw, Send } from 'lucide-solid';
import Header from '../Components/Header/Header';
import { useAuthContext } from '../context/AuthContext';
import { confirmTutorEmail, getTutorEmailStatus, sendTutorEmailConfirmation, type TutorEmailStatus } from '../api/emailVerification.api';
import './ConfirmEmailPage.css';

export default function ConfirmEmailPage() {
  const auth = useAuthContext();
  const initialToken = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
  // Fragments never reach the server; remove the bearer token from the address bar immediately.
  if (window.location.hash) window.history.replaceState({}, '', '/confirm-email');
  const [token, setToken] = createSignal(initialToken), [status, setStatus] = createSignal<TutorEmailStatus>(),
    [busy, setBusy] = createSignal(false), [verified, setVerified] = createSignal(false),
    [error, setError] = createSignal(''), [notice, setNotice] = createSignal(''), [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => clearInterval(timer));
  const remaining = () => Math.max(0, Math.ceil(((status()?.resendAvailableAt || 0) - now()) / 1000));
  const failure = (e: any) => e?.response?.data?.error || 'Email confirmation is temporarily unavailable. Please try again.';
  async function check() {
    if (busy() || !auth.isAuthenticated) return;
    setBusy(true); setError('');
    try { const result = await getTutorEmailStatus(); setNow(Date.now()); setStatus(result); setVerified(result.verified); }
    catch (e) { setError(failure(e)); }
    finally { setBusy(false); }
  }
  createEffect(() => {
    document.title = 'Confirm email | FluentXVerse';
    if (!auth.initialLoading && auth.isAuthenticated) untrack(() => void check());
  });
  async function send() {
    if (busy() || remaining()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await sendTutorEmailConfirmation();
      setToken('');
      const result = await getTutorEmailStatus(); setNow(Date.now()); setStatus(result); setVerified(result.verified);
      setNotice(result.verified ? 'Your email is already confirmed.' : 'Confirmation email sent. Check your inbox and spam folder.');
    } catch (e: any) {
      setError(failure(e));
      const retry = Number(e?.response?.headers?.['retry-after']);
      if (status() && Number.isFinite(retry) && retry > 0) setStatus({ ...status()!, resendAvailableAt: Date.now() + retry * 1000 });
    } finally { setBusy(false); }
  }
  async function confirm() {
    if (busy()) return;
    setBusy(true); setError('');
    try { await confirmTutorEmail(token()); setVerified(true); setToken(''); }
    catch (e) { setError(failure(e)); }
    finally { setBusy(false); }
  }
  return <div class="tutor-confirm-page"><Header /><section class="tutor-confirm-content" aria-labelledby="confirm-email-title">
    <div class="tutor-confirm-icon" aria-hidden="true"><Show when={verified()} fallback={<Mail size={30} />}><CheckCircle2 size={30} /></Show></div>
    <p class="tutor-confirm-eyebrow">TUTOR APPLICATION</p>
    <h1 id="confirm-email-title">{verified() ? 'Email confirmed' : 'Confirm your email'}</h1>
    <Show when={verified()} fallback={<>
      <p>Confirm your email address before starting the written exam.</p>
      <Show when={status()?.email}><p class="tutor-confirm-address">{status()!.email}</p></Show>
      <p class="tutor-confirm-sender">Your confirmation email comes from <strong>tutor@fluentxverse.com</strong>. Check your spam folder if it has not arrived.</p>
    </>}><p>Your email address is confirmed. You can continue your tutor application.</p></Show>
    <Show when={error()}><p class="tutor-confirm-error" role="alert">{error()}</p></Show>
    <Show when={notice()}><p class="tutor-confirm-notice" role="status">{notice()}</p></Show>
    <div class="tutor-confirm-actions">
      <Show when={verified()} fallback={<>
        <Show when={token()}><button type="button" class="tutor-confirm-primary" disabled={busy() || auth.initialLoading} onClick={() => void confirm()}><CheckCircle2 size={18} />{busy() ? 'Confirming...' : 'Confirm email'}</button></Show>
        <Show when={auth.isAuthenticated} fallback={<a class="tutor-confirm-link" href="/">Sign in to request a new link <ArrowRight size={17} /></a>}>
          <button type="button" disabled={busy() || remaining() > 0} onClick={() => void send()}><Send size={17} />{remaining() ? `Resend in ${remaining()}s` : status()?.deliveryStatus === 'not_sent' ? 'Send confirmation email' : 'Resend confirmation email'}</button>
          <button type="button" disabled={busy()} onClick={() => void check()}><RefreshCw size={17} />I have confirmed my email</button>
        </Show>
      </>}><a class="tutor-confirm-link" href={auth.isAuthenticated ? '/home' : '/'}>{auth.isAuthenticated ? 'Continue application' : 'Sign in to continue'} <ArrowRight size={18} /></a></Show>
    </div>
    <Show when={!verified()}><p class="tutor-confirm-expiry">Links expire after 30 minutes. Only the most recent confirmation link will work.</p></Show>
  </section></div>;
}
