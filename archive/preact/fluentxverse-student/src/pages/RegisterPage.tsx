import { Eye, EyeOff, LoaderCircle, MessagesSquare, Wallet, UserCheck, Bookmark, Check, CircleCheck, CircleAlert, ArrowRight, ArrowLeft } from 'lucide-preact';

import { useState, useEffect, useCallback } from 'preact/compat';
import Header from '../Components/Header/Header';
import { SocialLoginModal } from '../Components/Auth/SocialLoginModal';

import { register } from '../api/auth.api';
import { useAuthContext } from '../context/AuthContext';
import { getErrorMessage } from '../api/utils';
import './RegisterPage.css';

const RegisterPage = () => {
  const { login, registerByWallet, registerByPrivy, privyProfile } = useAuthContext();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);
  const [tutorId, setTutorId] = useState<string | null>(null);
  const [pendingWallet, setPendingWallet] = useState<string | null>(null);
  const [pendingPrivy, setPendingPrivy] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  
  const [formData, setFormData] = useState({
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
  const [birthParts, setBirthParts] = useState({ year: '', month: '', day: '' });
  const today = new Date();
  const currentYear = today.getFullYear();
  const selectedYear = Number(birthParts.year);
  const selectedMonth = Number(birthParts.month);
  const lastMonth = selectedYear === currentYear ? today.getMonth() + 1 : 12;
  const lastDay = birthParts.year && birthParts.month
    ? selectedYear === currentYear && selectedMonth === today.getMonth() + 1
      ? today.getDate()
      : new Date(selectedYear, selectedMonth, 0).getDate()
    : 0;

  const handleBirthPartChange = (part: 'year' | 'month' | 'day', value: string) => {
    const next = { ...birthParts, [part]: value };
    if (part === 'year' && Number(next.month) > (Number(value) === currentYear ? today.getMonth() + 1 : 12)) {
      next.month = '';
    }
    const maxDay = next.year && next.month
      ? Number(next.year) === currentYear && Number(next.month) === today.getMonth() + 1
        ? today.getDate()
        : new Date(Number(next.year), Number(next.month), 0).getDate()
      : 0;
    if (Number(next.day) > maxDay) next.day = '';
    setBirthParts(next);
    setFormData(previous => ({
      ...previous,
      birthDate: next.year && next.month && next.day
        ? `${next.year}-${next.month.padStart(2, '0')}-${next.day.padStart(2, '0')}`
        : ''
    }));
  };

  useEffect(() => {
    document.title = 'Register | FluentXVerse';
    // Check for pending wallet address from social login
    const walletAddress = localStorage.getItem('fxv_pending_wallet');
    if (walletAddress) {
      setPendingWallet(walletAddress);
    }
    
  }, []);

  useEffect(() => {
    const storedProfile = sessionStorage.getItem('fxv_pending_privy_profile');
    let savedProfile = null;
    try {
      savedProfile = storedProfile ? JSON.parse(storedProfile) : null;
    } catch {
      sessionStorage.removeItem('fxv_pending_privy_profile');
    }
    const profile = privyProfile || savedProfile;
    if (!profile) return;

    setPendingPrivy(true);
    setPendingWallet(null);
    setFormData(previous => ({
      ...previous,
      email: profile.email || previous.email,
      givenName: profile.givenName || previous.givenName,
      familyName: profile.familyName || previous.familyName,
    }));
  }, [privyProfile]);

  // Get tutor ID from URL if booking directly
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tutorIdParam = params.get('tutorId');
    if (tutorIdParam) {
      setTutorId(tutorIdParam);
    }
  }, []);

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
    
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    
    if (isSubmitting) return;
    
    setError(null);
    setIsSubmitting(true);
    
    try {
      if (pendingPrivy) {
        await registerByPrivy({
          email: formData.email,
          givenName: formData.givenName,
          familyName: formData.familyName,
          birthDate: formData.birthDate,
          mobileNumber: formData.mobileNumber,
        });
        sessionStorage.removeItem('fxv_pending_privy_profile');
        setSuccess(true);
        setTimeout(() => {
          window.location.href = tutorId ? `/tutor/${tutorId}` : '/home';
        }, 1500);
      } else if (pendingWallet) {
        // Wallet-based registration (from social login)
        // Get stored signature and message from SIWE flow
        const signature = localStorage.getItem('fxv_pending_signature');
        const message = localStorage.getItem('fxv_pending_message');
        
        if (!signature || !message) {
          throw new Error('Authentication session expired. Please try signing in again.');
        }
        
        await registerByWallet({
          walletAddress: pendingWallet,
          signature,
          message,
          email: formData.email || undefined,
          givenName: formData.givenName,
          familyName: formData.familyName,
          birthDate: formData.birthDate || undefined,
          mobileNumber: formData.mobileNumber || undefined,
        });
        
        // Clear pending wallet data from storage
        localStorage.removeItem('fxv_pending_wallet');
        localStorage.removeItem('fxv_pending_signature');
        localStorage.removeItem('fxv_pending_message');
        localStorage.removeItem('fxv_missing_fields');
        
        setSuccess(true);
        
        // Redirect to tutor profile if booking, otherwise home
        if (tutorId) {
          setTimeout(() => {
            window.location.href = `/tutor/${tutorId}`;
          }, 1500);
        } else {
          setTimeout(() => {
            window.location.href = '/home';
          }, 1500);
        }
      } else {
        // Traditional email/password registration
        const result = await register({
          email: formData.email,
          password: formData.password,
          familyName: formData.familyName,
          givenName: formData.givenName,
          birthDate: formData.birthDate,
          mobileNumber: formData.mobileNumber,
        });
        
        if (result?.success) {
          setSuccess(true);
          try {
            await login(formData.email, formData.password);
          } catch {
            // Cookie already set, proceed
          }
          
          // Redirect to tutor profile if booking, otherwise home
          if (tutorId) {
            setTimeout(() => {
              window.location.href = `/tutor/${tutorId}`;
            }, 1500);
          } else {
            setTimeout(() => {
              window.location.href = '/home';
            }, 1500);
          }
        } else {
          setError('Registration failed. Please try again.');
        }
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string | string[]) => {
    setFormData({ ...formData, [field]: value });
  };

  const toggleLearningGoal = (goal: string) => {
    const current = formData.learningGoals;
    if (current.includes(goal)) {
      handleChange('learningGoals', current.filter(g => g !== goal));
    } else {
      handleChange('learningGoals', [...current, goal]);
    }
  };

  const openLoginModal = useCallback(() => {
    setShowLoginModal(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  const handleLoginSuccess = useCallback(() => {
    window.location.href = '/home';
  }, []);

  const handleNeedsRegistration = useCallback((walletAddress: string) => {
    localStorage.setItem('fxv_pending_wallet', walletAddress);
    closeLoginModal();
  }, [closeLoginModal]);

  const handleIncompleteProfile = useCallback((walletAddress: string, missingFields: string[]) => {
    localStorage.setItem('fxv_pending_wallet', walletAddress);
    localStorage.setItem('fxv_missing_fields', JSON.stringify(missingFields));
    closeLoginModal();
  }, [closeLoginModal]);

  return (
    <>
      <div className="register-container student-registration">
        <Header />
        <div className="register-content">
          {/* Left Side - Why FluentXVerse */}
          {/* Registration form */}
          <div className={`register-right-side ${step === 2 ? 'step-2-active' : ''} ${step === 1 ? 'step-1-active' : ''}`}>
            <div className="register-form-card">
              {pendingWallet && (
                <div className="wallet-connected-banner">
                  <Wallet size={18} aria-hidden="true" />
                  <span>Wallet connected! Complete your profile below.</span>
                </div>
              )}

              {pendingPrivy && (
                <div className="wallet-connected-banner">
                  <UserCheck size={18} aria-hidden="true" />
                  <span>Social account verified. Complete your profile below.</span>
                </div>
              )}
              
              {tutorId && (
                <div className="tutor-booking-banner">
                  <Bookmark size={18} aria-hidden="true" />
                  <span>Complete registration to book your trial lesson</span>
                </div>
              )}
              
              <img className="registration-art" src="/assets/img/home-icons/community-v1.webp" alt="" width="56" height="56" />
              <h2 className="form-title">
                {step === 1 ? 'Create Your Account' : 'Tell Us About Your English Goals'}
              </h2>
              <p className="register-form-intro">
                {step === 1 ? 'Start with your details. Your lessons are just a step away.' : 'Help us shape your learning experience.'}
              </p>
              
              {/* Step Indicator */}
                <div className="step-indicator">
                  <button type="button" className={`register-step ${step === 1 ? 'current' : 'complete'}`} onClick={() => setStep(1)} aria-current={step === 1 ? 'step' : undefined}>
                    <span className="step-dot">{step === 1 ? '1' : <Check size={18} aria-hidden="true" />}</span>
                    <span>Your details</span>
                  </button>

                  <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>

                  <div className={`register-step ${step === 2 ? 'current' : ''}`} aria-current={step === 2 ? 'step' : undefined}>
                    <span className="step-dot">2</span>
                    <span>Learning goals</span>
                  </div>
                </div>

              {/* Success Message */}
              {success && (
                <div className="alert alert-success">
                  <CircleCheck size={18} aria-hidden="true" />
                  Registration successful! {tutorId ? 'Redirecting to tutor profile...' : 'Redirecting...'}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="alert alert-error" role="alert">
                  <CircleAlert size={18} aria-hidden="true" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                  {step === 1 ? (
                    <>
                      {/* Step 1: Student Basic Information */}
                      <div className="form-section step-1-only">
                        <h3 className="section-title">Your details</h3>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label" for="registration-familyName">Family name <span className="required">*</span></label>
                            <input id="registration-familyName" type="text" className="form-input" placeholder="Family name" value={formData.familyName} onChange={(e) => handleChange('familyName', (e.target as HTMLInputElement).value)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label" for="registration-givenName">Given name <span className="required">*</span></label>
                            <input id="registration-givenName" type="text" className="form-input" placeholder="Given name" value={formData.givenName} onChange={(e) => handleChange('givenName', (e.target as HTMLInputElement).value)} required />
                          </div>
                        </div>
                        <div className="form-group register-birth-group">
                          <span className="form-label" id="register-birth-label">Date of birth <span className="required">*</span></span>
                          <div className="register-birth-selects" role="group" aria-labelledby="register-birth-label">
                            <select className="form-select" aria-label="Birth year" value={birthParts.year} onChange={(e) => handleBirthPartChange('year', (e.target as HTMLSelectElement).value)} required>
                              <option value="">Year</option>
                              {Array.from({ length: currentYear - 1899 }, (_, index) => currentYear - index).map(year => <option key={year} value={year}>{year}</option>)}
                            </select>
                            <select className="form-select" aria-label="Birth month" value={birthParts.month} onChange={(e) => handleBirthPartChange('month', (e.target as HTMLSelectElement).value)} required disabled={!birthParts.year}>
                              <option value="">Month</option>
                              {Array.from({ length: lastMonth }, (_, index) => index + 1).map(month => <option key={month} value={month}>{month}</option>)}
                            </select>
                            <select className="form-select" aria-label="Birth day" value={birthParts.day} onChange={(e) => handleBirthPartChange('day', (e.target as HTMLSelectElement).value)} required disabled={!birthParts.month}>
                              <option value="">Day</option>
                              {Array.from({ length: lastDay }, (_, index) => index + 1).map(day => <option key={day} value={day}>{day}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label" for="registration-email">Email <span className={pendingWallet ? '' : 'required'}>{pendingWallet ? '(optional)' : '*'}</span></label>
                            <input id="registration-email"
                              type="email"
                              className="form-input"
                              placeholder="your@email.com"
                              value={formData.email}
                              onChange={(e) => handleChange('email', (e.target as HTMLInputElement).value)}
                              required={!pendingWallet}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label" for="registration-mobileNumber">Phone number <span className={pendingWallet ? '' : 'required'}>{pendingWallet ? '(optional)' : '*'}</span></label>
                            <input id="registration-mobileNumber" type="tel" className="form-input" placeholder="Phone number" value={formData.mobileNumber} onChange={(e) => handleChange('mobileNumber', (e.target as HTMLInputElement).value)} required={!pendingWallet} />
                          </div>
                        </div>
                        {!pendingWallet && !pendingPrivy && (
                          <div className="form-group">
                            <label className="form-label" for="registration-password">Password <span className="required">*</span></label>
                            <div className="password-wrapper">
                              <input id="registration-password" type={showPassword ? 'text' : 'password'} className="form-input" placeholder="At least 6 characters" value={formData.password} onChange={(e) => handleChange('password', (e.target as HTMLInputElement).value)} required minLength={6} />
                              <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <button type="submit" className="btn-primary btn-full">
                        Continue <ArrowRight size={18} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Step 2: ESL-Specific Information */}
                      <div className="form-section step-2-only">
                        <h3 className="section-title">About Your English Learning</h3>
                        <div className="form-row">
                          {/* Native Language field removed for Korean-only platform */}
                          <div className="form-group">
                            <label className="form-label">Current English Level <span className="required">*</span></label>
                            <div className="level-options">
                              {englishLevels.map(level => (
                                <label key={level.value} className="level-option">
                                  <input type="radio" name="englishLevel" value={level.value} checked={formData.englishLevel === level.value} onChange={(e) => handleChange('englishLevel', (e.target as HTMLInputElement).value)} required />
                                  <span className="level-label">{level.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Learning Goals <span className="form-hint-inline">(Select all that apply)</span></label>
                          <div className="goal-chips">
                            {learningGoalOptions.map(goal => (
                              <label key={goal} className="goal-option"><input type="checkbox" checked={formData.learningGoals.includes(goal)} onChange={() => toggleLearningGoal(goal)} />{goal}</label>
                            ))}
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label" for="registration-preferredLessonTime">Preferred Lesson Time</label>
                            <select id="registration-preferredLessonTime" className="form-select" value={formData.preferredLessonTime} onChange={(e) => handleChange('preferredLessonTime', (e.target as HTMLSelectElement).value)}>
                              <option value="">Select preferred time</option>
                              {lessonTimeOptions.map(time => (
                                <option key={time.value} value={time.value}>{time.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label" for="registration-referral">Referral Code</label>
                            <input id="registration-referral" type="text" className="form-input" placeholder="Referral code (optional)" value={formData.referral} onChange={(e) => handleChange('referral', (e.target as HTMLInputElement).value)} />
                          </div>
                        </div>
                      </div>

                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setStep(1)}
                        >
                          <ArrowLeft size={18} aria-hidden="true" /> Back
                        </button>
                        <button type="submit" className="btn-primary" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <LoaderCircle size={18} /> Creating Account...
                            </>
                          ) : (
                            <>
                              {pendingWallet || pendingPrivy ? 'Complete profile' : 'Create account'} <Check size={18} aria-hidden="true" />
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
              </form>

              {step === 1 && (
                <div className="form-footer">
                  Already have an account?{' '}
                  <button type="button" className="form-footer-link" onClick={openLoginModal}>
                    Sign in
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <SocialLoginModal
        isOpen={showLoginModal}
        onClose={closeLoginModal}
        onSuccess={handleLoginSuccess}
        onNeedsRegistration={handleNeedsRegistration}
        onIncompleteProfile={handleIncompleteProfile}
      />
    </>
  );
};

export default RegisterPage;
