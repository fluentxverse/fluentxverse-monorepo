
import { useState } from 'preact/compat';
import { useLocation } from 'preact-iso';
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import { register } from '../api/auth.api';
import { useAuthContext } from '../context/AuthContext';
import './RegisterPage.css';

const RegisterPage = () => {
  const { route } = useLocation();
  const { user, login } = useAuthContext();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
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
    
    if (isSubmitting) return;
    
    setError(null);
    setIsSubmitting(true);
    
    try {
      // Map form data to match server schema
      const result = await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        middleName: formData.middleName || "",
        lastName: formData.lastName,
        suffix: formData.suffix || "",
        birthDate: formData.dateOfBirth,
        mobileNumber: formData.mobile,
      });
      // New Axios response shape: { success, message, user }
      if (result?.success) {
        setSuccess(true);
        // Cookie already set server-side during register; user is logged in.
        // Optionally refresh auth context if available.
        try {
          await login(formData.email, formData.password); // ensures context populated
        } catch {
          // If login fails (should rarely happen), we still proceed thanks to cookie.
        }
        window.location.href = '/home';
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <>
      <div className="register-container">
        <Header />
        <div className="register-content">
          {/* Left Side - Why FluentXVerse */}
          <div className="register-left-side">
            {/* Decorative circles */}
            <div className="decorative-circle-top"></div>
            <div className="decorative-circle-bottom"></div>

            <div className="left-content">
              <h2 className="left-subtitle">
                THE DIFFERENCE
              </h2>
              <h1 className="left-title">
                Why Choose FluentXVerse?
              </h1>
              <p className="left-intro">
                A supportive space for tutors to teach confidently, grow steadily,
                and make real impact with learners around the world.
              </p>

              <div className="features-list">
                {[
                  { icon: 'fas fa-chart-line', title: 'Growing with momentum', desc: 'Join an ambitious platform that improves and expands every month.' },
                  { icon: 'fas fa-users', title: 'Engaged learners', desc: 'Teach active students who regularly book, learn, and progress.' },
                  { icon: 'fas fa-calendar-alt', title: 'Truly flexible time', desc: 'Open slots that fit your day and manage your time with ease.' },
                  { icon: 'fas fa-book', title: 'Original materials', desc: 'Use clear, purpose‑built lessons designed by our own team.' },
                  { icon: 'fas fa-headset', title: 'Responsive support', desc: 'Get fast help when you need it—technical or teaching‑related.' },
                  { icon: 'fas fa-star', title: 'Room to grow', desc: 'Unlock more opportunities as you build consistency and quality.' }
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
                Teach on your terms • Earn reliably • Grow your craft
              </div>
            </div>
          </div>

          {/* Right Side - Registration Form */}
          <div className="register-right-side">
            <div className="register-form-card">
              <h2 className="form-title">
                Registration
              </h2>
              <p className="form-description">
                We encourage you to use your computer instead of mobile device to sign up. Please enter your complete name including your middle name (if applicable) as reflected on your valid ID.
              </p>

              {/* Success Message */}
              {success && (
                <div className="alert alert-success">
                  <i className="fas fa-check-circle"></i>
                  Registration successful! Redirecting to login...
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="alert alert-error">
                  <i className="fas fa-exclamation-circle"></i>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
            {/* Name Fields Row */}
            <div className="name-fields-row">
              <div>
                <label className="form-label">
                  FIRST NAME <span className="required-asterisk">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', (e.target as HTMLInputElement).value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">
                  MIDDLE NAME
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Middle Name"
                  value={formData.middleName}
                  onChange={(e) => handleChange('middleName', (e.target as HTMLInputElement).value)}
                />
              </div>

              <div>
                <label className="form-label">
                  LAST NAME <span className="required-asterisk">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', (e.target as HTMLInputElement).value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">
                  SUFFIX
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="jr, sr, etc"
                  value={formData.suffix}
                  onChange={(e) => handleChange('suffix', (e.target as HTMLInputElement).value)}
                />
              </div>
            </div>

            {/* Date of Birth and Mobile Row */}
            <div className="two-column-row">
              <div>
                <label className="form-label">
                  DATE OF BIRTH <span className="required-asterisk">*</span>
                </label>
                <div className="input-wrapper">
                  <i className="fas fa-calendar input-icon"></i>
                  <input
                    type="date"
                    className="form-input-with-icon"
                    placeholder="yyyy-mm-dd"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleChange('dateOfBirth', (e.target as HTMLInputElement).value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">
                  MOBILE / VIBER NUMBER <span className="required-asterisk">*</span>
                </label>
                <div className="input-wrapper">
                  <i className="fas fa-mobile-alt input-icon"></i>
                  <input
                    type="tel"
                    className="form-input-with-icon"
                    placeholder="09xxxxxxxxx"
                    value={formData.mobile}
                    onChange={(e) => handleChange('mobile', (e.target as HTMLInputElement).value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Email Field */}
            <div className="form-group">
              <label className="form-label">
                EMAIL ADDRESS <span className="required-asterisk">*</span>
              </label>
              <div className="input-wrapper">
                <i className="fas fa-envelope input-icon"></i>
                <input
                  type="email"
                  className="form-input-with-icon"
                  placeholder="example: juandelacruz@gmail.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', (e.target as HTMLInputElement).value)}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label className="form-label">
                CREATE YOUR PASSWORD <span className="required-asterisk">*</span>
              </label>
              <div className="input-wrapper">
                <i className="fas fa-lock input-icon"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="password-input"
                  placeholder="Create your password (Min. 6 characters)"
                  value={formData.password}
                  onChange={(e) => handleChange('password', (e.target as HTMLInputElement).value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`}></i>
                </button>
              </div>
              <div className="show-password-wrapper">
                <input
                  type="checkbox"
                  className="show-password-checkbox"
                  id="showPasswordCheck"
                  checked={showPassword}
                  onChange={(e) => setShowPassword((e.target as HTMLInputElement).checked)}
                />
                <label
                  htmlFor="showPasswordCheck"
                  className="show-password-label"
                >
                  SHOW PASSWORD
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  {' '}Submitting...
                </>
              ) : (
                'Submit Application'
              )}
            </button>

            {/* Login Link */}
            {/* No login link since we auto-login on success */}
          </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RegisterPage;
