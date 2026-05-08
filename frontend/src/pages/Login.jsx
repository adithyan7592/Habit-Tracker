import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../api';

/* ── tiny inline styles so this file is self-contained ── */
const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  left: {
    flex: 1,
    background: 'linear-gradient(160deg, #1a3d1f 0%, #2e7d32 55%, #43a047 100%)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '60px 56px',
    position: 'relative',
    overflow: 'hidden',
  },
  right: {
    width: 480,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 48px',
    background: '#fff',
  },
  form: { width: '100%', maxWidth: 380 },
  logoCircle: {
    width: 52, height: 52, borderRadius: 16,
    background: 'rgba(255,255,255,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, marginBottom: 32, backdropFilter: 'blur(4px)',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  heroTitle: {
    fontSize: 38, fontWeight: 700, color: '#fff',
    lineHeight: 1.25, margin: '0 0 16px', letterSpacing: '-0.5px',
  },
  heroSub: {
    fontSize: 15, color: 'rgba(255,255,255,0.72)',
    lineHeight: 1.7, margin: '0 0 40px', maxWidth: 320,
  },
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 99, padding: '8px 16px',
    color: 'rgba(255,255,255,0.9)', fontSize: 13,
    backdropFilter: 'blur(4px)',
  },
  dot: {
    width: 7, height: 7, borderRadius: '50%',
    background: '#86efac', flexShrink: 0,
  },
  decorCircle: (size, top, left, opacity) => ({
    position: 'absolute', width: size, height: size,
    borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)',
    top, left, pointerEvents: 'none',
  }),
  formTitle: {
    fontSize: 26, fontWeight: 700, color: '#111827',
    margin: '0 0 4px', letterSpacing: '-0.3px',
  },
  formSub: { fontSize: 14, color: '#6b7280', margin: '0 0 32px' },
  label: {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: '#374151', marginBottom: 6,
  },
  inputWrap: { position: 'relative', marginBottom: 16 },
  inputIcon: {
    position: 'absolute', left: 14, top: '50%',
    transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none',
  },
  input: (hasIcon, hasError) => ({
    width: '100%', padding: hasIcon ? '13px 14px 13px 42px' : '13px 14px',
    border: `1.5px solid ${hasError ? '#f87171' : '#e5e7eb'}`,
    borderRadius: 12, fontSize: 15, outline: 'none',
    background: '#fafafa', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }),
  btn: (disabled) => ({
    width: '100%', padding: '14px',
    background: disabled ? '#d1d5db' : '#15803d',
    color: disabled ? '#9ca3af' : '#fff',
    border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s, transform 0.1s',
    marginTop: 4,
  }),
  errBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: 10, padding: '10px 14px',
    fontSize: 13, color: '#b91c1c', marginBottom: 16,
  },
  successBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: 10, padding: '10px 14px',
    fontSize: 13, color: '#15803d', marginBottom: 16,
  },
  stepRow: {
    display: 'flex', gap: 8, marginBottom: 32, alignItems: 'center',
  },
  stepDot: (active, done) => ({
    width: active ? 24 : 8, height: 8, borderRadius: 99,
    background: done || active ? '#15803d' : '#e5e7eb',
    transition: 'all 0.3s',
  }),
  backBtn: {
    background: 'none', border: 'none', color: '#6b7280',
    fontSize: 13, cursor: 'pointer', padding: '8px 0',
    display: 'flex', alignItems: 'center', gap: 4, marginTop: 12,
    width: 'auto',
  },
  otpRow: {
    display: 'flex', gap: 10, marginBottom: 16,
  },
  otpBox: (focused, filled) => ({
    flex: 1, height: 56, textAlign: 'center', fontSize: 22,
    fontWeight: 700, border: `2px solid ${focused ? '#15803d' : filled ? '#86efac' : '#e5e7eb'}`,
    borderRadius: 12, outline: 'none', background: filled ? '#f0fdf4' : '#fafafa',
    transition: 'all 0.15s', color: '#111827',
  }),
};

/* ── OTP 6-box input ── */
const OtpInput = ({ value, onChange }) => {
  const refs = Array.from({ length: 6 }, () => useRef(null));
  const [focused, setFocused] = useState(-1);
  const digits = (value + '      ').slice(0, 6).split('');

  const handle = (i, e) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1);
    const next = value.slice(0, i) + v + value.slice(i + 1);
    onChange(next.trimEnd());
    if (v && i < 5) refs[i + 1].current?.focus();
  };
  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i].trim() && i > 0) {
      refs[i - 1].current?.focus();
      const next = value.slice(0, i - 1) + ' ' + value.slice(i);
      onChange(next.trimEnd());
    }
    if (e.key === 'ArrowLeft'  && i > 0) refs[i - 1].current?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs[i + 1].current?.focus();
  };
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    if (pasted.length > 0) refs[Math.min(pasted.length, 5)].current?.focus();
    e.preventDefault();
  };

  return (
    <div style={S.otpRow}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={(e) => handle(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={() => setFocused(i)}
          onBlur={() => setFocused(-1)}
          style={S.otpBox(focused === i, !!d.trim())}
        />
      ))}
    </div>
  );
};

/* ── Countdown timer ── */
const Countdown = ({ seconds, onDone }) => {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) { onDone(); return; }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <span style={{ fontSize: 13, color: '#6b7280' }}>
      Resend in <b style={{ color: '#15803d' }}>{left}s</b>
    </span>
  );
};

