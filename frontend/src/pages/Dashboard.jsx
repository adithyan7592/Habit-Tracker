import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';

function renderMarkdown(md = '') {
  if (!md) return '';
  const lines = md.split('\n'); const out = []; let inList = false;
  const closelist = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  for (let raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s/.test(line)) {
      closelist();
      const lvl = line.match(/^(#{1,3})/)[1].length;
      const tag = lvl === 1 ? 'h2' : lvl === 2 ? 'h3' : 'h4';
      out.push(`<${tag} class="md-${tag}">${inline(line.replace(/^#{1,3}\s+/, ''))}</${tag}>`);
    } else if (/^[-•]\s/.test(line)) {
      if (!inList) { out.push('<ul class="md-ul">'); inList = true; }
      out.push(`<li>${inline(line.replace(/^[-•]\s+/, ''))}</li>`);
    } else if (line === '') { closelist(); }
    else { closelist(); out.push(`<p class="md-p">${inline(line)}</p>`); }
  }
  closelist(); return out.join('');
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata'
}) : '—';

const emptyDetails = { name: '', age: '', gender: '', heightCm: '', weightKg: '', healthGoal: '', medicalNotes: '' };

const ProgressDots = ({ daysCompleted, expectedDay, windowExpired }) => (
  <div className="progress-dots">
    {Array.from({ length: 7 }, (_, i) => {
      const day = i + 1, done = day <= daysCompleted, cur = !done && day === expectedDay && !windowExpired;
      return (
        <div key={day} title={`Day ${day}`}
          className={`progress-dot ${done ? 'done' : cur ? 'today' : 'future'}`}>
          {done ? '✓' : day}
        </div>
      );
    })}
    <span className="progress-label">{daysCompleted}/7 days</span>
  </div>
);

const Toast = ({ msg }) => {
  if (!msg.text) return null;
  return (
    <div className={`toast ${msg.type === 'success' ? 'success' : 'error'}`}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{msg.type === 'success' ? '✅' : '⚠️'}</span>
      <span>{msg.text}</span>
    </div>
  );
};

const Field = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <label className="field-label">{label}</label>
    <input type={type} placeholder={placeholder || label} value={value || ''}
      onChange={e => onChange(e.target.value)} className="field-input"/>
  </div>
);

const GenderSelect = ({ value, onChange }) => (
  <div>
    <label className="field-label">Gender</label>
    <div className="gender-row">
      {['Male', 'Female', 'Other'].map(g => (
        <button key={g} type="button"
          className={`gender-btn${value === g.toLowerCase() ? ' selected' : ''}`}
          onClick={() => onChange(g.toLowerCase())}>{g}</button>
      ))}
    </div>
  </div>
);

