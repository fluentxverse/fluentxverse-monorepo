
import { useState, useEffect } from 'preact/compat';
import { useLocation } from 'preact-iso';
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import { register } from '../api/auth.api';
import { useAuthContext } from '../context/AuthContext';
import './RegisterPage.css';

const RegisterPage = () => {
  useEffect(() => {
    document.title = 'Register | FluentXVerse';
  }, []);

  const { route } = useLocation();
  const { user, login } = useAuthContext();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);
  const [tutorId, setTutorId] = useState<string | null>(null);
  
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
      // Map form data to match server schema
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
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
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

  return (
    <>
      <div className="register-container">
        <Header />
        <div className="register-content">
          {/* Left Side - Why FluentXVerse */}
          <div className="register-left-side register-bg-image">
            <div className="left-content">
              <h2 className="left-subtitle">WELCOME TO FLUENTXVERSE</h2>
              <h1 className="left-title">Start Your English Journey</h1>
              <p className="left-intro">
                FluentXVerse is designed for students who want to improve their English skills with friendly, expert tutors. Sign up to access interactive lessons, flexible schedules, and real progress. Your path to confident English starts here!
              </p>
              <div className="features-list">
                {[ 
                  { icon: 'fas fa-user-graduate', title: 'For Korean Learners', desc: 'Tailored lessons and support for Korean students of all ages.' },
                  { icon: 'fas fa-chalkboard-teacher', title: 'Expert Tutors', desc: 'Learn from experienced, caring English teachers.' },
                  { icon: 'fas fa-clock', title: 'Flexible Scheduling', desc: 'Book lessons that fit your school and family life.' },
                  { icon: 'fas fa-mobile-alt', title: 'Easy Access', desc: 'Join lessons from home or anywhere, on any device.' },
                  { icon: 'fas fa-comments', title: 'Real Conversation', desc: 'Practice speaking and listening in every session.' }
                ].map((item, idx) => (
                  <div key={idx} className="feature-item">
                    <div className="feature-icon-circle">
                      <i className={`${item.icon} feature-icon`}></i>
                    </div>
                    <div className="feature-copy">
                      <div className="feature-title">{item.title}</div>
                      <div className="feature-desc">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="left-cta">
                Ready to learn? Fill out the form to begin!
              </div>
            </div>
          </div>

          {/* Right Side - Registration Form */}
          <div className={`register-right-side ${step === 2 ? 'step-2-active' : ''} ${step === 1 ? 'step-1-active' : ''}`}>
            <div className="register-form-card">
              {tutorId && (
                <div className="tutor-booking-banner">
                  <i className="ri-bookmark-line"></i>
                  <span>Complete registration to book your trial lesson</span>
                </div>
              )}
              
              <h2 className="form-title">
                {step === 1 ? 'Create Your Account' : 'Tell Us About Your English Goals'}
              </h2>
              
              {/* Step Indicator */}
                <div className="step-indicator">
                  {/* Step 1 dot - allow click to go back to step 1 */}
                  <div
                    role="button"
                    tabIndex={0}
                    className={`step-dot ${step === 1 ? 'active' : ''} ${step === 2 ? 'gray' : ''}`}
                    onClick={() => setStep(1)}
                    onKeyDown={(e) => { if ((e as unknown as KeyboardEvent).key === 'Enter') setStep(1); }}
                    aria-label="Go to step 1"
                  >
                    {step === 1 ? '1' : (step === 2 ? '1' : <i className="ri-check-line"></i>)}
                  </div>

                  <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>

                  {/* Step 2 dot - click to jump to step 2 */}
                  <div
                    role="button"
                    tabIndex={0}
                    className={`step-dot ${step === 2 ? 'active' : ''}`}
                    onClick={() => setStep(2)}
                    onKeyDown={(e) => { if ((e as unknown as KeyboardEvent).key === 'Enter') setStep(2); }}
                    aria-label="Go to step 2"
                  >
                    2
                  </div>
                </div>

              {/* Success Message */}
              {success && (
                <div className="alert alert-success">
                  <i className="ri-check-circle-line"></i>
                  Registration successful! {tutorId ? 'Redirecting to tutor profile...' : 'Redirecting...'}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="alert alert-error">
                  <i className="ri-error-warning-line"></i>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                  {step === 1 ? (
                    <>
                      {/* Step 1: Student Basic Information */}
                      <div className="form-section step-1-only">
                        <h3 className="section-title">학생 정보</h3>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">성 (Family Name) <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="예: 김" value={formData.familyName} onChange={(e) => handleChange('familyName', (e.target as HTMLInputElement).value)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">이름 (Given Name) <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="예: 민수" value={formData.givenName} onChange={(e) => handleChange('givenName', (e.target as HTMLInputElement).value)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">생년월일 <span className="required">*</span></label>
                            <input type="date" className="form-input" value={formData.birthDate} onChange={(e) => handleChange('birthDate', (e.target as HTMLInputElement).value)} required max={new Date().toISOString().split('T')[0]} />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">이메일 <span className="required">*</span></label>
                            <input type="email" className="form-input" placeholder="your@email.com" value={formData.email} onChange={(e) => handleChange('email', (e.target as HTMLInputElement).value)} required />
                          </div>
                          <div className="form-group">
                            <label className="form-label">휴대폰 번호 <span className="required">*</span></label>
                            <input type="tel" className="form-input" placeholder="예: 010-1234-5678" value={formData.mobileNumber} onChange={(e) => handleChange('mobileNumber', (e.target as HTMLInputElement).value)} required />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">비밀번호 <span className="required">*</span></label>
                          <div className="password-wrapper">
                            <input type={showPassword ? 'text' : 'password'} className="form-input" placeholder="최소 6자" value={formData.password} onChange={(e) => handleChange('password', (e.target as HTMLInputElement).value)} required minLength={6} />
                            <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                              <i className={`ri-eye-${showPassword ? 'off' : ''}-line`}></i>
                            </button>
                          </div>
                        </div>
                      </div>
                      <button type="submit" className="btn-primary btn-full">
                        계속하기 <i className="ri-arrow-right-line"></i>
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
                              <button key={goal} type="button" className={`chip ${formData.learningGoals.includes(goal) ? 'active' : ''}`} onClick={() => toggleLearningGoal(goal)}>
                                {formData.learningGoals.includes(goal) && <i className="ri-check-line"></i>}
                                {goal}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">Preferred Lesson Time</label>
                            <select className="form-select" value={formData.preferredLessonTime} onChange={(e) => handleChange('preferredLessonTime', (e.target as HTMLSelectElement).value)}>
                              <option value="">Select preferred time</option>
                              {lessonTimeOptions.map(time => (
                                <option key={time.value} value={time.value}>{time.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Referral Code</label>
                            <input type="text" className="form-input" placeholder="Referral code (optional)" value={formData.referral} onChange={(e) => handleChange('referral', (e.target as HTMLInputElement).value)} />
                          </div>
                        </div>
                      </div>

                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setStep(1)}
                        >
                          <i className="ri-arrow-left-line"></i> Back
                        </button>
                        <button type="submit" className="btn-primary" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <i className="ri-loader-4-line rotating"></i> Creating Account...
                            </>
                          ) : (
                            <>
                              Complete Registration <i className="ri-check-line"></i>
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
              </form>

              {step === 1 && (
                <div className="form-footer">
                  Already have an account? <a href="/login">Sign in</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RegisterPage;