/* ── Features list shown on left panel ── */
const features = [
  { icon: '📅', text: '7-day food habit collection' },
  { icon: '🤖', text: 'AI-powered nutrition analysis' },
  { icon: '📊', text: 'Personalised health report' },
];

/* ── Main Login Component ── */
const Login = () => {
  const [phone,   setPhone]   = useState('');
  const [otp,     setOtp]     = useState('');
  const [step,    setStep]    = useState(1);   // 1 = phone, 2 = otp
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();

  const clearErr = () => setError('');

  const handleRequestOtp = async () => {
    clearErr();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');
      setStep(2);
      setCanResend(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    clearErr();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid OTP');
      localStorage.setItem('token', data.token);
      localStorage.setItem('role',  data.role);
      localStorage.setItem('phone', data.phone);
      navigate(data.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message);
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const phoneOk = /^\+?[1-9]\d{9,14}$/.test(phone.replace(/\s/g, ''));
  const otpOk   = otp.replace(/\s/g, '').length === 6;

  return (
    <div style={S.page}>

      {/* ── Left panel ── */}
      <div style={S.left}>
        {/* decorative circles */}
        {[[320,'−10%','−8%'],[180,'60%','70%'],[80,'30%','80%']].map(([sz,t,l],i)=>(
          <div key={i} style={S.decorCircle(sz,t,l,0.08)}/>
        ))}

        <div style={S.logoCircle}>🥗</div>

        <h1 style={S.heroTitle}>
          Track your<br/>food habits.<br/>
          <span style={{ color: '#86efac' }}>Transform</span> your health.
        </h1>
        <p style={S.heroSub}>
          Log your meals for 7 days and receive a personalised
          AI nutrition analysis — all through your phone number.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {features.map((f, i) => (
            <div key={i} style={S.pill}>
              <span style={S.dot}/>
              <span>{f.icon} {f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={S.right}>
        <div style={S.form}>

          {/* Step indicators */}
          <div style={S.stepRow}>
            <div style={S.stepDot(step === 1, step > 1)}/>
            <div style={S.stepDot(step === 2, false)}/>
          </div>

          {step === 1 ? (
            <>
              <h2 style={S.formTitle}>Sign in</h2>
              <p style={S.formSub}>Enter your phone number to receive a one-time code</p>

              {error && <div style={S.errBox}>⚠️ {error}</div>}

              <label style={S.label}>Phone number</label>
              <div style={S.inputWrap}>
                <span style={S.inputIcon}>📱</span>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); clearErr(); }}
                  onKeyDown={e => e.key === 'Enter' && phoneOk && !loading && handleRequestOtp()}
                  style={S.input(true, !!error)}
                  onFocus={e => { e.target.style.borderColor='#15803d'; e.target.style.boxShadow='0 0 0 3px rgba(21,128,61,0.12)'; }}
                  onBlur={e  => { e.target.style.borderColor= error ? '#f87171' : '#e5e7eb'; e.target.style.boxShadow='none'; }}
                  autoFocus
                />
              </div>

              <button
                style={S.btn(!phoneOk || loading)}
                disabled={!phoneOk || loading}
                onClick={handleRequestOtp}
                onMouseEnter={e => { if (phoneOk && !loading) e.target.style.background='#166534'; }}
                onMouseLeave={e => { if (phoneOk && !loading) e.target.style.background='#15803d'; }}
              >
                {loading ? '⏳ Sending OTP…' : 'Send OTP →'}
              </button>

              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 20, textAlign: 'center', lineHeight: 1.6 }}>
                By continuing you agree to receive an SMS OTP.<br/>
                Standard messaging rates may apply.
              </p>
            </>
          ) : (
            <>
              <h2 style={S.formTitle}>Verify code</h2>
              <p style={S.formSub}>
                6-digit code sent to{' '}
                <b style={{ color: '#111827', fontFamily: 'monospace' }}>{phone}</b>
              </p>

              {error && <div style={S.errBox}>⚠️ {error}</div>}

              <label style={S.label}>One-time password</label>
              <OtpInput value={otp} onChange={v => { setOtp(v); clearErr(); }}/>

              <button
                style={S.btn(!otpOk || loading)}
                disabled={!otpOk || loading}
                onClick={handleVerifyOtp}
                onMouseEnter={e => { if (otpOk && !loading) e.target.style.background='#166534'; }}
                onMouseLeave={e => { if (otpOk && !loading) e.target.style.background='#15803d'; }}
              >
                {loading ? '⏳ Verifying…' : 'Verify & Sign In ✓'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                {canResend ? (
                  <button
                    style={{ ...S.backBtn, color: '#15803d', fontWeight: 600 }}
                    onClick={() => { setCanResend(false); handleRequestOtp(); }}
                  >
                    ↻ Resend OTP
                  </button>
                ) : (
                  <Countdown seconds={60} onDone={() => setCanResend(true)}/>
                )}
                <button style={S.backBtn} onClick={() => { setStep(1); setOtp(''); clearErr(); }}>
                  ← Change number
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile: hide left panel below 680px */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @media (max-width: 680px) {
          .login-left { display: none !important; }
          .login-right { width: 100% !important; padding: 32px 24px !important; }
        }
      `}</style>
    </div>
  );
};

export default Login;