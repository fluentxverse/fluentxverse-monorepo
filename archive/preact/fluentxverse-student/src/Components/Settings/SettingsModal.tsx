import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronRight, Copy, Eye, EyeOff, LoaderCircle, LockKeyhole, LogOut, Mail, Save, UserRound, X } from 'lucide-preact';
import { useAuthContext } from '../../context/AuthContext';
import { updatePersonalInfo, updateEmail, updatePassword } from '../../api/auth.api';
import { getStudentProfile, type StudentProfile } from '../../api/student.api';
import { ENGLISH_LEVELS, JAPANESE_PREFECTURES } from '../../data/japanProfileOptions';
import './SettingsModal.css';

type View = 'main' | 'update-password' | 'update-email' | 'update-info';
const goals = ['Conversational fluency', 'Business communication', 'Academic writing', 'Test preparation (IELTS/TOEFL)', 'Travel preparation', 'Career advancement', 'Personal enrichment'];
const styles = ['Visual (pictures, diagrams)', 'Auditory (listening, speaking)', 'Reading/Writing (texts, notes)', 'Kinesthetic (hands-on activities)', 'Mixed approach'];
const times = ['Weekday mornings', 'Weekday afternoons', 'Weekday evenings', 'Weekend mornings', 'Weekend afternoons', 'Weekend evenings', 'Flexible schedule'];
const titles: Record<View, string> = { main: 'Account settings', 'update-email': 'Email address', 'update-password': 'Password', 'update-info': 'Personal information' };
const artwork = (name: string) => <img className="account-art" src={'/assets/img/home-icons/' + name + '-v1.webp'} alt="" />;
const errorMessage = (error: any) => error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Could not save your changes. Please try again.';

