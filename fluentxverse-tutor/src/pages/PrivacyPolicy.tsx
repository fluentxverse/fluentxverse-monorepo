import { useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import SideBar from '../Components/IndexOne/SideBar';
import { useThemeStore } from '../context/ThemeContext';

const PrivacyPolicy = () => {
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={`privacy-policy-page ${isDarkMode ? 'dark-mode' : ''}`}>
      <SideBar />
      <div className="main-content">
        <Header />
        
        {/* Hero Section */}
        <section className="privacy-hero">
          <div className="container">
            <div className="hero-content">
              <h1 className="title">
                Your Privacy <span className="text-accent">Matters</span>
              </h1>
              <p className="hero-subtitle">
                We are committed to protecting your personal information and being transparent about how we use it.
              </p>
            </div>
          </div>
        </section>

        <section className="privacy-policy-section">
          <div className="container">
            <div className="section-header text-center mb-5">
              <h2 className="section-title">
                <span>Privacy</span> <span className="text-accent">Policy</span>
              </h2>
              <p className="section-subtitle">Last Updated: June 26, 2025</p>
            </div>

            <div className="privacy-content">
              <div className="privacy-section mb-5">
                <h2 className="privacy-heading">1. Introduction</h2>
                <p className="privacy-text">
                  Welcome to Decentragri. We respect your privacy and are committed to protecting your personal data. 
                  This Privacy Policy will inform you about how we look after your personal data when you visit our website 
                  and tell you about your privacy rights and how the law protects you.
                </p>
              </div>

              <div className="privacy-section mb-5">
                <h2 className="privacy-heading">2. Information We Collect</h2>
                <p className="privacy-text">
                  We may collect, use, store, and transfer different kinds of personal data about you which we have grouped together as follows:
                </p>
                <ul className="privacy-list">
                  <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
                  <li><strong>Contact Data</strong> includes email address and telephone numbers.</li>
                  <li><strong>Technical Data</strong> includes internet protocol (IP) address, browser type and version, time zone setting and location, and other technology on the devices you use to access this website.</li>
                  <li><strong>Usage Data</strong> includes information about how you use our website and services.</li>
                  <li><strong>Camera Data</strong> includes photos and images captured through your device's camera when you choose to use our plant identification and farm monitoring features.</li>
                  <li><strong>Location Data</strong> includes GPS coordinates and geographical information when you enable location services for farm mapping and weather data.</li>
                </ul>
              </div>

              <div className="privacy-section mb-5">
                <h2 className="privacy-heading">3. How We Use Your Data</h2>
                <p className="privacy-text">
                  We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
                </p>
                <ul className="privacy-list">
                  <li>To register you as a new customer</li>
                  <li>To manage our relationship with you</li>
                  <li>To administer and protect our business and this website</li>
                  <li>To deliver relevant website content and advertisements to you</li>
                  <li>To use data analytics to improve our website, products/services, marketing, and user experiences</li>
                  <li>To process camera images for plant identification, disease detection, and agricultural analysis</li>
                  <li>To provide location-based services such as weather forecasts and farm mapping</li>
                </ul>
              </div>

              <div className="privacy-section mb-5">
                <h2 className="privacy-heading">4. Device Permissions and Camera Access</h2>
                <p className="privacy-text">
                  Our mobile application requires access to your device's camera and location services to provide core agricultural features. Here's how we use these permissions:
                </p>
                <h3 className="privacy-heading" style={{ fontSize: '1.25rem', marginTop: '1.5rem' }}>Camera Permission</h3>
                <p className="privacy-text">
                  We request camera access to enable the following features:
                </p>
                <ul className="privacy-list">
                  <li><strong>Plant Identification:</strong> Capture photos of plants, crops, or agricultural areas for AI-powered identification and analysis</li>
                  <li><strong>Disease Detection:</strong> Take pictures of plant leaves, fruits, or stems to detect diseases, pests, or nutritional deficiencies</li>
                  <li><strong>Farm Documentation:</strong> Create visual records of your farming activities, crop progress, and field conditions</li>
                  <li><strong>Profile Pictures:</strong> Upload profile photos for your farmer account</li>
                </ul>
                <p className="privacy-text">
                  <strong>Important:</strong> Photos taken with the camera are processed locally on your device and/or securely transmitted to our servers for analysis. We do not access your camera without your explicit permission, and you can revoke camera access at any time through your device settings.
                </p>
                <h3 className="privacy-heading" style={{ fontSize: '1.25rem', marginTop: '1.5rem' }}>Location Permission</h3>
                <p className="privacy-text">
                  We request location access to provide:
                </p>
                <ul className="privacy-list">
                  <li><strong>Weather Services:</strong> Deliver accurate, location-specific weather forecasts and agricultural alerts</li>
                  <li><strong>Farm Mapping:</strong> Help you map and track different areas of your farm or agricultural land</li>
                  <li><strong>Regional Insights:</strong> Provide farming recommendations based on your geographic location and local conditions</li>
                </ul>
                <p className="privacy-text">
                  You can control these permissions through your device settings. Disabling camera or location access may limit some app functionality, but core features will remain available.
                </p>
              </div>

              <div className="privacy-section mb-5">
                <h2 className="privacy-heading">5. Data Security</h2>
                <p className="privacy-text">
                  We have implemented appropriate security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way, altered, or disclosed.
                </p>
              </div>

              <div className="privacy-section mb-5">
                <h2 className="privacy-heading">6. Your Legal Rights</h2>
                <p className="privacy-text">
                  Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to:
                </p>
                <ul className="privacy-list">
                  <li>Request access to your personal data</li>
                  <li>Request correction of your personal data</li>
                  <li>Request erasure of your personal data</li>
                  <li>Object to processing of your personal data</li>
                  <li>Request restriction of processing your personal data</li>
                  <li>Request transfer of your personal data</li>
                  <li>Right to withdraw consent</li>
                </ul>
              </div>

              <div className="privacy-section">
                <h2 className="privacy-heading">7. Contact Us</h2>
                <p className="privacy-text">
                  If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
                </p>
                <p className="privacy-text">
                  Email: <a href="mailto:privacy@decentragri.com" className="text-primary">hello@decentragri.com</a>
                </p>
              </div>
            </div>
          </div>
        </section>
        
        <Footer />
      </div>
    </div>
  );
};

export default PrivacyPolicy;
