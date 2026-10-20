import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { Eye, EyeOff, LoaderCircle, MessagesSquare, Wallet, UserCheck, Bookmark, Check, CircleCheck, CircleAlert, ArrowRight, ArrowLeft } from "lucide-solid";
import Header from '../Components/Header/Header';
import { SocialLoginModal } from '../Components/Auth/SocialLoginModal';
import { register } from '../api/auth.api';
import { useAuthContext } from '../context/AuthContext';
import { getErrorMessage } from '../api/utils';
import './RegisterPage.css';
const RegisterPage = () => {
    const _state0 = useAuthContext();
    const [showPassword, setShowPassword] = createSignal(false);
    const [isSubmitting, setIsSubmitting] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [success, setSuccess] = createSignal(false);
    const [step, setStep] = createSignal(1);
    const [tutorId, setTutorId] = createSignal<string | null>(null);
    const [pendingWallet, setPendingWallet] = createSignal<string | null>(null);
    const [pendingPrivy, setPendingPrivy] = createSignal(false);
    const [showLoginModal, setShowLoginModal] = createSignal(false);
    const [formData, setFormData] = createSignal({
        familyName: '',
        givenName: '',
        birthDate: '',
        email: '',
        mobileNumber: '',
        password: '',
        // ...existing code for step 2 fields if needed
        nativeLanguage: '',
        englishLevel: '',
        learningGoals: [] as string[],
        preferredLessonTime: '',
        referral: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    const [birthParts, setBirthParts] = createSignal({ year: '', month: '', day: '' });
    const today = new Date();
    const currentYear = today.getFullYear();
    const selectedYear = createMemo(() => Number(birthParts().year));
    const selectedMonth = createMemo(() => Number(birthParts().month));
    const lastMonth = createMemo(() => selectedYear() === currentYear ? today.getMonth() + 1 : 12);
    const lastDay = createMemo(() => birthParts().year && birthParts().month
        ? selectedYear() === currentYear && selectedMonth() === today.getMonth() + 1
            ? today.getDate()
            : new Date(selectedYear(), selectedMonth(), 0).getDate()
        : 0);
    const handleBirthPartChange = (part: 'year' | 'month' | 'day', value: string) => {
        const next = { ...birthParts(), [part]: value };
        if (part === 'year' && Number(next.month) > (Number(value) === currentYear ? today.getMonth() + 1 : 12)) {
            next.month = '';
        }
        const maxDay = next.year && next.month
            ? Number(next.year) === currentYear && Number(next.month) === today.getMonth() + 1
                ? today.getDate()
                : new Date(Number(next.year), Number(next.month), 0).getDate()
            : 0;
        if (Number(next.day) > maxDay)
            next.day = '';
        setBirthParts(next);
        setFormData(previous => ({
            ...previous,
            birthDate: next.year && next.month && next.day
                ? `${next.year}-${next.month.padStart(2, '0')}-${next.day.padStart(2, '0')}`
                : ''
        }));
    };
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            document.title = 'Register | FluentXVerse';
            // Check for pending wallet address from social login
            const walletAddress = localStorage.getItem('fxv_pending_wallet');
            if (walletAddress) {
                setPendingWallet(walletAddress);
            }
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [_state0.privyProfile], () => {
        const _cleanup2 = untrack(() => {
            const storedProfile = sessionStorage.getItem('fxv_pending_privy_profile');
            let savedProfile = null;
            try {
                savedProfile = storedProfile ? JSON.parse(storedProfile) : null;
            }
            catch {
                sessionStorage.removeItem('fxv_pending_privy_profile');
            }
            const profile = _state0.privyProfile || savedProfile;
            if (!profile)
                return;
            setPendingPrivy(true);
            setPendingWallet(null);
            setFormData(previous => ({
                ...previous,
                email: profile.email || previous.email,
                givenName: profile.givenName || previous.givenName,
                familyName: profile.familyName || previous.familyName
            }));
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    // Get tutor ID from URL if booking directly
    createEffect(on(() => [], () => {
        const _cleanup3 = untrack(() => {
            const params = new URLSearchParams(window.location.search);
            const tutorIdParam = params.get('tutorId');
            if (tutorIdParam) {
                setTutorId(tutorIdParam);
            }
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const englishLevels = [
        { value: 'beginner', label: 'Beginner - Just starting' },
        { value: 'elementary', label: 'Elementary - Basic phrases' },
        { value: 'intermediate', label: 'Intermediate - Comfortable conversations' },
        { value: 'upper-intermediate', label: 'Upper Intermediate - Fluent in most situations' },
        { value: 'advanced', label: 'Advanced - Near native level' }
    ];
    const learningGoalOptions = [
        'Business English',
        'Conversational Skills',
        'Job Interview Preparation',
        'Travel English',
        'Academic English',
        'Pronunciation',
        'Grammar Improvement',
        'Vocabulary Building'
    ];
    const lessonTimeOptions = [
        { value: 'morning', label: 'Morning (6:00 - 12:00)' },
        { value: 'afternoon', label: 'Afternoon (12:00 - 18:00)' },
        { value: 'evening', label: 'Evening (18:00 - 24:00)' },
        { value: 'flexible', label: 'Flexible' }
    ];
    const handleSubmit = async (e: any) => {
        e.preventDefault();
        if (step() < 2) {
            setStep(step() + 1);
            return;
        }
        if (isSubmitting())
            return;
        setError(null);
        setIsSubmitting(true);
        try {
            if (pendingPrivy()) {
                await _state0.registerByPrivy({
                    get email() {
                        return formData().email;
                    },
                    get givenName() {
                        return formData().givenName;
                    },
                    get familyName() {
                        return formData().familyName;
                    },
                    get birthDate() {
                        return formData().birthDate;
                    },
                    get mobileNumber() {
                        return formData().mobileNumber;
                    }
                });
                sessionStorage.removeItem('fxv_pending_privy_profile');
                setSuccess(true);
                setTimeout(() => {
                    window.location.href = tutorId() ? `/tutor/${tutorId()}` : '/home';
                }, 1500);
            }
            else if (pendingWallet()) {
                // Wallet-based registration (from social login)
                // Get stored signature and message from SIWE flow
                const signature = localStorage.getItem('fxv_pending_signature');
                const message = localStorage.getItem('fxv_pending_message');
                if (!signature || !message) {
                    throw new Error('Authentication session expired. Please try signing in again.');
                }
                await _state0.registerByWallet({
                    get walletAddress() {
                        return pendingWallet();
                    },
                    signature,
                    message,
                    get email() {
                        return formData().email || undefined;
                    },
                    get givenName() {
                        return formData().givenName;
                    },
                    get familyName() {
                        return formData().familyName;
                    },
                    get birthDate() {
                        return formData().birthDate || undefined;
                    },
                    get mobileNumber() {
                        return formData().mobileNumber || undefined;
                    }
                });
                // Clear pending wallet data from storage
                localStorage.removeItem('fxv_pending_wallet');
                localStorage.removeItem('fxv_pending_signature');
                localStorage.removeItem('fxv_pending_message');
                localStorage.removeItem('fxv_missing_fields');
                setSuccess(true);
                // Redirect to tutor profile if booking, otherwise home
                if (tutorId()) {
                    setTimeout(() => {
                        window.location.href = `/tutor/${tutorId()}`;
                    }, 1500);
                }
                else {
                    setTimeout(() => {
                        window.location.href = '/home';
                    }, 1500);
                }
            }
            else {
                // Traditional email/password registration
                const result = await register({
                    get email() {
                        return formData().email;
                    },
                    get password() {
                        return formData().password;
                    },
                    get familyName() {
                        return formData().familyName;
                    },
                    get givenName() {
                        return formData().givenName;
                    },
                    get birthDate() {
                        return formData().birthDate;
                    },
                    get mobileNumber() {
                        return formData().mobileNumber;
                    }
                });
                if (result?.success) {
                    setSuccess(true);
                    try {
                        await _state0.login(formData().email, formData().password);
                    }
                    catch {
                        // Cookie already set, proceed
                    }
                    // Redirect to tutor profile if booking, otherwise home
                    if (tutorId()) {
                        setTimeout(() => {
                            window.location.href = `/tutor/${tutorId()}`;
                        }, 1500);
                    }
                    else {
                        setTimeout(() => {
                            window.location.href = '/home';
                        }, 1500);
                    }
                }
                else {
                    setError('Registration failed. Please try again.');
                }
            }
        }
        catch (err: any) {
            setError(getErrorMessage(err));
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleChange = (field: string, value: string | string[]) => {
        setFormData({ ...formData(), [field]: value });
    };
    const toggleLearningGoal = (goal: string) => {
        const current = formData().learningGoals;
        if (current.includes(goal)) {
            handleChange('learningGoals', current.filter(g => g !== goal));
        }
        else {
            handleChange('learningGoals', [...current, goal]);
        }
    };
    const openLoginModal = createMemo(on(() => [], () => () => {
        setShowLoginModal(true);
    }));
    const closeLoginModal = createMemo(on(() => [], () => () => {
        setShowLoginModal(false);
    }));
    const handleLoginSuccess = createMemo(on(() => [], () => () => {
        window.location.href = '/home';
    }));
    const handleNeedsRegistration = createMemo(on(() => [closeLoginModal()], () => (walletAddress: string) => {
        localStorage.setItem('fxv_pending_wallet', walletAddress);
        closeLoginModal()();
    }));
    const handleIncompleteProfile = createMemo(on(() => [closeLoginModal()], () => (walletAddress: string, missingFields: string[]) => {
        localStorage.setItem('fxv_pending_wallet', walletAddress);
        localStorage.setItem('fxv_missing_fields', JSON.stringify(missingFields));
        closeLoginModal()();
    }));
    return (<>
      <div class="register-container student-registration">
        <Header />
        <div class="register-content">
          {/* Left Side - Why FluentXVerse */}
          {/* Registration form */}
          <div class={`register-right-side ${step() === 2 ? 'step-2-active' : ''} ${step() === 1 ? 'step-1-active' : ''}`}>
            <div class="register-form-card">
              {pendingWallet() && (<div class="wallet-connected-banner">
                  <Wallet size={18} aria-hidden="true"/>
                  <span>Wallet connected! Complete your profile below.</span>
                </div>)}

              {pendingPrivy() && (<div class="wallet-connected-banner">
                  <UserCheck size={18} aria-hidden="true"/>
                  <span>Social account verified. Complete your profile below.</span>
                </div>)}
              
              {tutorId() && (<div class="tutor-booking-banner">
                  <Bookmark size={18} aria-hidden="true"/>
                  <span>Complete registration to book your trial lesson</span>
                </div>)}
              
              <img class="registration-art" src="/assets/img/home-icons/profile-v1.webp" alt="" width="56" height="56"/>
              <h2 class="form-title">
                {step() === 1 ? 'Create Your Account' : 'Tell Us About Your English Goals'}
              </h2>
              <p class="register-form-intro">
                {step() === 1 ? 'Start with your details. Your lessons are just a step away.' : 'Help us shape your learning experience.'}
              </p>
              
              {/* Step Indicator */}
                <div class="step-indicator">
                  <button type="button" class={`register-step ${step() === 1 ? 'current' : 'complete'}`} onClick={() => setStep(1)} aria-current={step() === 1 ? 'step' : undefined}>
                    <span class="step-dot">{step() === 1 ? '1' : <Check size={18} aria-hidden="true"/>}</span>
                    <span>Your details</span>
                  </button>

                  <div class={`step-line ${step() >= 2 ? 'active' : ''}`}></div>

                  <div class={`register-step ${step() === 2 ? 'current' : ''}`} aria-current={step() === 2 ? 'step' : undefined}>
                    <span class="step-dot">2</span>
                    <span>Learning goals</span>
                  </div>
                </div>

              {/* Success Message */}
              {success() && (<div class="alert alert-success">
                  <CircleCheck size={18} aria-hidden="true"/>
                  Registration successful! {tutorId() ? 'Redirecting to tutor profile...' : 'Redirecting...'}
                </div>)}

              {/* Error Message */}
              {error() && (<div class="alert alert-error" role="alert">
                  <CircleAlert size={18} aria-hidden="true"/>
                  {error()}
                </div>)}

              <form onSubmit={handleSubmit}>
                  {step() === 1 ? (<>
                      {/* Step 1: Student Basic Information */}
                      <div class="form-section step-1-only">
                        <h3 class="section-title">Your details</h3>
                        <div class="form-row">
                          <div class="form-group">
                            <label class="form-label" for="registration-familyName">Family name <span class="required">*</span></label>
                            <input id="registration-familyName" type="text" class="form-input" placeholder="Family name" value={formData().familyName} onInput={(e) => handleChange('familyName', (e.target as HTMLInputElement).value)} required/>
                          </div>
                          <div class="form-group">
                            <label class="form-label" for="registration-givenName">Given name <span class="required">*</span></label>
                            <input id="registration-givenName" type="text" class="form-input" placeholder="Given name" value={formData().givenName} onInput={(e) => handleChange('givenName', (e.target as HTMLInputElement).value)} required/>
                          </div>
                        </div>
                        <div class="form-group register-birth-group">
                          <span class="form-label" id="register-birth-label">Date of birth <span class="required">*</span></span>
                          <div class="register-birth-selects" role="group" aria-labelledby="register-birth-label">
                            <select class="form-select" aria-label="Birth year" value={birthParts().year} onChange={(e) => handleBirthPartChange('year', (e.target as HTMLSelectElement).value)} required>
                              <option value="">Year</option>
                              {Array.from({ length: currentYear - 1899 }, (_, index) => currentYear - index).map(year => <option value={year}>{year}</option>)}
                            </select>
                            <select class="form-select" aria-label="Birth month" value={birthParts().month} onChange={(e) => handleBirthPartChange('month', (e.target as HTMLSelectElement).value)} required disabled={!birthParts().year}>
                              <option value="">Month</option>
                              {Array.from({ get length() {
                return lastMonth();
            } }, (_, index) => index + 1).map(month => <option value={month}>{month}</option>)}
                            </select>
                            <select class="form-select" aria-label="Birth day" value={birthParts().day} onChange={(e) => handleBirthPartChange('day', (e.target as HTMLSelectElement).value)} required disabled={!birthParts().month}>
                              <option value="">Day</option>
                              {Array.from({ get length() {
                return lastDay();
            } }, (_, index) => index + 1).map(day => <option value={day}>{day}</option>)}
                            </select>
                          </div>
                        </div>
                        <div class="form-row">
                          <div class="form-group">
                            <label class="form-label" for="registration-email">Email <span class={pendingWallet() ? '' : 'required'}>{pendingWallet() ? '(optional)' : '*'}</span></label>
                            <input id="registration-email" type="email" class="form-input" placeholder="your@email.com" value={formData().email} onInput={(e) => handleChange('email', (e.target as HTMLInputElement).value)} required={!pendingWallet()}/>
                          </div>
                          <div class="form-group">
                            <label class="form-label" for="registration-mobileNumber">Phone number <span class={pendingWallet() ? '' : 'required'}>{pendingWallet() ? '(optional)' : '*'}</span></label>
                            <input id="registration-mobileNumber" type="tel" class="form-input" placeholder="Phone number" value={formData().mobileNumber} onInput={(e) => handleChange('mobileNumber', (e.target as HTMLInputElement).value)} required={!pendingWallet()}/>
                          </div>
                        </div>
                        {!pendingWallet() && !pendingPrivy() && (<div class="form-group">
                            <label class="form-label" for="registration-password">Password <span class="required">*</span></label>
                            <div class="password-wrapper">
                              <input id="registration-password" type={showPassword() ? 'text' : 'password'} class="form-input" placeholder="At least 6 characters" value={formData().password} onInput={(e) => handleChange('password', (e.target as HTMLInputElement).value)} required minLength={6}/>
                              <button type="button" class="password-toggle" aria-label={showPassword() ? 'Hide password' : 'Show password'} title={showPassword() ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword())}>
                                {showPassword() ? <EyeOff size={18}/> : <Eye size={18}/>}
                              </button>
                            </div>
                          </div>)}
                      </div>
                      <button type="submit" class="btn-primary btn-full">
                        Continue <ArrowRight size={18} aria-hidden="true"/>
                      </button>
                    </>) : (<>
                      {/* Step 2: ESL-Specific Information */}
                      <div class="form-section step-2-only">
                        <h3 class="section-title">About Your English Learning</h3>
                        <div class="form-row">
                          {/* Native Language field removed for Korean-only platform */}
                          <div class="form-group">
                            <label class="form-label">Current English Level <span class="required">*</span></label>
                            <div class="level-options">
                              {englishLevels.map(level => (<label class="level-option">
                                  <input type="radio" name="englishLevel" value={level.value} checked={formData().englishLevel === level.value} onChange={(e) => handleChange('englishLevel', (e.target as HTMLInputElement).value)} required/>
                                  <span class="level-label">{level.label}</span>
                                </label>))}
                            </div>
                          </div>
                        </div>
                        <div class="form-group">
                          <label class="form-label">Learning Goals <span class="form-hint-inline">(Select all that apply)</span></label>
                          <div class="goal-chips">
                            {learningGoalOptions.map(goal => (<label class="goal-option"><input type="checkbox" checked={formData().learningGoals.includes(goal)} onChange={() => toggleLearningGoal(goal)}/>{goal}</label>))}
                          </div>
                        </div>
                        <div class="form-row">
                          <div class="form-group">
                            <label class="form-label" for="registration-preferredLessonTime">Preferred Lesson Time</label>
                            <select id="registration-preferredLessonTime" class="form-select" value={formData().preferredLessonTime} onChange={(e) => handleChange('preferredLessonTime', (e.target as HTMLSelectElement).value)}>
                              <option value="">Select preferred time</option>
                              {lessonTimeOptions.map(time => (<option value={time.value}>{time.label}</option>))}
                            </select>
                          </div>
                          <div class="form-group">
                            <label class="form-label" for="registration-referral">Referral Code</label>
                            <input id="registration-referral" type="text" class="form-input" placeholder="Referral code (optional)" value={formData().referral} onInput={(e) => handleChange('referral', (e.target as HTMLInputElement).value)}/>
                          </div>
                        </div>
                      </div>

                      <div class="form-actions">
                        <button type="button" class="btn-secondary" onClick={() => setStep(1)}>
                          <ArrowLeft size={18} aria-hidden="true"/> Back
                        </button>
                        <button type="submit" class="btn-primary" disabled={isSubmitting()}>
                          {isSubmitting() ? (<>
                              <LoaderCircle size={18}/> Creating Account...
                            </>) : (<>
                              {pendingWallet() || pendingPrivy() ? 'Complete profile' : 'Create account'} <Check size={18} aria-hidden="true"/>
                            </>)}
                        </button>
                      </div>
                    </>)}
              </form>

              {step() === 1 && (<div class="form-footer">
                  Already have an account?{' '}
                  <button type="button" class="form-footer-link" onClick={openLoginModal()}>
                    Sign in
                  </button>
                </div>)}
            </div>
          </div>
        </div>
      </div>

      <SocialLoginModal isOpen={showLoginModal()} onClose={closeLoginModal()} onSuccess={handleLoginSuccess()} onNeedsRegistration={handleNeedsRegistration()} onIncompleteProfile={handleIncompleteProfile()}/>
    </>);
};
export default RegisterPage;
