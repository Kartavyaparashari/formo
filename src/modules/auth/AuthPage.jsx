import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open
      ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
      : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
    }
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const rules = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'At least one uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'At least one number', test: (p) => /\d/.test(p) },
];

const featureCards = [
  { label: 'Live Traceability', value: '24/7', note: 'Lot status and barcode movement visibility.' },
  { label: 'Planning Accuracy', value: '99.8%', note: 'BOM and nesting decisions with less waste.' },
  { label: 'Production Sync', value: '1 Hub', note: 'Planning, imports, RM, and reports in one workflow.' },
];

const proofPoints = [
  'Import drawings, lots, and master data with less manual cleanup.',
  'Track raw material usage and production movement in real time.',
  'Give planners, operations, and management one professional control layer.',
];

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const passwordOk = rules.every((r) => r.test(password));
  const confirmOk = password === confirm && confirm.length > 0;

  const friendlyError = (msg) => {
    if (msg?.includes('Database error saving new user')) {
      return 'Account setup failed. Apply the database schema in Supabase and try again.';
    }
    if (msg?.includes('User already registered')) {
      return 'This email is already registered. Try logging in instead.';
    }
    if (msg?.includes('Invalid login credentials')) {
      return 'Incorrect email or password. Please try again.';
    }
    return msg;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg('');

    if (mode === 'register') {
      if (!passwordOk) {
        setError('Please satisfy all password requirements.');
        return;
      }
      if (!confirmOk) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        navigate('/', { replace: true });
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (signUpError) throw signUpError;
        setSuccessMsg('Account created. Check your email to confirm before logging in.');
        setMode('login');
      }
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError(null);
    setSuccessMsg('');
    setPassword('');
    setConfirm('');
  };

  return (
    <div style={pageStyle}>
      <div style={ambientMeshStyle} />
      <div style={ambientOrbPrimary} />
      <div style={ambientOrbAccent} />

      <div style={layoutStyle}>
        <motion.section
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={showcaseStyle}
        >
          <div style={heroBadgeStyle}>FORMO Control Layer</div>
          <div>
            <div style={brandStyle}>
              FORM<span style={{ color: 'var(--primary)' }}>O</span>
            </div>
            <h1 style={headlineStyle}>
              Advanced production planning with a sharper operational surface.
            </h1>
            <p style={subheadStyle}>
              A cleaner command center for imports, planning, raw material control, and reporting across aluminum formwork operations.
            </p>
          </div>

          <div style={showcaseCardsGrid}>
            {featureCards.map((card) => (
              <div key={card.label} style={metricCardStyle}>
                <div style={metricValueStyle}>{card.value}</div>
                <div style={metricLabelStyle}>{card.label}</div>
                <div style={metricNoteStyle}>{card.note}</div>
              </div>
            ))}
          </div>

          <div style={proofListStyle}>
            {proofPoints.map((point) => (
              <div key={point} style={proofRowStyle}>
                <span style={proofBulletStyle} />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.06 }}
          style={panelStyle}
        >
          <div style={panelHeaderStyle}>
            <div>
              <div style={panelEyebrowStyle}>{mode === 'login' ? 'Welcome Back' : 'Create Workspace Access'}</div>
              <h2 style={panelTitleStyle}>{mode === 'login' ? 'Sign in to continue' : 'Start with a secure account'}</h2>
            </div>
            <div style={panelSignalStyle}>
              <span style={panelSignalDotStyle} />
              Secure session
            </div>
          </div>

          <div style={switcherStyle}>
            {['login', 'register'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchMode(tab)}
                style={{
                  ...switcherButtonStyle,
                  ...(mode === tab ? switcherButtonActiveStyle : null),
                }}
              >
                {tab === 'login' ? 'Log In' : 'Register'}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={errorBannerStyle}
              >
                {error}
              </motion.div>
            )}
            {successMsg && (
              <motion.div
                key="ok"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={successBannerStyle}
              >
                {successMsg}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} style={formStyle}>
            <AnimatePresence mode="popLayout">
              {mode === 'register' && (
                <motion.div
                  key="fullname"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <Field label="Full Name" type="text" placeholder="John Doe" value={fullName} onChange={setFullName} />
                </motion.div>
              )}
            </AnimatePresence>

            <Field label="Email Address" type="email" placeholder="you@company.com" value={email} onChange={setEmail} />

            <div style={fieldGroupStyle}>
              <Label>Password</Label>
              <div style={passwordShellStyle}>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ ...inputStyle, paddingRight: 46 }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={iconButtonStyle}>
                  <EyeIcon open={showPass} />
                </button>
              </div>

              <AnimatePresence>
                {mode === 'register' && password.length > 0 && (
                  <motion.div
                    key="rules"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={passwordRulesStyle}
                  >
                    {rules.map((rule) => {
                      const passed = rule.test(password);
                      return (
                        <div key={rule.label} style={{ ...ruleRowStyle, color: passed ? '#16a34a' : 'var(--text-muted)' }}>
                          {passed ? <CheckIcon /> : <XIcon />}
                          <span>{rule.label}</span>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="popLayout">
              {mode === 'register' && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={fieldGroupStyle}>
                    <Label>Confirm Password</Label>
                    <div style={passwordShellStyle}>
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Repeat your password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        style={{
                          ...inputStyle,
                          paddingRight: 46,
                          borderColor: confirm.length > 0
                            ? (confirmOk ? 'rgba(34, 197, 94, 0.34)' : 'rgba(239, 68, 68, 0.34)')
                            : inputStyle.borderColor,
                        }}
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={iconButtonStyle}>
                        <EyeIcon open={showConfirm} />
                      </button>
                    </div>
                    {confirm.length > 0 && !confirmOk && (
                      <span style={inlineErrorStyle}>Passwords do not match.</span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading} style={submitButtonStyle(loading)}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Enter Platform' : 'Create Account'}
            </button>
          </form>

          <div style={footerMetaStyle}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              style={textLinkButtonStyle}
            >
              {mode === 'login' ? 'Register here' : 'Log in here'}
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <label style={labelStyle}>{children}</label>;
}

function Field({ label, type, placeholder, value, onChange }) {
  return (
    <div style={fieldGroupStyle}>
      <Label>{label}</Label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        style={inputStyle}
      />
    </div>
  );
}

const pageStyle = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  background:
    'radial-gradient(circle at top left, color-mix(in srgb, var(--primary) 12%, transparent), transparent 32%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--accent) 10%, transparent), transparent 28%), var(--bg)',
  padding: 'clamp(20px, 4vw, 40px)',
};

const ambientMeshStyle = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(color-mix(in srgb, var(--border) 60%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--border) 60%, transparent) 1px, transparent 1px)',
  backgroundSize: '84px 84px',
  opacity: 0.2,
  maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.78), transparent 80%)',
  pointerEvents: 'none',
};

const ambientOrbPrimary = {
  position: 'absolute',
  top: '-12%',
  right: '-8%',
  width: 460,
  height: 460,
  borderRadius: '50%',
  background: 'var(--primary-glow)',
  filter: 'blur(110px)',
  opacity: 0.7,
  pointerEvents: 'none',
};

const ambientOrbAccent = {
  position: 'absolute',
  left: '-10%',
  bottom: '-18%',
  width: 420,
  height: 420,
  borderRadius: '50%',
  background: 'var(--accent-glow)',
  filter: 'blur(120px)',
  opacity: 0.48,
  pointerEvents: 'none',
};

const layoutStyle = {
  position: 'relative',
  zIndex: 1,
  maxWidth: 1320,
  margin: '0 auto',
  minHeight: 'calc(100vh - 2 * clamp(20px, 4vw, 40px))',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
  gap: 'clamp(28px, 5vw, 56px)',
  alignItems: 'stretch',
};

const showcaseStyle = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 28,
  padding: 'clamp(28px, 5vw, 48px)',
  borderRadius: 32,
  border: '1px solid color-mix(in srgb, var(--border) 82%, transparent)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 66%, transparent), color-mix(in srgb, var(--surface) 95%, transparent)), linear-gradient(135deg, color-mix(in srgb, var(--primary) 7%, transparent), transparent 42%)',
  boxShadow: '0 28px 72px rgba(15, 23, 42, 0.16)',
  backdropFilter: 'blur(24px) saturate(150%)',
};

const heroBadgeStyle = {
  display: 'inline-flex',
  alignSelf: 'flex-start',
  padding: '0.55rem 0.9rem',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--primary) 22%, transparent)',
  background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
  color: 'var(--primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
};

