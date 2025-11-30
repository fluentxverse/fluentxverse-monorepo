import { useState } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import Footer from '../Components/Footer/Footer';
import { useAuthContext } from '../context/AuthContext';

const HomePage = () => {
  const { user } = useAuthContext();
  const [activeStep] = useState(1); // placeholder if needed


  console.log(user)
  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <main style={{ padding: '40px 0', background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)', minHeight: '100vh' }}>
          <div className="container">
            {/* Hero Section (public or logged-in) */}
            {user ? (
              <div style={{ display: 'flex', gap: '36px', alignItems: 'center', marginBottom: '36px' }}>
                <div style={{ flex: 1 }}>
                  <h1 style={{ margin: 0, fontSize: '36px', fontWeight: 900, color: '#022a6b', lineHeight: 1.05 }}>
                    Welcome back{user.givenName || user.familyName ? `, ${user.givenName || user.familyName}` : ''}!
                  </h1>
                  <p style={{ marginTop: '12px', color: '#475569', fontSize: '16px', maxWidth: '640px' }}>
                    Ready for your next lesson? Here are quick actions to get you back to learning.
                  </p>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <a href="/book-lesson" className="btn-primary" style={{ padding: '12px 26px', borderRadius: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>Book a Lesson</a>
                    <a href="/dashboard" className="btn-secondary" style={{ padding: '10px 16px', borderRadius: '12px', fontWeight: 700, background: '#fff', color: '#0245ae', border: '1px solid rgba(2,69,174,0.08)' }}>Go to Dashboard</a>
                    <a href="/schedule" className="btn-secondary" style={{ padding: '10px 16px', borderRadius: '12px', fontWeight: 700, background: '#fff', color: '#0245ae', border: '1px solid rgba(2,69,174,0.08)' }}>My Schedule</a>
                  </div>
                </div>

                <div style={{ width: '300px', flexShrink: 0 }}>
                  <div style={{ borderRadius: '12px', padding: '16px', background: 'linear-gradient(180deg, #ffffff, #f1f8ff)', boxShadow: '0 8px 24px rgba(2,69,174,0.06)' }}>
                    <div style={{ fontWeight: 800, color: '#022a6b' }}>Next lesson</div>
                    <div style={{ marginTop: 8, color: '#475569' }}>No upcoming lessons. Book a trial or schedule your next class.</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '36px', alignItems: 'center', marginBottom: '36px' }}>
                <div style={{ flex: 1 }}>
                  <h1 style={{ margin: 0, fontSize: '40px', fontWeight: 900, color: '#022a6b', lineHeight: 1.05 }}>
                    Korean Learners — Start Your English Journey
                  </h1>
                  <p style={{ marginTop: '12px', color: '#475569', fontSize: '16px', maxWidth: '640px' }}>
                    FluentXVerse offers tailored English lessons for Korean students: expert tutors, flexible scheduling, and lessons focused on real conversation and exam preparation.
                  </p>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <a href="/register" className="btn-primary" style={{ padding: '14px 26px', borderRadius: '12px', fontWeight: 800 }}>Get Started — Free Trial</a>
                    <a href="/browse-tutors" className="btn-secondary" style={{ padding: '14px 22px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>Browse Tutors</a>
                  </div>
                </div>

                <div style={{ width: '420px', flexShrink: 0 }}>
                  <div style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(2,69,174,0.12)' }}>
                    <img src="/assets/img/banner/banner_woman_register.png" alt="Happy student" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Reduced, neutral Features */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '28px' }}>
              {[
                { title: 'Korean-focused lessons', desc: 'Bilingual support and practical conversation practice.' },
                { title: 'Qualified tutors', desc: 'Experienced teachers with structured lesson plans.' },
                { title: 'Flexible booking', desc: 'Schedule lessons around school and family.' }
              ].map((f, i) => (
                <div key={i} style={{ background: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid rgba(2,69,174,0.06)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{f.title}</h4>
                  <p style={{ margin: 0, color: '#475569', fontSize: '13px' }}>{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Simplified How it works (muted) */}
            <div style={{ background: '#fff', padding: '22px', borderRadius: '12px', border: '1px solid rgba(2,69,174,0.04)', marginBottom: '28px' }}>
              <h3 style={{ marginTop: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>How it works</h3>
              <div style={{ position: 'relative', marginTop: '12px', padding: '12px 0' }}>
                <div style={{ position: 'absolute', left: '8%', right: '8%', top: '36px', height: '6px', background: 'rgba(15,23,42,0.06)', borderRadius: '6px', zIndex: 0 }} />
                <div style={{ position: 'absolute', left: '8%', width: '34%', top: '36px', height: '6px', background: 'rgba(2,69,174,0.12)', borderRadius: '6px', zIndex: 1 }} />

                <div style={{ display: 'flex', gap: '18px', position: 'relative', zIndex: 2 }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 28, margin: '0 auto', background: '#0245ae', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>1</div>
                    <div style={{ marginTop: 10, fontWeight: 700, color: '#0f172a' }}>Create account</div>
                    <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Sign up with email and basic details.</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 28, margin: '0 auto', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', fontWeight: 700 }}>2</div>
                    <div style={{ marginTop: 10, fontWeight: 700, color: '#0f172a' }}>Level check</div>
                    <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>A short placement to find suitable lessons.</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 28, margin: '0 auto', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', fontWeight: 700 }}>3</div>
                    <div style={{ marginTop: 10, fontWeight: 700, color: '#0f172a' }}>Book trial</div>
                    <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Choose a tutor and schedule your first lesson.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Small testimonial line (optional) */}
            <div style={{ marginBottom: '24px', color: '#475569', fontSize: 14 }}>
              <em>“Practical lessons and clear explanations — a helpful way to improve conversation.”</em>
            </div>

            {/* Utility footer removed as requested */}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};         

export default HomePage;
