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

/* ── Progress dots ── */
const ProgressDots = ({ daysCompleted, expectedDay, windowExpired, currentWeek }) => (
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
    <span className="progress-label">Week {currentWeek} · {daysCompleted}/7 days</span>
  </div>
);

/* ── Toast ── */
const Toast = ({ msg }) => {
  if (!msg.text) return null;
  return (
    <div className={`toast ${msg.type === 'success' ? 'success' : 'error'}`}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{msg.type === 'success' ? '✅' : '⚠️'}</span>
      <span>{msg.text}</span>
    </div>
  );
};

/* ── Field ── */
const Field = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <label className="field-label">{label}</label>
    <input type={type} placeholder={placeholder || label} value={value || ''}
      onChange={e => onChange(e.target.value)} className="field-input"/>
  </div>
);

/* ── Gender select ── */
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

/* ── Single meal card ── */
const MealCard = ({ icon, label, mealKey, savedValue, onSubmit, loadingMeal }) => {
  const [value, setValue] = useState('');
  const isSaved    = !!savedValue;
  const isLoading  = loadingMeal === mealKey;

  if (isSaved) {
    return (
      <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0',
                     borderRadius:12, padding:'12px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <span style={{ fontSize:16 }}>{icon}</span>
          <span style={{ fontSize:12, fontWeight:700, color:'#15803d',
                          textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
          <span style={{ marginLeft:'auto', fontSize:12, color:'#15803d',
                          background:'#dcfce7', padding:'2px 8px', borderRadius:99,
                          fontWeight:600 }}>✓ Saved</span>
        </div>
        <p style={{ margin:0, fontSize:13, color:'#374151', lineHeight:1.5 }}>{savedValue}</p>
      </div>
    );
  }

  return (
    <div style={{ background:'#fafafa', border:'1.5px solid #e5e7eb',
                   borderRadius:12, padding:'14px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ fontSize:16 }}>{icon}</span>
        <label style={{ fontSize:12, fontWeight:700, color:'#374151',
                         textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</label>
      </div>
      <textarea
        className="entry-textarea"
        rows={2}
        placeholder={
          mealKey === 'breakfast' ? 'e.g. Puttu and kadala curry, tea...' :
          mealKey === 'lunch'     ? 'e.g. Rice, fish curry, sambar...' :
                                   'e.g. Chapathi, egg curry...'
        }
        value={value}
        onChange={e => setValue(e.target.value)}
        maxLength={1000}
        style={{ marginBottom:10 }}
      />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:11, color:'#9ca3af' }}>{value.length}/1000</span>
        <button
          className="btn-submit"
          disabled={isLoading || !value.trim()}
          onClick={() => onSubmit(mealKey, value, () => setValue(''))}
          style={{ padding:'8px 20px', fontSize:13 }}
        >
          {isLoading ? '⏳ Saving…' : `Save ${label}`}
        </button>
      </div>
    </div>
  );
};

/* ── Main Dashboard ── */
const Dashboard = () => {
  const [status,     setStatus]     = useState(null);
  const [details,    setDetails]    = useState(emptyDetails);
  const [loading,    setLoading]    = useState(false);
  const [loadingMeal,setLoadingMeal]= useState(''); // which meal is being saved
  const [msg,        setMsg]        = useState({ text: '', type: '' });

  const showMsg = (text, type = 'error') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };
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

  // ── Submit individual meal ────────────────────────────────────────────────
  const handleMealSubmit = async (meal, value, clearField) => {
    setLoadingMeal(meal); clearMsg();
    try {
      const res = await apiFetch('/habits/submit-meal', {
        method: 'POST',
        body: JSON.stringify({ meal, value })
      });
      showMsg(res.message, 'success');
      clearField();
      await getStatus();
    } catch (err) { showMsg(err.message); }
    finally { setLoadingMeal(''); }
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
        startedAt, reportUnlockAt, expectedDay, windowExpired, submittedToday,
        currentWeek, weekStartedAt, weekExpired, weekReports, currentWeekReport,
        todayEntry } = status;

const allDone     = daysCompleted === 7;
const reportReady = weekExpired || allDone;

// TO:
// todayEntry now comes directly from backend — no local calculation needed

  const todayBreakfast = todayEntry?.breakfast || '';
  const todayLunch     = todayEntry?.lunch     || '';
  const todayDinner    = todayEntry?.dinner    || '';
  const allMealsDone   = !!(todayBreakfast && todayLunch && todayDinner);

  // ── Entry section state machine ───────────────────────────────────────────
  let entrySection;

   if (allDone && !windowExpired) {
    const days = Math.ceil((new Date(reportUnlockAt) - new Date()) / 86400000);
    entrySection = (
      <div className="state-card green">
        <div className="state-emoji">🎉</div>
     <h3 className="state-title green">Week {currentWeek} complete!</h3>
<p className="state-text green">
  All 7 days logged. Report unlocks on <b style={{ color: '#15803d' }}>{fmtDate(reportUnlockAt)}</b>
</p>
        {days > 0 && <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>{days} day{days > 1 ? 's' : ''} to go</p>}
      </div>
    );

  } else if (reportReady) {
    entrySection = (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div className="state-emoji">✅</div>
       <h3 className="state-title green" style={{ textAlign: 'center' }}>Week {currentWeek} complete</h3>
<p className="state-text green" style={{ textAlign: 'center', marginBottom: 16 }}>
  Your 7-day window ended. Generate your Week {currentWeek} report!
</p>
        <button className="btn-generate" disabled={loading} onClick={handleGenerateReport}>
          {loading ? '⏳ AI Analysing…' : '🤖 Generate My Report'}
        </button>
      </div>
    );

 } else if (weekExpired && !allDone) {
  entrySection = (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div className="state-emoji">📋</div>
      <h3 className="state-title green" style={{ textAlign: 'center' }}>
        Week {currentWeek} ended
      </h3>
      <p className="state-text green" style={{ textAlign: 'center', marginBottom: 16 }}>
        You submitted {daysCompleted}/7 days. Generate your report to continue to Week {(currentWeek || 1) + 1}.
      </p>
      <button className="btn-generate" disabled={loading} onClick={handleGenerateReport}>
        {loading ? '⏳ AI Analysing…' : `🤖 Generate Week ${currentWeek} Report`}
      </button>
    </div>
  );

  } else if (allMealsDone) {
    // All 3 meals submitted today — day is locked
    entrySection = (
      <div className="state-card blue">
        <div className="state-emoji">☀️</div>
        <h3 className="state-title blue">Day {daysCompleted} complete!</h3>
        <p className="state-text blue">
          All 3 meals logged for today. Come back tomorrow for Day {daysCompleted + 1}.
          {reportUnlockAt && ` Report unlocks ${fmtDate(reportUnlockAt)}.`}
        </p>
      </div>
    );

  } else {
    // ── Meal entry form ───────────────────────────────────────────────────
    const currentDay = expectedDay ?? daysCompleted + 1;

    entrySection = (
      <div>
        <div className="entry-header">
          <span className="entry-day-badge">Day {currentDay} of 7</span>
          {startedAt && <span className="entry-unlock-text">Unlocks {fmtDate(reportUnlockAt)}</span>}
        </div>

        {/* Progress indicator for today's meals */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {[
            { key:'breakfast', icon:'🌅', label:'Breakfast', done:!!todayBreakfast },
            { key:'lunch',     icon:'☀️', label:'Lunch',     done:!!todayLunch },
            { key:'dinner',    icon:'🌙', label:'Dinner',    done:!!todayDinner },
          ].map(m => (
            <span key={m.key} style={{
              fontSize:12, padding:'4px 12px', borderRadius:99, fontWeight:500,
              background: m.done ? '#dcfce7' : '#f3f4f6',
              color:      m.done ? '#15803d' : '#9ca3af',
              border: `1px solid ${m.done ? '#bbf7d0' : '#e5e7eb'}`,
            }}>
              {m.icon} {m.label} {m.done ? '✓' : ''}
            </span>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <MealCard icon="🌅" label="Breakfast" mealKey="breakfast"
            savedValue={todayBreakfast}
            onSubmit={handleMealSubmit}
            loadingMeal={loadingMeal}/>

          <MealCard icon="☀️" label="Lunch" mealKey="lunch"
            savedValue={todayLunch}
            onSubmit={handleMealSubmit}
            loadingMeal={loadingMeal}/>

          <MealCard icon="🌙" label="Dinner" mealKey="dinner"
            savedValue={todayDinner}
            onSubmit={handleMealSubmit}
            loadingMeal={loadingMeal}/>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
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
              placeholder="e.g. Control diabetes, lose weight, eat healthier"/>
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
           <div style={{ background:'#EAF3DE', border:'0.5px solid #C0DD97',
                 borderRadius:12, padding:'12px 14px', marginBottom:16,
                 display:'flex', alignItems:'flex-start', gap:10 }}>
    <div style={{ width:32, height:32, borderRadius:'50%', background:'#639922',
                   display:'flex', alignItems:'center', justifyContent:'center',
                   flexShrink:0, marginTop:2 }}>
      <span style={{ fontSize:16, color:'#fff' }}>ℹ</span>
    </div>
    <div>
      <p style={{ margin:'0 0 4px', fontSize:13, fontWeight:500, color:'#3B6D11' }}>
        90 Days Diabetes Control Program
      </p>
      <p style={{ margin:0, fontSize:13, color:'#27500A', lineHeight:1.6 }}>
        To get accurate results, you must fill the Habit Report
        continuously for <strong style={{ color:'#3B6D11' }}>7 days</strong>.
        Missing even one day will delay your report.
      </p>
    </div>
  </div>
          <div className="section-title">
            <div className="section-title-row">
              <span className="section-title-icon">📅</span>
              <h3 className="section-title-text">7-Day Food Habit Collection</h3>
            </div>
           <p className="section-title-sub">Week {currentWeek} — Log your meals every day for 7 consecutive days</p>
          </div>

          <ProgressDots daysCompleted={daysCompleted} expectedDay={expectedDay} windowExpired={windowExpired} currentWeek={currentWeek}/>

          {/* Submitted entries */}
          {entries.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="entries-label">Submitted Entries</div>
              {entries.map(e => (
                <div key={e._id} className="entry-card">
                  <div className="entry-card-header">
                    <span className="entry-day-label">Day {e.dayNumber}</span>
                    <span className="entry-date">{fmtDate(e.dateSubmitted)}</span>
                  </div>
                  {e.breakfast ? (
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                      <div><b style={{ color:'#15803d' }}>🌅 Breakfast:</b> {e.breakfast}</div>
                      <div><b style={{ color:'#15803d' }}>☀️ Lunch:</b> {e.lunch}</div>
                      <div><b style={{ color:'#15803d' }}>🌙 Dinner:</b> {e.dinner}</div>
                    </div>
                  ) : (
                    <p className="entry-text">
                      {e.foodDetails && e.foodDetails.length > 140
                        ? e.foodDetails.slice(0, 140) + '…'
                        : e.foodDetails}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {entries.length > 0 && <div className="divider"/>}
          {entrySection}
        </div>
        {/* Past weekly reports */}
{weekReports && weekReports.length > 0 && (
  <div className="card">
    <div className="section-title">
      <div className="section-title-row">
        <span className="section-title-icon">📊</span>
        <h3 className="section-title-text">Previous Weekly Reports</h3>
      </div>
      <p className="section-title-sub">Compare your progress week by week</p>
    </div>

    {[...weekReports].reverse().map(r => (
      <div key={r.weekNumber} style={{ marginBottom: 20 }}>
        <div style={{ display:'flex', justifyContent:'space-between',
                       alignItems:'center', marginBottom:8,
                       paddingBottom:8, borderBottom:'1px solid #f3f4f6' }}>
          <span style={{ fontSize:14, fontWeight:700, color:'#15803d' }}>
            Week {r.weekNumber}
          </span>
          <span style={{ fontSize:12, color:'#9ca3af' }}>
            {r.daysSubmitted}/7 days · {fmtDate(r.generatedAt)}
          </span>
        </div>
        <div className="report-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(r.report) }}
          style={{ background:'#f9fafb', border:'1px solid #e5e7eb',
                   borderRadius:10, padding:'12px 14px' }}
        />
      </div>
    ))}
  </div>
)}
      </div>
    </div>
  );
};

export default Dashboard;