const Dashboard = () => {
  const [status,  setStatus]  = useState(null);
  const [details, setDetails] = useState(emptyDetails);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState({ text: '', type: '' });

  const showMsg  = (text, type = 'error') => setMsg({ text, type });
  const clearMsg = () => setMsg({ text: '', type: '' });

  const getStatus = async () => {
    const data = await apiFetch('/habits/status');
    setStatus(data);
    setDetails({ ...emptyDetails, ...(data.basicDetails || {}) });
  };

  useEffect(() => { getStatus().catch(err => showMsg(err.message)); }, []);

  const saveDetails = async () => {
    setLoading(true); clearMsg();
    try {
      const payload = { ...details,
        age:      details.age      ? Number(details.age)      : undefined,
        heightCm: details.heightCm ? Number(details.heightCm) : undefined,
        weightKg: details.weightKg ? Number(details.weightKg) : undefined,
      };
      await apiFetch('/habits/basic-details', { method: 'PUT', body: JSON.stringify(payload) });
      showMsg('Basic details saved successfully', 'success');
      await getStatus();
    } catch (err) { showMsg(err.message); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setLoading(true); clearMsg();
    try {
      const res = await apiFetch('/habits/submit', { method: 'POST', body: JSON.stringify({ foodDetails: input }) });
      showMsg(res.message, 'success');
      setInput(''); await getStatus();
    } catch (err) { showMsg(err.message); }
    finally { setLoading(false); }
  };

  const handleGenerateReport = async () => {
    setLoading(true); clearMsg();
    try {
      await apiFetch('/habits/generate-analysis', { method: 'POST' });
      await getStatus();
    } catch (err) { showMsg(err.message); }
    finally { setLoading(false); }
  };

  const downloadReport = () => {
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Food Habit Analysis</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.8;color:#1a1a1a}
h1{font-size:24px;color:#15803d;border-bottom:2px solid #86efac;padding-bottom:8px}
h2{font-size:18px;color:#166534;margin-top:24px}h3{font-size:15px;color:#15803d}
ul{padding-left:20px}li{margin-bottom:6px}strong{color:#15803d}
.meta{font-size:13px;color:#6b7280;margin-bottom:24px}</style>
</head><body><h1>🥗 7-Day Food Habit Analysis</h1>
<p class="meta">Phone: ${status.phone} | Generated: ${fmtDate(status.reportGeneratedAt)}</p>
${renderMarkdown(status.finalReport)}</body></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = 'food-habit-analysis.html'; a.click();
  };

  const logout = () => { localStorage.clear(); window.location.href = '/login'; };

  if (!status) return (
    <div className="spinner-wrap">
      <div className="spinner"/>
      <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Loading dashboard…</p>
    </div>
  );

  const { daysCompleted, entries, finalReport, reportGeneratedAt,
          startedAt, reportUnlockAt, expectedDay, windowExpired, submittedToday } = status;

  const allDone    = daysCompleted === 7;
  const reportReady = allDone && windowExpired;

  let entrySection;

  if (finalReport) {
    entrySection = (
      <div className="report-box">
        <div className="report-header">
          <div>
            <h3 className="report-title">Your 7-Day Food Analysis</h3>
            <p className="report-date">Generated on {fmtDate(reportGeneratedAt)}</p>
          </div>
          <button className="btn-download" onClick={downloadReport}>⬇ Download</button>
        </div>
        <div className="report-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(finalReport) }}/>
      </div>
    );
  } else if (allDone && !windowExpired) {
    const days = Math.ceil((new Date(reportUnlockAt) - new Date()) / 86400000);
    entrySection = (
      <div className="state-card green">
        <div className="state-emoji">🎉</div>
        <h3 className="state-title green">All 7 days logged!</h3>
        <p className="state-text green">
          Report unlocks on <b style={{ color: '#15803d' }}>{fmtDate(reportUnlockAt)}</b>
        </p>
        {days > 0 && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>{days} day{days > 1 ? 's' : ''} to go</p>}
      </div>
    );
  } else if (reportReady) {
    entrySection = (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div className="state-emoji">✅</div>
        <h3 className="state-title green" style={{ textAlign: 'center' }}>Collection complete</h3>
        <p className="state-text green" style={{ textAlign: 'center', marginBottom: 16 }}>Your 7-day window ended. Your report is ready!</p>
        <button className="btn-generate" disabled={loading} onClick={handleGenerateReport}>
          {loading ? '⏳ AI Analysing…' : '🤖 Generate My Report'}
        </button>
      </div>
    );
  } else if (windowExpired && !allDone) {
    entrySection = (
      <div className="state-card red">
        <h3 className="state-title red">⏰ Submission window closed</h3>
        <p className="state-text red">
          Your window started on {fmtDate(startedAt)} has ended.
          You submitted {daysCompleted}/7 days. Please contact support.
        </p>
      </div>
    );
  } else if (submittedToday && expectedDay <= daysCompleted) {
    entrySection = (
      <div className="state-card blue">
        <div className="state-emoji">☀️</div>
        <h3 className="state-title blue">Day {daysCompleted} logged!</h3>
        <p className="state-text blue">
          Come back tomorrow for Day {daysCompleted + 1}.
          {reportUnlockAt && ` Report unlocks ${fmtDate(reportUnlockAt)}.`}
        </p>
      </div>
    );
  } else {
    entrySection = (
      <div>
        <div className="entry-header">
          <span className="entry-day-badge">Day {expectedDay ?? daysCompleted + 1} of 7</span>
          {startedAt && <span className="entry-unlock-text">Unlocks {fmtDate(reportUnlockAt)}</span>}
        </div>
        <textarea className="entry-textarea" rows={5}
          placeholder={'Describe today\'s meals:\n• Breakfast — what, how much, time?\n• Lunch — home-cooked or outside?\n• Dinner, snacks, sweets?\n• Water intake, cravings…'}
          value={input} onChange={e => setInput(e.target.value)} maxLength={5000}
        />
        <div className="entry-footer">
          <span className={`char-count${input.length > 4500 ? ' warn' : ''}`}>{input.length}/5000</span>
          <button className="btn-submit" disabled={loading || !input.trim()} onClick={handleSubmit}>
            {loading ? '⏳ Saving…' : `Submit Day ${expectedDay ?? daysCompleted + 1} →`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <nav className="app-nav">
        <div className="app-nav-brand">
          <span className="app-nav-logo">🥗</span>
          <div>
            <div className="app-nav-title">Food Habit Tracker</div>
            <div className="app-nav-phone">{status.phone}</div>
          </div>
        </div>
        <button className="btn-nav danger" onClick={logout}>Logout</button>
      </nav>

      <div className="dashboard-container">
        <Toast msg={msg}/>

        {/* Basic Details */}
        <div className="card">
          <div className="section-title">
            <div className="section-title-row">
              <span className="section-title-icon">👤</span>
              <h3 className="section-title-text">Basic Details</h3>
            </div>
            <p className="section-title-sub">Helps the AI give you a personalised nutrition report</p>
          </div>

          <div className="details-grid">
            <Field label="Full name"   value={details.name}     onChange={v => setDetails({...details, name: v})}/>
            <Field label="Age"         value={details.age}      onChange={v => setDetails({...details, age: v})}      type="number" placeholder="e.g. 24"/>
            <Field label="Height (cm)" value={details.heightCm} onChange={v => setDetails({...details, heightCm: v})} type="number" placeholder="e.g. 165"/>
            <Field label="Weight (kg)" value={details.weightKg} onChange={v => setDetails({...details, weightKg: v})} type="number" placeholder="e.g. 60"/>
          </div>

          <div style={{ marginBottom: 12 }}>
            <GenderSelect value={details.gender} onChange={v => setDetails({...details, gender: v})}/>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Field label="Health goal" value={details.healthGoal}
              onChange={v => setDetails({...details, healthGoal: v})}
              placeholder="e.g. lose weight, eat healthier"/>
          </div>
          <div>
            <label className="field-label">Medical notes / allergies</label>
            <textarea className="field-textarea" rows={2}
              placeholder="Any allergies, medications, or dietary restrictions…"
              value={details.medicalNotes || ''}
              onChange={e => setDetails({...details, medicalNotes: e.target.value})}/>
          </div>
          <button className="btn-save" disabled={loading} onClick={saveDetails}>
            {loading ? 'Saving…' : 'Save Details'}
          </button>
        </div>

        {/* 7-Day Tracker */}
        <div className="card">
          <div className="section-title">
            <div className="section-title-row">
              <span className="section-title-icon">📅</span>
              <h3 className="section-title-text">7-Day Food Habit Collection</h3>
            </div>
            <p className="section-title-sub">Log your meals every day for 7 consecutive calendar days</p>
          </div>

          <ProgressDots daysCompleted={daysCompleted} expectedDay={expectedDay} windowExpired={windowExpired}/>

          {entries.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="entries-label">Submitted Entries</div>
              {entries.map(e => (
                <div key={e._id} className="entry-card">
                  <div className="entry-card-header">
                    <span className="entry-day-label">Day {e.dayNumber}</span>
                    <span className="entry-date">{fmtDate(e.dateSubmitted)}</span>
                  </div>
                  <p className="entry-text">
                    {e.foodDetails.length > 140 ? e.foodDetails.slice(0, 140) + '…' : e.foodDetails}
                  </p>
                </div>
              ))}
            </div>
          )}

          {entries.length > 0 && <div className="divider"/>}
          {entrySection}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

