import { useState } from 'preact/hooks';
import { useAuthContext } from '@/context/AuthContext';
import { useLocation } from 'wouter';

const LoginPage = () => {
  const { login } = useAuthContext();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    console.log('[LOGIN PAGE] handleLogin called');
    setLoading(true);
    setError('');
    try {
      console.log('[LOGIN PAGE] Calling login()...');
      await login(email, password);
      console.log('[LOGIN PAGE] login() completed successfully');
      // Small delay to ensure React state propagation before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('[LOGIN PAGE] Navigating to /home...');
      setLocation('/home');
    } catch (err: any) {
      console.log('[LOGIN PAGE] login() failed:', err);
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <section className="login-area" style={{ padding: '60px 0' }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="card shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ background:'#f5f7fa', padding:'24px 32px', borderBottom:'1px solid #e1e5ea' }}>
                <h2 style={{ margin:0, fontSize:'24px', fontWeight:600, color:'#0245ae' }}>Login</h2>
                <p style={{ margin:'8px 0 0', color:'#4a5568', fontSize:'14px' }}>Enter your credentials to continue.</p>
              </div>
              <div style={{ padding:'32px' }}>
                {error && <div style={{ background:'#ffe5e5', color:'#b00020', padding:'12px 16px', borderRadius:'8px', marginBottom:'16px', fontSize:'14px' }}>{error}</div>}
                <form onSubmit={handleLogin}>
                  <div className="form-grp" style={{ marginBottom:'18px' }}>
                    <label htmlFor="loginEmail" style={{ display:'block', fontWeight:500, marginBottom:'6px' }}>Email</label>
                    <input
                      id="loginEmail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
                      required
                      style={{ width:'100%', padding:'12px 14px', border:'1px solid #cbd5e0', borderRadius:'8px' }}
                    />
                  </div>
                  <div className="form-grp" style={{ marginBottom:'24px' }}>
                    <label htmlFor="loginPassword" style={{ display:'block', fontWeight:500, marginBottom:'6px' }}>Password</label>
                    <input
                      id="loginPassword"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                      required
                      style={{ width:'100%', padding:'12px 14px', border:'1px solid #cbd5e0', borderRadius:'8px' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ background:'#0245ae', color:'#fff', border:'none', padding:'12px 20px', borderRadius:'8px', fontWeight:600, width:'100%', cursor:'pointer' }}
                  >
                    {loading ? 'Authenticating...' : 'Login'}
                  </button>
                  <div style={{ marginTop:'12px', fontSize:'12px', color:'#718096', textAlign:'center' }}>
                    Use: paulanthonyarriola@gmail.com / MaryAnn1194
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LoginPage;