import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../api';

const OtpInput = ({ value, onChange }) => {
  const refs = Array.from({ length: 6 }, () => useRef(null));
  const [focused, setFocused] = useState(-1);
  const digits = (value + '      ').slice(0, 6).split('');

  const handle = (i, e) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1);
    onChange((value.slice(0, i) + v + value.slice(i + 1)).trimEnd());
    if (v && i < 5) refs[i + 1].current?.focus();
  };
  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i].trim() && i > 0) {
      refs[i - 1].current?.focus();
      onChange(value.slice(0, i - 1) + ' ' + value.slice(i));
    }
    if (e.key === 'ArrowLeft'  && i > 0) refs[i - 1].current?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs[i + 1].current?.focus();
  };
  const handlePaste = (e) => {
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(p);
    if (p.length > 0) refs[Math.min(p.length, 5)].current?.focus();
    e.preventDefault();
  };

  return (
    <div className="otp-row">
      {digits.map((d, i) => (
        <input key={i} ref={refs[i]} type="text" inputMode="numeric" maxLength={1}
          value={d.trim()}
          onChange={(e) => handle(i, e)} onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste} onFocus={() => setFocused(i)} onBlur={() => setFocused(-1)}
          className={`otp-box${d.trim() ? ' filled' : ''}`}
          style={{ outline: focused === i ? '2px solid #15803d' : 'none', outlineOffset: 2 }}
        />
      ))}
    </div>
  );
};

const Countdown = ({ seconds, onDone }) => {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) { onDone(); return; }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return <span style={{ fontSize: 13, color: '#6b7280' }}>Resend in <b style={{ color: '#15803d' }}>{left}s</b></span>;
};

const features = [
  { icon: '📅', text: '7-day food habit collection' },
  { icon: '🤖', text: 'AI-powered nutrition analysis' },
  { icon: '📊', text: 'Personalised health report' },
];

