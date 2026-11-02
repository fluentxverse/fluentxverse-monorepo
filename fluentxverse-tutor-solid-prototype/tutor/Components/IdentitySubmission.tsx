import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { ShieldCheck, Upload, RefreshCw, Check, Clock3, Mail, ArrowRight, FileImage, Camera, LockKeyhole, X } from 'lucide-solid';
import { client } from '../api/utils';
import { acceptedTutorIds, identityCanBook, type TutorIdentityRecord } from '../../../shared/tutorIdentity';
import '../../../shared/ui/tutor-identity.css';
import TutorArt from './Common/TutorArt';
import './IdentitySubmission.css';

export default function IdentitySubmission(props: { onEligibility: (allowed: boolean) => void }) {
  const [record, setRecord] = createSignal<TutorIdentityRecord | null>(null);
  const [enabled, setEnabled] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [idType, setIdType] = createSignal('national');
  const [birthDate, setBirthDate] = createSignal('');
  const [consent, setConsent] = createSignal(false);
  const [fileName, setFileName] = createSignal('');
  const [preview, setPreview] = createSignal('');
  const clearFile = () => { if (preview()) URL.revokeObjectURL(preview()); setPreview(''); setFileName(''); if (input) input.value = ''; };
  onCleanup(() => { if (preview()) URL.revokeObjectURL(preview()); });
  let input: HTMLInputElement | undefined;
  const refresh = async () => {
    try {
      const { data } = await client.get('/tutor-identity/status');
      if (!data.success) throw Error(data.error);
      setRecord(data.data.record); setEnabled(data.data.enabled); setLoaded(true); setError('');
      props.onEligibility(!data.data.enabled || identityCanBook(data.data.record));
    } catch (e: any) { props.onEligibility(false); setError(e.response?.data?.error || 'Unable to check identity status.'); }
  };
  onMount(() => { void refresh(); const timer = setInterval(refresh, 30000); onCleanup(() => clearInterval(timer)); });
  const submit = async (event: SubmitEvent) => {
    event.preventDefault(); if (!input?.files?.[0] || busy()) return;
    setBusy(true); setError('');
    try {
      const body = new FormData(); body.append('image', input.files[0]); body.append('idType', idType());
      body.append('birthDate', birthDate()); body.append('consent', String(consent()));
      const { data } = await client.post('/tutor-identity/submit', body);
      if (!data.success) throw Error(data.error);
      clearFile(); setBirthDate(''); await refresh();
    } catch (e: any) { setError(e.response?.data?.error || e.message || 'Upload failed.'); }
    finally { setBusy(false); }
  };
  return <section class="identity-section tutor-identity" classList={{ 'identity-accepted-summary': record()?.status === 'accepted' }} aria-label="Identity verification">
    <Show when={!loaded() && !error()}><p>Checking identity requirements...</p></Show>
    <Show when={error()}><p role="alert" class="identity-error">{error()}</p><button type="button" onClick={refresh}><RefreshCw size={16}/> Retry</button></Show>
    <Show when={enabled()}>
      <Show when={!record() || ['pending_review', 'resubmit', 'expired'].includes(record()!.status)}>
        <ol class="identity-journey" aria-label="Interview application progress">
          <li classList={{complete:record()?.status === 'pending_review',active:record()?.status !== 'pending_review'}}><span><Show when={record()?.status === 'pending_review'} fallback="1"><Check size={16}/></Show></span><div><strong>Submit your ID</strong><small>One clear image</small></div></li>
          <li classList={{active:record()?.status === 'pending_review'}}><span>2</span><div><strong>ID review</strong><small>Allow 24–48 hours</small></div></li>
          <li><span>3</span><div><strong>Book interview</strong><small>After ID acceptance</small></div></li>
        </ol>
      </Show>
      <Show when={record()?.status !== 'pending_review'}>
      <h2><ShieldCheck size={22}/> Identity verification</h2>
      </Show>
      <Show when={record()}><div class="identity-status" role="status">
        <strong class="tutor-identity-status-label">{({ pending_review: 'Awaiting ID review', accepted: 'ID accepted', booked: 'Present this same ID at your interview', verified: 'Identity verified', resubmit: 'Resubmission required', expired: 'Booking window expired', fraud: 'Account banned. Contact support.' })[record()!.status]}</strong>
        <Show when={record()?.status === 'pending_review'}>
          <div class="identity-pending-review"><div class="identity-review-overview"><TutorArt name="contactCheck" size={88}/><div>
            <h3>We are reviewing your ID</h3>
            <p>Your ID has been received. Our team will check your submission before you book an interview.</p>
            <div class="identity-review-time"><Clock3 size={18}/><span>Expected review time <strong>24–48 hours</strong></span></div>
            <div class="identity-actions"><button type="button" onClick={refresh}><RefreshCw size={16}/>Check status</button><a href="/interview-guide">Prepare for your interview <ArrowRight size={16}/></a></div>
          </div></div><aside class="identity-next-update"><Mail size={22}/><h4>We will email you</h4><p>Every review outcome is sent from <strong>tutor@fluentxverse.com</strong>. Check your spam folder too.</p><p>You can return here to check your status. Nothing else is needed while you wait.</p></aside></div>
        </Show>
        <Show when={record()?.reason}><p>{record()?.reason}</p></Show>
        <Show when={record()?.status === 'accepted'}><p>Book by {new Date(record()!.bookingDeadline!).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (Manila). Acceptance lasts 84 hours with no extension.</p></Show>
        <Show when={record()?.status === 'verified'}><p>Wallet credential: {record()?.credentialStatus?.replaceAll('_', ' ')}. Identity approval does not expire, but may be revoked.</p></Show>
      </div></Show>
      <Show when={!record() || ['resubmit', 'expired'].includes(record()!.status)}>
        <Show when={record()}><p>You can submit a replacement now. Once it is saved, your previous ID image will be deleted.</p></Show>
        <div class="identity-upload-workspace"><form class="identity-form" onSubmit={submit}>
            <div class="identity-upload-heading"><h3>Submit your identity document</h3><p>Choose an accepted ID and upload one clear image.</p></div>
            <div class="identity-field-row">
            <label>ID type<select value={idType()} onChange={e => setIdType(e.currentTarget.value)}><For each={acceptedTutorIds}>{item => <option value={item[0]}>{item[1]}</option>}</For></select></label>
            <label>Date of birth<input type="date" required value={birthDate()} onInput={e => setBirthDate(e.currentTarget.value)}/></label>
            </div>
            <label class="identity-file-picker"><input ref={input} aria-label="ID image" type="file" accept="image/jpeg,image/png,image/webp" required onChange={e=>{const file=e.currentTarget.files?.[0]; if(!file){clearFile();return;} if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){clearFile();setError('Choose a JPEG, PNG or WebP image up to 5 MB.');return;} if(preview())URL.revokeObjectURL(preview());setFileName(file.name);setPreview(URL.createObjectURL(file));setError('');}}/>
              <Show when={preview()} fallback={<><FileImage size={32}/><strong>Choose an ID image</strong><span>JPEG, PNG or WebP · Up to 5 MB</span><span class="identity-file-command"><Upload size={16}/>Choose image</span></>}><img src={preview()} alt="Selected ID preview"/><strong>{fileName()}</strong><span>Choose a different image</span></Show>
            </label>
            <Show when={fileName()}><button type="button" class="identity-remove-file" onClick={clearFile}><X size={14}/>Remove image</button></Show>
            <details class="identity-retention"><summary><LockKeyhole size={16}/>Privacy and image retention</summary><p>Your encrypted image is accessible only to authorized reviewers. If you do not book within 84 hours of acceptance, it is deleted. Cancelled interviews and no-shows require resubmission. Rejected images and images after the final interview decision are deleted at the next Manila midnight. A rejected image is deleted sooner when you submit a replacement. Minimal verification and access records remain.</p></details>
            <label class="identity-check"><input type="checkbox" required checked={consent()} onChange={e => setConsent(e.currentTarget.checked)}/> I consent to staff reviewing my ID and face for my tutor application under this retention policy.</label>
            <button class="identity-submit-action" type="submit" disabled={busy()}><Upload size={16}/>{busy() ? 'Submitting...' : 'Submit ID for review'}</button>
          </form>
          <aside class="identity-upload-checklist"><TutorArt name="contactCheck" size={64}/><h3>Before you submit</h3><ul><li><Check size={16}/><span>All text and the photo must be readable, with all four corners visible.</span></li><li><Camera size={16}/><span>Avoid glare, blur and heavy shadows. Use the original image, without filters.</span></li><li><ShieldCheck size={16}/><span>You must be at least 18. Bring this same ID to your video interview.</span></li></ul><p>Do not include a payment-card back, PIN, CVV or password.</p><a href="/interview-guide">Read the interview guide <ArrowRight size={16}/></a></aside>
        </div>
      </Show>
    </Show>
  </section>;
}