const brandStyle = {
  fontFamily: 'var(--font-heading)',
  fontWeight: 900,
  fontSize: 'clamp(34px, 5vw, 66px)',
  lineHeight: 0.98,
  color: 'var(--text)',
  marginBottom: 18,
};

const headlineStyle = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontWeight: 800,
  fontSize: 'clamp(34px, 4vw, 58px)',
  lineHeight: 1.04,
  letterSpacing: '-0.04em',
  color: 'var(--text)',
  maxWidth: 700,
};

const subheadStyle = {
  margin: '20px 0 0',
  maxWidth: 620,
  fontSize: 18,
  lineHeight: 1.8,
  color: 'var(--text-mid)',
};

const showcaseCardsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 16,
};

const metricCardStyle = {
  padding: '18px 18px 20px',
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--border) 82%, transparent)',
  background: 'color-mix(in srgb, var(--bg-surface) 72%, transparent)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
};

const metricValueStyle = {
  fontFamily: 'var(--font-heading)',
  fontWeight: 800,
  fontSize: 28,
  color: 'var(--text)',
  marginBottom: 8,
};

const metricLabelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  color: 'var(--primary)',
  marginBottom: 8,
};

const metricNoteStyle = {
  fontSize: 13,
  lineHeight: 1.65,
  color: 'var(--text-mid)',
};

const proofListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  maxWidth: 640,
};

const proofRowStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  color: 'var(--text-mid)',
  lineHeight: 1.7,
};

const proofBulletStyle = {
  width: 10,
  height: 10,
  marginTop: 8,
  borderRadius: 999,
  background: 'linear-gradient(135deg, var(--primary), var(--accent))',
  flexShrink: 0,
  boxShadow: '0 0 0 5px color-mix(in srgb, var(--primary) 10%, transparent)',
};

const panelStyle = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 22,
  padding: 'clamp(26px, 4vw, 34px)',
  borderRadius: 30,
  border: '1px solid color-mix(in srgb, var(--border) 85%, transparent)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 84%, transparent), color-mix(in srgb, var(--surface) 96%, transparent)), radial-gradient(circle at top right, color-mix(in srgb, var(--primary) 10%, transparent), transparent 44%)',
  boxShadow: '0 26px 70px rgba(15, 23, 42, 0.18)',
  backdropFilter: 'blur(24px) saturate(160%)',
};

const panelHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 18,
};

const panelEyebrowStyle = {
  marginBottom: 8,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--primary)',
};

const panelTitleStyle = {
  margin: 0,
  fontFamily: 'var(--font-heading)',
  fontSize: 28,
  lineHeight: 1.1,
  color: 'var(--text)',
};

const panelSignalStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '0.5rem 0.75rem',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--bg-surface) 70%, transparent)',
  border: '1px solid color-mix(in srgb, var(--border) 82%, transparent)',
  color: 'var(--text-muted)',
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const panelSignalDotStyle = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#22c55e',
  boxShadow: '0 0 0 5px rgba(34, 197, 94, 0.12)',
};

const switcherStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
  padding: 6,
  borderRadius: 18,
  background: 'color-mix(in srgb, var(--bg-surface) 84%, transparent)',
  border: '1px solid color-mix(in srgb, var(--border) 82%, transparent)',
};

const switcherButtonStyle = {
  minHeight: 46,
  border: 'none',
  borderRadius: 14,
  background: 'transparent',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-heading)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'all 0.22s ease',
};

const switcherButtonActiveStyle = {
  background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
  color: '#fff',
  boxShadow: '0 16px 28px color-mix(in srgb, var(--primary) 22%, transparent)',
};

const errorBannerStyle = {
  padding: '12px 14px',
  borderRadius: 16,
  border: '1px solid rgba(239, 68, 68, 0.25)',
  background: 'rgba(239, 68, 68, 0.08)',
  color: '#b91c1c',
  fontSize: 13,
  lineHeight: 1.6,
};

const successBannerStyle = {
  padding: '12px 14px',
  borderRadius: 16,
  border: '1px solid rgba(34, 197, 94, 0.22)',
  background: 'rgba(34, 197, 94, 0.08)',
  color: '#15803d',
  fontSize: 13,
  lineHeight: 1.6,
};

const formStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const fieldGroupStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--border) 88%, transparent)',
  background: 'color-mix(in srgb, var(--bg-surface) 88%, transparent)',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  transition: 'border-color 0.22s ease, box-shadow 0.22s ease, background-color 0.22s ease',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
};

const passwordShellStyle = {
  position: 'relative',
};

const iconButtonStyle = {
  position: 'absolute',
  top: '50%',
  right: 14,
  transform: 'translateY(-50%)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: 0,
};

const passwordRulesStyle = {
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '4px 2px 0',
};

const ruleRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  lineHeight: 1.5,
};

const inlineErrorStyle = {
  fontSize: 12,
  color: '#dc2626',
};

const submitButtonStyle = (loading) => ({
  marginTop: 8,
  minHeight: 52,
  border: '1px solid color-mix(in srgb, var(--primary) 52%, transparent)',
  borderRadius: 18,
  background: loading
    ? 'color-mix(in srgb, var(--primary) 16%, transparent)'
    : 'linear-gradient(135deg, var(--primary), var(--primary-light))',
  color: '#fff',
  fontFamily: 'var(--font-heading)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  cursor: loading ? 'not-allowed' : 'pointer',
  boxShadow: loading ? 'none' : '0 18px 32px color-mix(in srgb, var(--primary) 24%, transparent)',
});

const footerMetaStyle = {
  display: 'flex',
  justifyContent: 'center',
  gap: 6,
  flexWrap: 'wrap',
  fontSize: 13,
  color: 'var(--text-muted)',
};

const textLinkButtonStyle = {
  border: 'none',
  background: 'transparent',
  color: 'var(--primary)',
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
};
