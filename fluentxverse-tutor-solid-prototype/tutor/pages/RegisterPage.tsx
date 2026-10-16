import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorArt from "../Components/Common/TutorArt";
import TutorIcon from "../Components/Common/TutorIcon";
import { useLocation } from "../routing";
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import { register } from '../api/auth.api';
import { useAuthContext } from '../context/AuthContext';
import { getErrorMessage } from '../api/utils';
import './RegisterPage.css';
const RegisterPage = () => {
    // Ref-based guard to prevent double-submit (survives re-renders)
    const submitInProgressRef = { current: false } as {
        current: any;
    };
    const _state0 = useAuthContext();
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            document.title = 'Register | FluentXVerse';
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const _state1 = useLocation();
    const [showPassword, setShowPassword] = createSignal(false);
    const [isSubmitting, setIsSubmitting] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [success, setSuccess] = createSignal(false);
    const [formData, setFormData] = createSignal({
        firstName: '',
        middleName: '',
        lastName: '',
        suffix: '',
        dateOfBirth: '',
        mobile: '',
        email: '',
        password: ''
    });
    const handleSubmit = async (e: any) => {
        e.preventDefault();
        // Double-guard: both state and ref to prevent race conditions
        if (isSubmitting() || submitInProgressRef.current)
            return;
        submitInProgressRef.current = true;
        setError(null);
        setIsSubmitting(true);
        try {
            // Map form data to match server schema
            // Ensure all values are strings to avoid schema validation errors
            const payload = {
                get email() {
                    return String(formData().email || '').trim();
                },
                get password() {
                    return String(formData().password || '');
                },
                get firstName() {
                    return String(formData().firstName || '').trim();
                },
                get middleName() {
                    return String(formData().middleName || '').trim();
                },
                get lastName() {
                    return String(formData().lastName || '').trim();
                },
                get suffix() {
                    return String(formData().suffix || '').trim();
                },
                get birthDate() {
                    return String(formData().dateOfBirth || '');
                },
                get mobileNumber() {
                    return String(formData().mobile || '').trim();
                }
            };
            const result = await register(payload);
            // Server returns { success, message, user }
            if (result?.success && result?.user) {
                setSuccess(true);
                // Cookie is already set server-side during registration.
                // Set the user in AuthContext so the app knows we're logged in
                _state0.setUserFromRegistration(result.user);
                // Use replace to prevent back-button returning to register form
                window.location.replace('/home');
            }
            else {
                // Server returned success: false with a message
                setError(result?.message || 'Registration failed. Please try again.');
                submitInProgressRef.current = false;
            }
        }
        catch (err: any) {
            // Use friendly error message utility
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            submitInProgressRef.current = false;
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleChange = (field: string, value: string) => {
        setFormData({ ...formData(), [field]: value });
    };
    return (<>
      <div class="register-container">
        <Header />
        <div class="register-content">
          {/* Left Side - Why FluentXVerse */}
          <div class="register-left-side">
            {/* Decorative circles */}
            <div class="decorative-circle-top"></div>
            <div class="decorative-circle-bottom"></div>

            <div class="left-content">
              <h2 class="left-subtitle">
                THE DIFFERENCE
              </h2>
              <h1 class="left-title">
                Why Choose FluentXVerse?
              </h1>
              <p class="left-intro">
                A supportive space for tutors to teach confidently, grow steadily,
                and make real impact with learners around the world.
              </p>

              <div class="features-list">
                {[
            { icon: 'fas fa-chart-line', title: 'Growing with momentum', desc: 'Join an ambitious platform that improves and expands every month.' },
            { icon: 'fas fa-users', title: 'Engaged learners', desc: 'Teach active students who regularly book, learn, and progress.' },
            { icon: 'fas fa-calendar-alt', title: 'Truly flexible time', desc: 'Open slots that fit your day and manage your time with ease.' },
            { icon: 'fas fa-book', title: 'Original materials', desc: 'Use clear, purpose‑built lessons designed by our own team.' },
            { icon: 'fas fa-headset', title: 'Responsive support', desc: 'Get fast help when you need it, technical or teaching‑related.' },
            { icon: 'fas fa-star', title: 'Room to grow', desc: 'Unlock more opportunities as you build consistency and quality.' }
        ].map((item, idx) => (<div class="feature-item">
                    <div class="feature-icon-circle">
                      <TutorArt name={(["growth", "community", "schedule", "training", "community", "growth"] as const)[idx]} size={44}/>
                    </div>
                    <div class="feature-copy">
                      <div class="feature-title">{item.title}</div>
                      <div class="feature-desc">{item.desc}</div>
                    </div>
                  </div>))}
              </div>
              <div class="left-cta">
                Teach on your terms • Earn reliably • Grow your craft
              </div>
            </div>
          </div>

          {/* Right Side - Registration Form */}
          <div class="register-right-side">
            <div class="register-form-card">
              <TutorArt name="community" size={48}/>
              <h2 class="form-title">
                Registration
              </h2>
              <p class="form-description">
                We encourage you to use your computer instead of mobile device to sign up. Please enter your complete name including your middle name (if applicable) as reflected on your valid ID.
              </p>

              {/* Success Message */}
              {success() && (<div class="alert alert-success">
                  <TutorIcon name="fas fa-check-circle"/>
                  Registration successful! Redirecting to login...
                </div>)}

              {/* Error Message */}
              {error() && (<div class="alert alert-error">
                  <TutorIcon name="fas fa-exclamation-circle"/>
                  {error()}
                </div>)}

              <form onSubmit={handleSubmit}>
            {/* Name Fields Row */}
            <div class="name-fields-row">
              <div>
                <label class="form-label">
                  FIRST NAME <span class="required-asterisk">*</span>
                </label>
                <input type="text" class="form-input" placeholder="First Name" value={formData().firstName} onInput={(e) => handleChange('firstName', (e.target as HTMLInputElement).value)} required/>
              </div>

              <div>
                <label class="form-label">
                  MIDDLE NAME <span class="required-asterisk">*</span>
                </label>
                <input type="text" class="form-input" placeholder="Middle Name" value={formData().middleName} onInput={(e) => handleChange('middleName', (e.target as HTMLInputElement).value)} required/>
              </div>

              <div>
                <label class="form-label">
                  LAST NAME <span class="required-asterisk">*</span>
                </label>
                <input type="text" class="form-input" placeholder="Last Name" value={formData().lastName} onInput={(e) => handleChange('lastName', (e.target as HTMLInputElement).value)} required/>
              </div>

              <div>
                <label class="form-label">
                  SUFFIX
                </label>
                <input type="text" class="form-input" placeholder="jr, sr, etc" value={formData().suffix} onInput={(e) => handleChange('suffix', (e.target as HTMLInputElement).value)}/>
              </div>
            </div>

            {/* Date of Birth and Mobile Row */}
            <div class="two-column-row">
              <div>
                <label class="form-label">
                  DATE OF BIRTH <span class="required-asterisk">*</span>
                </label>
                <div class="input-wrapper">
                  <TutorIcon name="fas fa-calendar input-icon"/>
                  <input type="date" class="form-input-with-icon" placeholder="yyyy-mm-dd" value={formData().dateOfBirth} onInput={(e) => handleChange('dateOfBirth', (e.target as HTMLInputElement).value)} required/>
                </div>
              </div>

              <div>
                <label class="form-label">
                  MOBILE / VIBER NUMBER <span class="required-asterisk">*</span>
                </label>
                <div class="input-wrapper">
                  <TutorIcon name="fas fa-mobile-alt input-icon"/>
                  <input type="tel" class="form-input-with-icon" placeholder="09xxxxxxxxx" value={formData().mobile} onInput={(e) => handleChange('mobile', (e.target as HTMLInputElement).value)} required/>
                </div>
              </div>
            </div>

            {/* Email Field */}
            <div class="form-group">
              <label class="form-label">
                EMAIL ADDRESS <span class="required-asterisk">*</span>
              </label>
              <div class="input-wrapper">
                <TutorIcon name="fas fa-envelope input-icon"/>
                <input type="email" class="form-input-with-icon" placeholder="example: juandelacruz@gmail.com" value={formData().email} onInput={(e) => handleChange('email', (e.target as HTMLInputElement).value)} required/>
              </div>
            </div>

            {/* Password Field */}
            <div class="form-group">
              <label class="form-label">
                CREATE YOUR PASSWORD <span class="required-asterisk">*</span>
              </label>
              <div class="input-wrapper">
                <TutorIcon name="fas fa-lock input-icon"/>
                <input type={showPassword() ? 'text' : 'password'} class="password-input" placeholder="Create your password (Min. 6 characters)" value={formData().password} onInput={(e) => handleChange('password', (e.target as HTMLInputElement).value)} required minLength={6}/>
                <button type="button" class="password-toggle-btn" onClick={() => setShowPassword(!showPassword())}>
                  <TutorIcon name={`fas ${showPassword() ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`}/>
                </button>
              </div>
              <div class="show-password-wrapper">
                <input type="checkbox" class="show-password-checkbox" id="showPasswordCheck" checked={showPassword()} onChange={(e) => setShowPassword((e.target as HTMLInputElement).checked)}/>
                <label for="showPasswordCheck" class="show-password-label">
                  SHOW PASSWORD
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button type="submit" class="submit-btn" disabled={isSubmitting()}>
              {isSubmitting() ? (<>
                  <TutorIcon name="fas fa-spinner fa-spin"/>
                  {' '}Submitting...
                </>) : ('Submit Application')}
            </button>

            {/* Login Link */}
            {/* No login link since we auto-login on success */}
          </form>
            </div>
          </div>
        </div>
      </div>
    </>);
};
export default RegisterPage;