const Login = () => {
  const [phone,     setPhone]     = useState('+91');
  const [otp,       setOtp]       = useState('');
  const [step,      setStep]      = useState(1);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();
  const clearErr = () => setError('');

const handleRequestOtp = async () => {
  clearErr(); setLoading(true);
  try {
    const cleanPhone = phone.replace('+', '').replace(/\s/g, '');
    await new Promise((resolve, reject) => {
      window.sendOtp(
        cleanPhone,
        (data) => resolve(data),
        (error) => reject(new Error(error?.message || 'Failed to send OTP'))
      );
    });
    setStep(2); setCanResend(false);
  } catch (err) { setError(err.message); }
  finally { setLoading(false); }
};

 const handleVerifyOtp = async () => {
  clearErr(); setLoading(true);
  try {
    const accessToken = await new Promise((resolve, reject) => {
      window.verifyOtp(
        otp,
        (data) => resolve(data.message),
        (error) => reject(new Error(error?.message || 'Invalid OTP'))
      );
    });

    const res = await fetch(`${API_BASE}/auth/verify-widget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, accessToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    localStorage.setItem('token', data.token);
    localStorage.setItem('role',  data.role);
    localStorage.setItem('phone', data.phone);
    navigate(data.role === 'admin' ? '/admin' : '/dashboard');
  } catch (err) { setError(err.message); setOtp(''); }
  finally { setLoading(false); }
};

  // ── Backup login — no OTP required ────────────────────────────────────────
  const handleDirectLogin = async () => {
    clearErr(); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/direct-login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('role',  data.role);
      localStorage.setItem('phone', data.phone);
      navigate(data.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const phoneOk = /^\+?[1-9]\d{9,14}$/.test(phone.replace(/\s/g, ''));
  const otpOk   = otp.replace(/\s/g, '').length === 6;

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-left-decor" style={{ width:320, height:320, top:'-10%', left:'-8%' }}/>
        <div className="login-left-decor" style={{ width:180, height:180, top:'60%', left:'70%' }}/>
        <div className="login-left-decor" style={{ width:80, height:80, top:'30%', left:'80%' }}/>
        <div className="login-logo">🥗</div>
        <h1 className="login-hero-title">Track your<br/>food habits.<br/><span>Transform</span> your health.</h1>
        <p className="login-hero-sub">Log your meals for 7 days and receive a personalised AI nutrition analysis — all through your phone number.To get accurate results in our 90 Days Diabetes Control Program, you must fill the Habit Report continuously for 7 days.</p>
        <div className="login-features">
          {features.map((f, i) => (
            <div key={i} className="login-pill">
              <span className="login-pill-dot"/>{f.icon} {f.text}
            </div>
          ))}
        </div>
      </div>

      <div className="login-right">
        <div className="login-form">
          <div className="login-steps">
            <div className={`login-step-dot ${step === 1 ? 'active' : 'done'}`}/>
            <div className={`login-step-dot ${step === 2 ? 'active' : 'inactive'}`}/>
          </div>

          {step === 1 ? (
            <>
              <h2 className="login-title">Sign in</h2>
              <p className="login-subtitle">Enter your phone number to receive a one-time code</p>

              {error && <div className="alert alert-error"><span className="alert-icon">⚠️</span>{error}</div>}

              <label className="login-label">Phone number</label>
              <div className="login-input-wrap">
                <span className="login-input-icon">📱</span>
                <input type="tel" placeholder="+91 98765 43210" value={phone} autoFocus
                  onChange={e => { setPhone(e.target.value); clearErr(); }}
                  onKeyDown={e => e.key === 'Enter' && phoneOk && !loading && handleRequestOtp()}
                  className={`login-input${error ? ' error' : ''}`}/>
              </div>

              <button className="btn-primary" disabled={!phoneOk || loading} onClick={handleRequestOtp}>
                {loading ? '⏳ Sending OTP…' : 'Send OTP →'}
              </button>

              <p className="login-terms">By continuing you agree to receive an SMS OTP.<br/>Standard messaging rates may apply.</p>

              {/* ── Backup login ── */}
              <div style={{ marginTop:20, paddingTop:20, borderTop:'1px solid #e5e7eb', textAlign:'center' }}>
                <p style={{ fontSize:12, color:'#9ca3af', margin:'0 0 10px' }}>
                  Not receiving OTP?
                </p>
                <button
                  className="btn-ghost green"
                  disabled={!phoneOk || loading}
                  onClick={handleDirectLogin}
                  style={{ width:'100%', justifyContent:'center', padding:'10px',
                           opacity: !phoneOk ? 0.4 : 1 }}
                >
                  {loading ? '⏳ Logging in…' : 'Continue without OTP →'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="login-title">Verify code</h2>
              <p className="login-subtitle">6-digit code sent to <b style={{ color:'#111827', fontFamily:'monospace' }}>{phone}</b></p>

              {error && <div className="alert alert-error"><span className="alert-icon">⚠️</span>{error}</div>}

              <label className="login-label">One-time password</label>
              <OtpInput value={otp} onChange={v => { setOtp(v); clearErr(); }}/>

              <button className="btn-primary" disabled={!otpOk || loading} onClick={handleVerifyOtp}>
                {loading ? '⏳ Verifying…' : 'Verify & Sign In ✓'}
              </button>
<div className="login-resend-row">
  {canResend
    ? <button className="btn-ghost green" onClick={() => {
        setCanResend(false);
        window.retryOtp(null,
          () => {},
          (err) => setError(err?.message || 'Resend failed')
        );
      }}>↻ Resend OTP</button>
    : <Countdown seconds={60} onDone={() => setCanResend(true)}/>
  }
  <button className="btn-ghost gray" onClick={() => { setStep(1); setOtp(''); clearErr(); }}>← Change number</button>
</div>

              {/* ── Backup login on OTP step too ── */}
              <div style={{ marginTop:20, paddingTop:16, borderTop:'1px solid #e5e7eb', textAlign:'center' }}>
                <button
                  className="btn-ghost green"
                  disabled={loading}
                  onClick={handleDirectLogin}
                  style={{ width:'100%', justifyContent:'center', padding:'10px', fontSize:13 }}
                >
                  {loading ? '⏳ Logging in…' : 'Skip OTP — Continue without code'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
