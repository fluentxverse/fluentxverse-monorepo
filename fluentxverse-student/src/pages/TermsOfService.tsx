import { useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import SideBar from '../Components/IndexOne/SideBar';
import { useThemeStore } from '../context/ThemeContext';
import '../assets/css/terms-of-service.css';

const TermsOfService = () => {
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={`terms-of-service-page ${isDarkMode ? 'dark-mode' : ''}`}>
      <SideBar />
      <div className="main-content">
        <Header />
        
        {/* Hero Section */}
        <section className="privacy-hero">
          <div className="container">
            <div className="hero-content">
              <h1 className="title">
                Terms of <span className="text-accent">Service</span>
              </h1>
              <p className="hero-subtitle">
                Please read these terms carefully before using our services
              </p>
            </div>
          </div>
        </section>

        <section className="privacy-policy-section">
          <div className="container">
            <div className="section-header text-center mb-5">
              <p className="section-subtitle">Last Updated: June 26, 2025</p>
            </div>

            <div className="privacy-content">
              <div className="privacy-section">
                <h2 className="privacy-heading">1. Acceptance of Terms</h2>
                <p className="privacy-text">
                  By accessing or using the Decentragri platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). 
                  If you do not agree to these Terms, please do not use our Service.
                </p>

                <h2 className="privacy-heading">2. Description of Service</h2>
                <p className="privacy-text">
                  Decentragri provides an agricultural technology platform that enables farmers to monitor and manage their farming operations. 
                  The Service includes data collection, analysis, and reporting tools designed to improve agricultural productivity and sustainability.
                </p>

                <h2 className="privacy-heading">3. User Accounts</h2>
                <p className="privacy-text">
                  To access certain features of the Service, you may be required to create an account. You are responsible for:
                </p>
                <ul className="privacy-list">
                  <li>Maintaining the confidentiality of your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Ensuring that your account information is accurate and up-to-date</li>
                  <li>Notifying us immediately of any unauthorized use of your account</li>
                </ul>

                <h2 className="privacy-heading">4. User Responsibilities</h2>
                <p className="privacy-text">
                  When using our Service, you agree to:
                </p>
                <ul className="privacy-list">
                  <li>Comply with all applicable laws and regulations</li>
                  <li>Not use the Service for any illegal or unauthorized purpose</li>
                  <li>Not interfere with or disrupt the Service or servers</li>
                  <li>Not attempt to gain unauthorized access to any part of the Service</li>
                  <li>Not use the Service to transmit any viruses or malicious code</li>
                </ul>

                <h2 className="privacy-heading">5. Intellectual Property</h2>
                <p className="privacy-text">
                  All content, features, and functionality of the Service, including but not limited to text, graphics, logos, 
                  and software, are the exclusive property of Decentragri and are protected by international copyright, trademark, 
                  and other intellectual property laws.
                </p>
                <p className="privacy-text">
                  You may not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, 
                  republish, download, store, or transmit any of the material on our Service without our express written permission.
                </p>

                <h2 className="privacy-heading">6. Limitation of Liability</h2>
                <p className="privacy-text">
                  To the maximum extent permitted by law, Decentragri shall not be liable for any indirect, incidental, special, 
                  consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, 
                  or any loss of data, use, goodwill, or other intangible losses resulting from:
                </p>
                <ul className="privacy-list">
                  <li>Your access to or use of or inability to access or use the Service</li>
                  <li>Any conduct or content of any third party on the Service</li>
                  <li>Any content obtained from the Service</li>
                  <li>Unauthorized access, use, or alteration of your transmissions or content</li>
                </ul>

                <h2 className="privacy-heading">7. Changes to Terms</h2>
                <p className="privacy-text">
                  We reserve the right to modify these Terms at any time. We will provide notice of any changes by updating the "Last Updated" 
                  date at the top of these Terms. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.
                </p>

                <h2 className="privacy-heading">8. Contact Us</h2>
                <p className="privacy-text">
                  If you have any questions about these Terms of Service, please contact us at:
                </p>
                <p className="privacy-text">
                  Email: <a href="mailto:legal@decentragri.com" className="text-primary">legal@decentragri.com</a>
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

export default TermsOfService;