function PasswordField({ id, label, value, onInput, newPassword = false, invalid = false }: {
  id: string; label: string; value: string; onInput: (value: string) => void; newPassword?: boolean; invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="account-field">
    <label htmlFor={id}>{label}</label>
    <div className="account-password-input">
      <input id={id} type={visible ? 'text' : 'password'} value={value} onInput={event => onInput(event.currentTarget.value)}
        autoComplete={newPassword ? 'new-password' : 'current-password'} aria-invalid={invalid} aria-describedby={invalid ? 'account-error' : undefined} required />
      <button type="button" title={(visible ? 'Hide ' : 'Show ') + label.toLowerCase()} aria-label={(visible ? 'Hide ' : 'Show ') + label.toLowerCase()} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </div>
  </div>;
}

export default function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { logout, user, getUserId, ensureSession } = useAuthContext();
  const [view, setView] = useState<View>('main');
  const [accountEmail, setAccountEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [prefecture, setPrefecture] = useState('');
  const [proficiency, setProficiency] = useState('');
  const [learningGoals, setLearningGoals] = useState<string[]>([]);
  const [learningStyle, setLearningStyle] = useState('');
  const [availability, setAvailability] = useState<string[]>([]);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<string[]>([]);
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const busy = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const resetForm = () => {
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setNewEmail(''); setConfirmEmail(''); setEmailPassword('');
    setError(''); setInvalid([]); setSuccess(''); setCopyError('');
  };
  const navigate = (next: View) => { if (!busy.current) { resetForm(); setView(next); } };
  const close = () => { if (!busy.current) closeRef.current(); };

  useEffect(() => { if (user?.email) setAccountEmail(user.email); }, [user?.email]);
  useEffect(() => {
    if (!isOpen) { setView('main'); resetForm(); setCopied(false); return; }
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLButtonElement>('.account-close')?.focus();
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    body.current?.scrollTo({ top: 0 });
    if (view !== 'main') heading.current?.focus({ preventScroll: true });
  }, [isOpen, view]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (!isOpen || view !== 'update-info') return;
    let active = true;
    setProfileLoading(true); setProfileError(''); setProfile(null);
    getStudentProfile().then(result => {
      if (!active) return;
      if (!result.success || !result.data) throw new Error(result.error || 'Could not load your information.');
      const loaded = result.data;
      setProfile(loaded); setPhoneNumber(loaded.mobileNumber || '');
      setPrefecture(loaded.country === 'Japan' && JAPANESE_PREFECTURES.some(item => item === loaded.regionName) ? loaded.regionName || '' : '');
      setProficiency(ENGLISH_LEVELS.some(level => level.value === loaded.currentProficiency) ? loaded.currentProficiency || '' : '');
      setLearningGoals(loaded.learningGoals || []); setLearningStyle(loaded.preferredLearningStyle || ''); setAvailability(loaded.availability || []);
    }).catch(error => { if (active) setProfileError(errorMessage(error)); })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [isOpen, view, revision]);

  const reject = (message: string, fields: string[]) => { setError(message); setInvalid(fields); };
  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy.current || success) return;
    setError(''); setInvalid([]);
    const nextEmail = newEmail.trim().toLowerCase();
    if (view === 'update-password') {
      if (!currentPassword || !newPassword || !confirmPassword) return reject('Fill in all password fields.', ['account-current-password', 'account-new-password', 'account-confirm-password'].filter((_, index) => ![currentPassword, newPassword, confirmPassword][index]));
      if (newPassword.length < 8) return reject('Your new password must have at least 8 characters.', ['account-new-password']);
      if (newPassword !== confirmPassword) return reject('The new passwords do not match.', ['account-confirm-password']);
      if (currentPassword === newPassword) return reject('Choose a password different from your current password.', ['account-new-password']);
    } else if (view === 'update-email') {
      if (!nextEmail || !confirmEmail.trim() || !emailPassword) return reject('Fill in all email and password fields.', ['account-new-email', 'account-confirm-email', 'account-email-password'].filter((_, index) => ![nextEmail, confirmEmail.trim(), emailPassword][index]));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) return reject('Enter a valid email address.', ['account-new-email']);
      if (nextEmail !== confirmEmail.trim().toLowerCase()) return reject('The email addresses do not match.', ['account-confirm-email']);
      if (nextEmail === accountEmail.toLowerCase()) return reject('Choose an email different from your current email.', ['account-new-email']);
    } else if (view === 'update-info') {
      if (!profile || profileLoading) return;
      if (!prefecture || !proficiency) return reject('Choose your prefecture and English level.', [!prefecture && 'account-prefecture', !proficiency && 'account-proficiency'].filter(Boolean) as string[]);
      if (phoneNumber && !/^[\d\s\-+()]{7,20}$/.test(phoneNumber.trim())) return reject('Enter a valid phone number.', ['account-phone']);
    } else return;

    busy.current = true; setSaving(true);
    try {
      const result = view === 'update-password' ? await updatePassword(currentPassword, newPassword)
        : view === 'update-email' ? await updateEmail(nextEmail, emailPassword)
          : await updatePersonalInfo({ phoneNumber: phoneNumber.trim(), country: 'Japan', region: prefecture, regionName: prefecture,
            currentProficiency: proficiency, learningGoals, preferredLearningStyle: learningStyle, availability });
      if (!result?.success) throw new Error(result?.message || result?.error || 'Could not save your changes.');
      if (view === 'update-email') setAccountEmail(nextEmail);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setEmailPassword('');
      setSuccess(view === 'update-password' ? 'Your password has been updated.' : view === 'update-email' ? 'Your email has been updated.' : 'Your personal information has been updated.');
      if (view !== 'update-password') void ensureSession().catch(() => {});
    } catch (error) { setError(errorMessage(error)); }
    finally { busy.current = false; setSaving(false); }
  };

  const copyWallet = async (address: string) => {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch { setCopyError('Could not copy the wallet address. Please try again.'); }
  };
  const logOut = async () => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError('');
    try { await logout(); }
    catch (error) { setError(errorMessage(error)); }
    finally { busy.current = false; setSaving(false); }
  };
  const toggle = (values: string[], value: string) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
  const clearValidation = () => { setError(''); setInvalid([]); };
  const fieldProps = (id: string) => ({ id, 'aria-invalid': invalid.includes(id), 'aria-describedby': invalid.includes(id) ? 'account-error' : undefined });
  const firstName = user?.givenName || user?.firstName || '';
  const familyName = user?.familyName || user?.lastName || '';
  const name = [firstName, familyName].filter(Boolean).join(' ') || accountEmail.split('@')[0] || 'Student';
  const initials = (firstName[0] || name[0] || 'S') + (familyName[0] || '');
  const studentId = getUserId() || '';
  const wallet = user?.walletAddress || user?.smartWalletAddress || '';

  if (!isOpen) return null;
  return createPortal(<dialog ref={dialog} className={'student-account-dialog' + (view === 'update-info' ? ' account-personal-view' : '')}
    aria-labelledby="student-account-title" onCancel={event => { event.preventDefault(); close(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')].filter(element => element.getClientRects().length > 0);
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close(); } }}>
    <header className="account-dialog-header">
      {view !== 'main' && <button className="account-icon-button" type="button" title="Back to account" aria-label="Back to account" disabled={saving} onClick={() => navigate('main')}><ArrowLeft size={19} /></button>}
      {artwork(view === 'update-info' ? 'community' : 'home')}
      <h2 id="student-account-title" ref={heading} tabIndex={-1}>{titles[view]}</h2>
      <button className="account-icon-button account-close" type="button" title="Close settings" aria-label="Close settings" disabled={saving} onClick={close}><X size={20} /></button>
    </header>
    <div className="account-dialog-body" ref={body}>
      {error && <p className="account-message account-error" id="account-error" role="alert" tabIndex={-1} ref={errorRef}><AlertCircle size={18} />{error}</p>}
      {success && <p className="account-message account-success" role="status"><CheckCircle2 size={18} />{success}</p>}
      {view === 'main' ? <>
        <div className="account-identity"><div className="account-avatar" aria-hidden="true">{initials.toUpperCase()}</div><div><h3>{name}</h3><p>{accountEmail || 'Email not set'}</p>{studentId && <p className="account-student-id">Student ID <code>{studentId}</code></p>}</div></div>
        {wallet && <div className="account-wallet">{artwork('pay')}<div><span>Wallet address</span><code title={wallet}>{wallet.slice(0, 6) + '...' + wallet.slice(-4)}</code></div><button type="button" className="account-icon-button" title={copied ? 'Wallet address copied' : 'Copy wallet address'} aria-label={copied ? 'Wallet address copied' : 'Copy wallet address'} disabled={copied} onClick={() => void copyWallet(wallet)}>{copied ? <Check size={18} /> : <Copy size={18} />}</button></div>}
        {copied && <p className="account-copy-status" role="status">Wallet address copied.</p>}
        {copyError && <p className="account-message account-error" role="alert">{copyError}</p>}
        <nav className="account-actions" aria-label="Account settings">
          <button type="button" onClick={() => navigate('update-email')}><Mail size={20} /><span>Email address</span><ChevronRight size={18} /></button>
          <button type="button" onClick={() => navigate('update-password')}><LockKeyhole size={20} /><span>Password</span><ChevronRight size={18} /></button>
          <button type="button" onClick={() => navigate('update-info')}><UserRound size={20} /><span>Personal information</span><ChevronRight size={18} /></button>
          <button type="button" className="account-logout" disabled={saving} onClick={() => void logOut()}>{saving ? <LoaderCircle className="account-spinner" size={20} /> : <LogOut size={20} />}<span>{saving ? 'Logging out...' : 'Log out'}</span></button>
        </nav>
      </> : view === 'update-info' && (profileLoading || !profile) ? <div className="account-load-state">
        {profileLoading ? <><LoaderCircle size={24} className="account-spinner" /><p role="status">Loading your information...</p></> : <><AlertCircle size={24} /><p role="alert">{profileError || 'Could not load your information.'}</p><button type="button" className="account-secondary" onClick={() => setRevision(value => value + 1)}>Try again</button></>}
      </div> : <form id="student-account-form" className="account-form" onSubmit={submit} onInput={clearValidation} onChange={clearValidation} noValidate>
        <fieldset disabled={saving || Boolean(success)}>
          {view === 'update-password' ? <>
            <PasswordField id="account-current-password" label="Current password" value={currentPassword} onInput={setCurrentPassword} invalid={invalid.includes('account-current-password')} />
            <PasswordField id="account-new-password" label="New password" value={newPassword} onInput={setNewPassword} newPassword invalid={invalid.includes('account-new-password')} />
            <p className="account-field-hint">At least 8 characters.</p>
            <PasswordField id="account-confirm-password" label="Confirm new password" value={confirmPassword} onInput={setConfirmPassword} newPassword invalid={invalid.includes('account-confirm-password')} />
          </> : view === 'update-email' ? <>
            <div className="account-current-email"><span>Current email</span><p>{accountEmail || 'Email not set'}</p></div>
            <div className="account-field"><label htmlFor="account-new-email">New email address</label><input {...fieldProps('account-new-email')} type="email" autoComplete="email" value={newEmail} onInput={event => setNewEmail(event.currentTarget.value)} required /></div>
            <div className="account-field"><label htmlFor="account-confirm-email">Confirm new email</label><input {...fieldProps('account-confirm-email')} type="email" autoComplete="email" value={confirmEmail} onInput={event => setConfirmEmail(event.currentTarget.value)} required /></div>
            <PasswordField id="account-email-password" label="Current password" value={emailPassword} onInput={setEmailPassword} invalid={invalid.includes('account-email-password')} />
          </> : <>
            <section className="account-form-section"><h3>Contact information</h3><div className="account-field-grid">
              <div className="account-field"><label htmlFor="account-phone">Phone number <span>Optional</span></label><input {...fieldProps('account-phone')} type="tel" autoComplete="tel" placeholder="+81 90 1234 5678" value={phoneNumber} onInput={event => setPhoneNumber(event.currentTarget.value)} /></div>
              <div className="account-field"><label htmlFor="account-prefecture">Prefecture in Japan</label><select {...fieldProps('account-prefecture')} value={prefecture} onChange={event => setPrefecture(event.currentTarget.value)} required><option value="">Choose prefecture</option>{JAPANESE_PREFECTURES.map(item => <option key={item}>{item}</option>)}</select></div>
            </div></section>
            <section className="account-form-section"><h3>{artwork('training')}Learning preferences</h3>
              <div className="account-field"><label htmlFor="account-proficiency">English speaking level</label><select {...fieldProps('account-proficiency')} value={proficiency} onChange={event => setProficiency(event.currentTarget.value)} required><option value="">Choose your level</option>{ENGLISH_LEVELS.map(level => <option key={level.value} value={level.value}>{level.value + ' - ' + level.label}</option>)}</select>{proficiency && <p className="account-field-hint">{ENGLISH_LEVELS.find(level => level.value === proficiency)?.description}</p>}</div>
              <div className="account-field"><label htmlFor="account-learning-style">Preferred learning style</label><select id="account-learning-style" value={learningStyle} onChange={event => setLearningStyle(event.currentTarget.value)}><option value="">No preference</option>{styles.map(style => <option key={style}>{style}</option>)}</select></div>
              <fieldset className="account-checkboxes"><legend>Learning goals</legend>{goals.map(goal => <label key={goal}><input type="checkbox" checked={learningGoals.includes(goal)} onChange={() => setLearningGoals(values => toggle(values, goal))} /><span>{goal}</span></label>)}</fieldset>
            </section>
            <section className="account-form-section"><h3>{artwork('schedule')}Lesson availability</h3><fieldset className="account-checkboxes"><legend className="account-sr-only">Availability for lessons</legend>{times.map(time => <label key={time}><input type="checkbox" checked={availability.includes(time)} onChange={() => setAvailability(values => toggle(values, time))} /><span>{time}</span></label>)}</fieldset></section>
          </>}
        </fieldset>
      </form>}
    </div>
    {view !== 'main' && <footer className="account-dialog-footer">
      {success ? <button type="button" className="account-primary" onClick={() => navigate('main')}><Check size={17} />Back to account</button>
        : <><button type="button" className="account-secondary" disabled={saving} onClick={() => navigate('main')}>Cancel</button><button type="submit" form="student-account-form" className="account-primary" aria-label={saving ? 'Saving...' : view === 'update-password' ? 'Save password' : view === 'update-email' ? 'Save email' : 'Save changes'} disabled={saving || (view === 'update-info' && (!profile || profileLoading))}>{saving ? <><LoaderCircle size={17} className="account-spinner" />Saving...</> : <><Save size={17} /><span className="account-save-label">{view === 'update-password' ? 'Save password' : view === 'update-email' ? 'Save email' : 'Save changes'}</span><span className="account-save-short" aria-hidden="true">Save</span></>}</button></>}
    </footer>}
  </dialog>, document.body);
}
