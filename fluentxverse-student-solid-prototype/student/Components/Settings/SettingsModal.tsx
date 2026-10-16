import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronRight, Copy, Eye, EyeOff, LoaderCircle, LockKeyhole, LogOut, Mail, Save, UserRound, X } from "lucide-solid";
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
const artwork = (name: string) => <img class="account-art" src={'/assets/img/home-icons/' + name + '-v1.webp'} alt=""/>;
const errorMessage = (error: any) => error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Could not save your changes. Please try again.';
function PasswordField(_props0: {
    id: string;
    label: string;
    value: string;
    onInput: (value: string) => void;
    newPassword?: boolean;
    invalid?: boolean;
}) {
    const [visible, setVisible] = createSignal(false);
    return <div class="account-field">
    <label for={_props0["id"]}>{_props0["label"]}</label>
    <div class="account-password-input">
      <input id={_props0["id"]} type={visible() ? 'text' : 'password'} value={_props0["value"]} onInput={event => _props0["onInput"](event.currentTarget.value)} autocomplete={(_props0["newPassword"] === undefined ? false : _props0["newPassword"]) ? 'new-password' : 'current-password'} aria-invalid={_props0["invalid"] === undefined ? false : _props0["invalid"]} aria-describedby={(_props0["invalid"] === undefined ? false : _props0["invalid"]) ? 'account-error' : undefined} required/>
      <button type="button" title={(visible() ? 'Hide ' : 'Show ') + _props0["label"].toLowerCase()} aria-label={(visible() ? 'Hide ' : 'Show ') + _props0["label"].toLowerCase()} aria-pressed={visible()} onClick={() => setVisible(value => !value)}>{visible() ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
    </div>
  </div>;
}
export default function SettingsModal(_props1: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const _state2 = useAuthContext();
    const [view, setView] = createSignal<View>('main');
    const [accountEmail, setAccountEmail] = createSignal(_state2.user?.email || '');
    const [currentPassword, setCurrentPassword] = createSignal('');
    const [newPassword, setNewPassword] = createSignal('');
    const [confirmPassword, setConfirmPassword] = createSignal('');
    const [newEmail, setNewEmail] = createSignal('');
    const [confirmEmail, setConfirmEmail] = createSignal('');
    const [emailPassword, setEmailPassword] = createSignal('');
    const [phoneNumber, setPhoneNumber] = createSignal('');
    const [prefecture, setPrefecture] = createSignal('');
    const [proficiency, setProficiency] = createSignal('');
    const [learningGoals, setLearningGoals] = createSignal<string[]>([]);
    const [learningStyle, setLearningStyle] = createSignal('');
    const [availability, setAvailability] = createSignal<string[]>([]);
    const [profile, setProfile] = createSignal<StudentProfile | null>(null);
    const [profileLoading, setProfileLoading] = createSignal(false);
    const [profileError, setProfileError] = createSignal('');
    const [revision, setRevision] = createSignal(0);
    const [error, setError] = createSignal('');
    const [invalid, setInvalid] = createSignal<string[]>([]);
    const [success, setSuccess] = createSignal('');
    const [saving, setSaving] = createSignal(false);
    const [copied, setCopied] = createSignal(false);
    const [copyError, setCopyError] = createSignal('');
    const dialog = { current: null } as {
        current: HTMLDialogElement | null;
    };
    const body = { current: null } as {
        current: HTMLDivElement | null;
    };
    const heading = { current: null } as {
        current: HTMLHeadingElement | null;
    };
    const errorRef = { current: null } as {
        current: HTMLParagraphElement | null;
    };
    const busy = { current: false } as {
        current: any;
    };
    const copyTimer = { current: undefined } as {
        current: ReturnType<typeof setTimeout> | null;
    };
    const closeRef = { current: _props1["onClose"] } as {
        current: any;
    };
    createEffect(() => closeRef.current = _props1["onClose"]);
    const resetForm = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setNewEmail('');
        setConfirmEmail('');
        setEmailPassword('');
        setError('');
        setInvalid([]);
        setSuccess('');
        setCopyError('');
    };
    const navigate = (next: View) => { if (!busy.current) {
        resetForm();
        setView(next);
    } };
    const close = () => { if (!busy.current)
        closeRef.current(); };
    createEffect(on(() => [_state2.user?.email], () => {
        const _cleanup3 = untrack(() => { if (_state2.user?.email)
            setAccountEmail(_state2.user.email); });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    createEffect(on(() => [_props1["isOpen"]], () => {
        const _cleanup4 = untrack(() => {
            if (!_props1["isOpen"]) {
                setView('main');
                resetForm();
                setCopied(false);
                return;
            }
            const previousFocus = document.activeElement as HTMLElement | null;
            const previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            dialog.current?.showModal();
            dialog.current?.querySelector<HTMLButtonElement>('.account-close')?.focus();
            return () => {
                if (copyTimer.current)
                    clearTimeout(copyTimer.current);
                document.body.style.overflow = previousOverflow;
                previousFocus?.focus();
            };
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    createEffect(on(() => [_props1["isOpen"], view()], () => {
        const _cleanup5 = untrack(() => {
            if (!_props1["isOpen"])
                return;
            body.current?.scrollTo({ top: 0 });
            if (view() !== 'main')
                heading.current?.focus({ preventScroll: true });
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    createEffect(on(() => [error()], () => {
        const _cleanup6 = untrack(() => { if (error())
            errorRef.current?.focus(); });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    createEffect(on(() => [_props1["isOpen"], view(), revision()], () => {
        const _cleanup7 = untrack(() => {
            if (!_props1["isOpen"] || view() !== 'update-info')
                return;
            let active = true;
            setProfileLoading(true);
            setProfileError('');
            setProfile(null);
            getStudentProfile().then(result => {
                if (!active)
                    return;
                if (!result.success || !result.data)
                    throw new Error(result.error || 'Could not load your information.');
                const loaded = result.data;
                setProfile(loaded);
                setPhoneNumber(loaded.mobileNumber || '');
                setPrefecture(loaded.country === 'Japan' && JAPANESE_PREFECTURES.some(item => item === loaded.regionName) ? loaded.regionName || '' : '');
                setProficiency(ENGLISH_LEVELS.some(level => level.value === loaded.currentProficiency) ? loaded.currentProficiency || '' : '');
                setLearningGoals(loaded.learningGoals || []);
                setLearningStyle(loaded.preferredLearningStyle || '');
                setAvailability(loaded.availability || []);
            }).catch(error => { if (active)
                setProfileError(errorMessage(error)); })
                .finally(() => { if (active)
                setProfileLoading(false); });
            return () => { active = false; };
        });
        if (typeof _cleanup7 === "function")
            onCleanup(_cleanup7);
    }));
    const reject = (message: string, fields: string[]) => { setError(message); setInvalid(fields); };
    const submit = async (event: Event) => {
        event.preventDefault();
        if (busy.current || success())
            return;
        setError('');
        setInvalid([]);
        const nextEmail = newEmail().trim().toLowerCase();
        if (view() === 'update-password') {
            if (!currentPassword() || !newPassword() || !confirmPassword())
                return reject('Fill in all password fields.', ['account-current-password', 'account-new-password', 'account-confirm-password'].filter((_, index) => ![currentPassword(), newPassword(), confirmPassword()][index]));
            if (newPassword().length < 8)
                return reject('Your new password must have at least 8 characters.', ['account-new-password']);
            if (newPassword() !== confirmPassword())
                return reject('The new passwords do not match.', ['account-confirm-password']);
            if (currentPassword() === newPassword())
                return reject('Choose a password different from your current password.', ['account-new-password']);
        }
        else if (view() === 'update-email') {
            if (!nextEmail || !confirmEmail().trim() || !emailPassword())
                return reject('Fill in all email and password fields.', ['account-new-email', 'account-confirm-email', 'account-email-password'].filter((_, index) => ![nextEmail, confirmEmail().trim(), emailPassword()][index]));
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail))
                return reject('Enter a valid email address.', ['account-new-email']);
            if (nextEmail !== confirmEmail().trim().toLowerCase())
                return reject('The email addresses do not match.', ['account-confirm-email']);
            if (nextEmail === accountEmail().toLowerCase())
                return reject('Choose an email different from your current email.', ['account-new-email']);
        }
        else if (view() === 'update-info') {
            if (!profile() || profileLoading())
                return;
            if (!prefecture() || !proficiency())
                return reject('Choose your prefecture and English level.', [!prefecture() && 'account-prefecture', !proficiency() && 'account-proficiency'].filter(Boolean) as string[]);
            if (phoneNumber() && !/^[\d\s\-+()]{7,20}$/.test(phoneNumber().trim()))
                return reject('Enter a valid phone number.', ['account-phone']);
        }
        else
            return;
        busy.current = true;
        setSaving(true);
        try {
            const result = view() === 'update-password' ? await updatePassword(currentPassword(), newPassword())
                : view() === 'update-email' ? await updateEmail(nextEmail, emailPassword())
                    : await updatePersonalInfo({ get phoneNumber() {
                            return phoneNumber().trim();
                        }, country: 'Japan', get region() {
                            return prefecture();
                        }, get regionName() {
                            return prefecture();
                        }, get currentProficiency() {
                            return proficiency();
                        }, get learningGoals() {
                            return learningGoals();
                        }, get preferredLearningStyle() {
                            return learningStyle();
                        }, get availability() {
                            return availability();
                        } });
            if (!result?.success)
                throw new Error(result?.message || result?.error || 'Could not save your changes.');
            if (view() === 'update-email')
                setAccountEmail(nextEmail);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setEmailPassword('');
            setSuccess(view() === 'update-password' ? 'Your password has been updated.' : view() === 'update-email' ? 'Your email has been updated.' : 'Your personal information has been updated.');
            if (view() !== 'update-password')
                void _state2.ensureSession().catch(() => { });
        }
        catch (error) {
            setError(errorMessage(error));
        }
        finally {
            busy.current = false;
            setSaving(false);
        }
    };
    const copyWallet = async (address: string) => {
        setCopyError('');
        try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            if (copyTimer.current)
                clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopied(false), 1600);
        }
        catch {
            setCopyError('Could not copy the wallet address. Please try again.');
        }
    };
    const logOut = async () => {
        if (busy.current)
            return;
        busy.current = true;
        setSaving(true);
        setError('');
        try {
            await _state2.logout();
        }
        catch (error) {
            setError(errorMessage(error));
        }
        finally {
            busy.current = false;
            setSaving(false);
        }
    };
    const toggle = (values: string[], value: string) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
    const clearValidation = () => { setError(''); setInvalid([]); };
    const fieldProps = (id: string) => ({ id, get 'aria-invalid'() {
            return invalid().includes(id);
        }, get 'aria-describedby'() {
            return invalid().includes(id) ? 'account-error' : undefined;
        } });
    const firstName = createMemo(() => _state2.user?.givenName || _state2.user?.firstName || '');
    const familyName = createMemo(() => _state2.user?.familyName || _state2.user?.lastName || '');
    const name = createMemo(() => [firstName(), familyName()].filter(Boolean).join(' ') || accountEmail().split('@')[0] || 'Student');
    const initials = createMemo(() => (firstName()[0] || name()[0] || 'S') + (familyName()[0] || ''));
    const studentId = createMemo(() => _state2.getUserId() || '');
    const wallet = createMemo(() => _state2.user?.walletAddress || _state2.user?.smartWalletAddress || '');
    return createMemo(() => {
        if (!_props1["isOpen"])
            return null;
        return <Portal mount={document.body}>{<dialog ref={_element => dialog.current = _element} class={'student-account-dialog' + (view() === 'update-info' ? ' account-personal-view' : '')} aria-labelledby="student-account-title" onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => {
                if (event.key !== 'Tab')
                    return;
                const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')].filter(element => element.getClientRects().length > 0);
                if (!controls.length) {
                    event.preventDefault();
                    return;
                }
                const first = controls[0], last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }} onClick={event => { if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)
                close();
        } }}>
    <header class="account-dialog-header">
      {view() !== 'main' && <button class="account-icon-button" type="button" title="Back to account" aria-label="Back to account" disabled={saving()} onClick={() => navigate('main')}><ArrowLeft size={19}/></button>}
      {artwork(view() === 'update-info' ? 'community' : 'home')}
      <h2 id="student-account-title" ref={_element => heading.current = _element} tabIndex={-1}>{titles[view()]}</h2>
      <button class="account-icon-button account-close" type="button" title="Close settings" aria-label="Close settings" disabled={saving()} onClick={close}><X size={20}/></button>
    </header>
    <div class="account-dialog-body" ref={_element => body.current = _element}>
      {error() && <p class="account-message account-error" id="account-error" role="alert" tabIndex={-1} ref={_element => errorRef.current = _element}><AlertCircle size={18}/>{error()}</p>}
      {success() && <p class="account-message account-success" role="status"><CheckCircle2 size={18}/>{success()}</p>}
      {view() === 'main' ? <>
        <div class="account-identity"><div class="account-avatar" aria-hidden="true">{initials().toUpperCase()}</div><div><h3>{name()}</h3><p>{accountEmail() || 'Email not set'}</p>{studentId() && <p class="account-student-id">Student ID <code>{studentId()}</code></p>}</div></div>
        {wallet() && <div class="account-wallet">{artwork('pay')}<div><span>Wallet address</span><code title={wallet()}>{wallet().slice(0, 6) + '...' + wallet().slice(-4)}</code></div><button type="button" class="account-icon-button" title={copied() ? 'Wallet address copied' : 'Copy wallet address'} aria-label={copied() ? 'Wallet address copied' : 'Copy wallet address'} disabled={copied()} onClick={() => void copyWallet(wallet())}>{copied() ? <Check size={18}/> : <Copy size={18}/>}</button></div>}
        {copied() && <p class="account-copy-status" role="status">Wallet address copied.</p>}
        {copyError() && <p class="account-message account-error" role="alert">{copyError()}</p>}
        <nav class="account-actions" aria-label="Account settings">
          <button type="button" onClick={() => navigate('update-email')}><Mail size={20}/><span>Email address</span><ChevronRight size={18}/></button>
          <button type="button" onClick={() => navigate('update-password')}><LockKeyhole size={20}/><span>Password</span><ChevronRight size={18}/></button>
          <button type="button" onClick={() => navigate('update-info')}><UserRound size={20}/><span>Personal information</span><ChevronRight size={18}/></button>
          <button type="button" class="account-logout" disabled={saving()} onClick={() => void logOut()}>{saving() ? <LoaderCircle class="account-spinner" size={20}/> : <LogOut size={20}/>}<span>{saving() ? 'Logging out...' : 'Log out'}</span></button>
        </nav>
      </> : view() === 'update-info' && (profileLoading() || !profile()) ? <div class="account-load-state">
        {profileLoading() ? <><LoaderCircle size={24} class="account-spinner"/><p role="status">Loading your information...</p></> : <><AlertCircle size={24}/><p role="alert">{profileError() || 'Could not load your information.'}</p><button type="button" class="account-secondary" onClick={() => setRevision(value => value + 1)}>Try again</button></>}
      </div> : <form id="student-account-form" class="account-form" onSubmit={submit} onInput={clearValidation} onChange={clearValidation} noValidate>
        <fieldset disabled={saving() || Boolean(success())}>
          {view() === 'update-password' ? <>
            <PasswordField id="account-current-password" label="Current password" value={currentPassword()} onInput={setCurrentPassword} invalid={invalid().includes('account-current-password')}/>
            <PasswordField id="account-new-password" label="New password" value={newPassword()} onInput={setNewPassword} newPassword invalid={invalid().includes('account-new-password')}/>
            <p class="account-field-hint">At least 8 characters.</p>
            <PasswordField id="account-confirm-password" label="Confirm new password" value={confirmPassword()} onInput={setConfirmPassword} newPassword invalid={invalid().includes('account-confirm-password')}/>
          </> : view() === 'update-email' ? <>
            <div class="account-current-email"><span>Current email</span><p>{accountEmail() || 'Email not set'}</p></div>
            <div class="account-field"><label for="account-new-email">New email address</label><input {...fieldProps('account-new-email')} type="email" autocomplete="email" value={newEmail()} onInput={event => setNewEmail(event.currentTarget.value)} required/></div>
            <div class="account-field"><label for="account-confirm-email">Confirm new email</label><input {...fieldProps('account-confirm-email')} type="email" autocomplete="email" value={confirmEmail()} onInput={event => setConfirmEmail(event.currentTarget.value)} required/></div>
            <PasswordField id="account-email-password" label="Current password" value={emailPassword()} onInput={setEmailPassword} invalid={invalid().includes('account-email-password')}/>
          </> : <>
            <section class="account-form-section"><h3>Contact information</h3><div class="account-field-grid">
              <div class="account-field"><label for="account-phone">Phone number <span>Optional</span></label><input {...fieldProps('account-phone')} type="tel" autocomplete="tel" placeholder="+81 90 1234 5678" value={phoneNumber()} onInput={event => setPhoneNumber(event.currentTarget.value)}/></div>
              <div class="account-field"><label for="account-prefecture">Prefecture in Japan</label><select {...fieldProps('account-prefecture')} value={prefecture()} onChange={event => setPrefecture(event.currentTarget.value)} required><option value="" selected={!prefecture()}>Choose prefecture</option>{JAPANESE_PREFECTURES.map(item => <option value={item} selected={prefecture() === item}>{item}</option>)}</select></div>
            </div></section>
            <section class="account-form-section"><h3>{artwork('training')}Learning preferences</h3>
              <div class="account-field"><label for="account-proficiency">English speaking level</label><select {...fieldProps('account-proficiency')} value={proficiency()} onChange={event => setProficiency(event.currentTarget.value)} required><option value="" selected={!proficiency()}>Choose your level</option>{ENGLISH_LEVELS.map(level => <option value={level.value} selected={proficiency() === level.value}>{level.value + ' - ' + level.label}</option>)}</select>{proficiency() && <p class="account-field-hint">{ENGLISH_LEVELS.find(level => level.value === proficiency())?.description}</p>}</div>
              <div class="account-field"><label for="account-learning-style">Preferred learning style</label><select id="account-learning-style" value={learningStyle()} onChange={event => setLearningStyle(event.currentTarget.value)}><option value="" selected={!learningStyle()}>No preference</option>{styles.map(style => <option value={style} selected={learningStyle() === style}>{style}</option>)}</select></div>
              <fieldset class="account-checkboxes"><legend>Learning goals</legend>{goals.map(goal => <label><input type="checkbox" checked={learningGoals().includes(goal)} onChange={() => setLearningGoals(values => toggle(values, goal))}/><span>{goal}</span></label>)}</fieldset>
            </section>
            <section class="account-form-section"><h3>{artwork('schedule')}Lesson availability</h3><fieldset class="account-checkboxes"><legend class="account-sr-only">Availability for lessons</legend>{times.map(time => <label><input type="checkbox" checked={availability().includes(time)} onChange={() => setAvailability(values => toggle(values, time))}/><span>{time}</span></label>)}</fieldset></section>
          </>}
        </fieldset>
      </form>}
    </div>
    {view() !== 'main' && <footer class="account-dialog-footer">
      {success() ? <button type="button" class="account-primary" onClick={() => navigate('main')}><Check size={17}/>Back to account</button>
                    : <><button type="button" class="account-secondary" disabled={saving()} onClick={() => navigate('main')}>Cancel</button><button type="submit" form="student-account-form" class="account-primary" aria-label={saving() ? 'Saving...' : view() === 'update-password' ? 'Save password' : view() === 'update-email' ? 'Save email' : 'Save changes'} disabled={saving() || (view() === 'update-info' && (!profile() || profileLoading()))}>{saving() ? <><LoaderCircle size={17} class="account-spinner"/>Saving...</> : <><Save size={17}/><span class="account-save-label">{view() === 'update-password' ? 'Save password' : view() === 'update-email' ? 'Save email' : 'Save changes'}</span><span class="account-save-short" aria-hidden="true">Save</span></>}</button></>}
    </footer>}
  </dialog>}</Portal>;
    }) as unknown as JSX.Element;
}
