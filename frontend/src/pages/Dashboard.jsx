import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';
function renderMarkdown(md = '') {
  if (!md) return '';
  const lines = md.split('\n');
  const out   = [];
  let inList  = false;
  const closelist = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const inline    = (s) =>
    s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
     .replace(/\*(.+?)\*/g,     '<em>$1</em>');
  for (let raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s/.test(line)) {
      closelist();
      const lvl = line.match(/^(#{1,3})/)[1].length;
      const text = inline(line.replace(/^#{1,3}\s+/, ''));
      const tag  = lvl === 1 ? 'h2' : lvl === 2 ? 'h3' : 'h4';
      out.push(`<${tag} class="md-${tag}">${text}</${tag}>`);
    } else if (/^[-•]\s/.test(line)) {
      if (!inList) { out.push('<ul class="md-ul">'); inList = true; }
      out.push(`<li>${inline(line.replace(/^[-•]\s+/, ''))}</li>`);
    } else if (line === '') {
      closelist();
    } else {
      closelist();
      out.push(`<p class="md-p">${inline(line)}</p>`);
    }
  }
  closelist();
  return out.join('');
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata'
      }) : '—';

const emptyDetails = {
  name: '', age: '', gender: '', heightCm: '', weightKg: '', healthGoal: '', medicalNotes: ''
};

/* ─── 7-dot progress ─── */
const ProgressDots = ({ daysCompleted, expectedDay, windowExpired }) => (
  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', margin:'16px 0' }}>
    {Array.from({length:7}, (_,i) => {
      const day  = i + 1;
      const done = day <= daysCompleted;
      const cur  = !done && day === expectedDay && !windowExpired;
      return (
        <div key={day} title={`Day ${day}`} style={{
          width:40, height:40, borderRadius:'50%',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:13, fontWeight:700,
          background:  done ? '#15803d' : cur ? '#1d4ed8' : '#f3f4f6',
          color:       done ? '#fff'    : cur ? '#fff'    : '#9ca3af',
          boxShadow:   cur ? '0 0 0 3px #bfdbfe,0 0 0 5px #fff' : 'none',
          border: `2px solid ${done ? '#15803d' : cur ? '#1d4ed8' : '#e5e7eb'}`,
          transition:'all 0.2s',
        }}>
          {done ? '✓' : day}
        </div>
      );
    })}
    <span style={{ fontSize:13, color:'#6b7280', marginLeft:4 }}>
     {daysCompleted}/7 days
    </span>
  </div>
);

/* ─── Card wrapper ─── */
const Card = ({ children, style }) => (
  <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:20,
                 padding:24, marginBottom:20, ...style }}>
    {children}
  </div>
);

/* ─── Section heading ─── */
const SectionTitle = ({ icon, title, subtitle }) => (
  <div style={{ marginBottom:18 }}>
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ width:36, height:36, borderRadius:10, background:'#f0fdf4',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:18, flexShrink:0 }}>{icon}</span>
      <h3 style={{ margin:0, fontSize:17, fontWeight:700, color:'#111827' }}>{title}</h3>
    </div>
    {subtitle && <p style={{ margin:'6px 0 0 46px', fontSize:13, color:'#6b7280' }}>{subtitle}</p>}
  </div>
);

/* ─── Toast ─── */
const Toast = ({ msg }) => {
  if (!msg.text) return null;
  const ok = msg.type === 'success';
  return (
    <div style={{ padding:'12px 16px', borderRadius:12, marginBottom:16, fontSize:14,
                   display:'flex', alignItems:'center', gap:10,
                   background: ok ? '#f0fdf4' : '#fef2f2',
                   border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
                   color:  ok ? '#15803d' : '#b91c1c' }}>
      <span style={{ fontSize:18 }}>{ok ? '✅' : '⚠️'}</span>
      {msg.text}
    </div>
  );
};

/* ─── Labeled input ─── */
const Field = ({ label, value, onChange, placeholder, type='text' }) => (
  <div>
    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#6b7280',
                     marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>
      {label}
    </label>
    <input
      type={type}
      placeholder={placeholder || label}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      style={{ width:'100%', padding:'11px 14px', border:'1.5px solid #e5e7eb',
               borderRadius:10, fontSize:14, outline:'none', background:'#fafafa',
               boxSizing:'border-box', transition:'border-color 0.15s', fontFamily:'inherit' }}
      onFocus={e => { e.target.style.borderColor='#15803d'; e.target.style.background='#fff'; }}
      onBlur={e  => { e.target.style.borderColor='#e5e7eb'; e.target.style.background='#fafafa'; }}
    />
  </div>
);

/* ─── Gender picker ─── */
const GenderSelect = ({ value, onChange }) => (
  <div>
    <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#6b7280',
                     marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>
      Gender
    </label>
    <div style={{ display:'flex', gap:8 }}>
      {['Male','Female','Other'].map((g) => {
        const sel = value === g.toLowerCase();
        return (
          <button key={g} type="button" onClick={() => onChange(g.toLowerCase())}
            style={{ flex:1, padding:'11px 6px', borderRadius:10, fontSize:13,
                     fontWeight:500, cursor:'pointer', transition:'all 0.15s',
                     border:`1.5px solid ${sel ? '#15803d' : '#e5e7eb'}`,
                     background: sel ? '#f0fdf4' : '#fafafa',
                     color:      sel ? '#15803d' : '#6b7280' }}>
            {g}
          </button>
        );
      })}
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────────────────────────────────────── */
const Dashboard = () => {
  const [status,  setStatus]  = useState(null);
  const [details, setDetails] = useState(emptyDetails);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState({ text:'', type:'' });

  const showMsg  = (text, type='error') => setMsg({ text, type });
  const clearMsg = () => setMsg({ text:'', type:'' });

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
      await apiFetch('/habits/basic-details', { method:'PUT', body:JSON.stringify(payload) });
      showMsg('Basic details saved successfully', 'success');
      await getStatus();
    } catch (err) { showMsg(err.message); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setLoading(true); clearMsg();
    try {
      const res = await apiFetch('/habits/submit', {
        method:'POST', body:JSON.stringify({ foodDetails: input }),
      });
      showMsg(res.message, 'success');
      setInput('');
      await getStatus();
    } catch (err) { showMsg(err.message); }
    finally { setLoading(false); }
  };

  const handleGenerateReport = async () => {
    setLoading(true); clearMsg();
    try {
      await apiFetch('/habits/generate-analysis', { method:'POST' });
      await getStatus();
    } catch (err) { showMsg(err.message); }
    finally { setLoading(false); }
  };

  const downloadReport = () => {
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Food Habit Analysis</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.8;color:#1a1a1a}
h1{font-size:24px;color:#15803d;border-bottom:2px solid #86efac;padding-bottom:8px}
h2{font-size:18px;color:#166534;margin-top:24px}h3{font-size:15px;color:#15803d}
ul{padding-left:20px}li{margin-bottom:6px}strong{color:#15803d}
.meta{font-size:13px;color:#6b7280;margin-bottom:24px}</style>
</head><body>
<h1>🥗 7-Day Food Habit Analysis</h1>
<p class="meta">Phone: ${status.phone} | Generated: ${fmtDate(status.reportGeneratedAt)}</p>
${renderMarkdown(status.finalReport)}
</body></html>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type:'text/html' }));
    a.download = 'food-habit-analysis.html';
    a.click();
  };

  const logout = () => { localStorage.clear(); window.location.href = '/login'; };

  /* ── Loading ── */
  if (!status) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center',
                   justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ width:40, height:40, border:'3px solid #e5e7eb',
                    borderTopColor:'#15803d', borderRadius:'50%',
                    animation:'spin 0.8s linear infinite' }}/>
      <p style={{ color:'#6b7280', fontSize:14, margin:0 }}>Loading dashboard…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const { daysCompleted, entries, finalReport, reportGeneratedAt,
          startedAt, reportUnlockAt, expectedDay, windowExpired, submittedToday } = status;

  const allDone    = daysCompleted === 7;
  const reportReady = allDone && windowExpired;

  /* ── Entry section state machine ── */
  let entrySection;

  if (finalReport) {
    entrySection = (
      <div>
        <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',
                       border:'1px solid #86efac', borderRadius:16, padding:'20px 24px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
                         marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div>
              <h3 style={{ margin:'0 0 4px', fontSize:18, fontWeight:700, color:'#14532d' }}>
                Your 7-Day Food Analysis
              </h3>
              <p style={{ margin:0, fontSize:13, color:'#4ade80' }}>
                Generated on {fmtDate(reportGeneratedAt)}
              </p>
            </div>
            <button onClick={downloadReport} style={{
              padding:'10px 20px', background:'#15803d', color:'#fff', border:'none',
              borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:600,
              display:'flex', alignItems:'center', gap:6 }}>
              ⬇ Download
            </button>
          </div>
          <div className="report-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(finalReport) }}/>
        </div>
      </div>
    );
  } else if (allDone && !windowExpired) {
    const days = Math.ceil((new Date(reportUnlockAt) - new Date()) / 86400000);
    entrySection = (
      <div style={{ textAlign:'center', padding:'32px 0' }}>
        <div style={{ fontSize:52, marginBottom:12 }}>🎉</div>
        <h3 style={{ margin:'0 0 8px', fontSize:20 }}>All 7 days logged!</h3>
        <p style={{ color:'#6b7280', margin:'0 0 6px' }}>
          Report unlocks on <b style={{ color:'#15803d' }}>{fmtDate(reportUnlockAt)}</b>
        </p>
        {days > 0 && <p style={{ fontSize:13, color:'#9ca3af', margin:0 }}>{days} day{days>1?'s':''} to go</p>}
      </div>
    );
  } else if (reportReady) {
    entrySection = (
      <div style={{ textAlign:'center', padding:'28px 0' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
        <h3 style={{ margin:'0 0 8px' }}>Collection complete</h3>
        <p style={{ color:'#6b7280', marginBottom:20 }}>Your 7-day window ended. Your report is ready!</p>
        <button disabled={loading} onClick={handleGenerateReport} style={{
          padding:'14px 32px', background: loading ? '#d1d5db' : '#15803d',
          color:'#fff', border:'none', borderRadius:12, fontSize:16,
          fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? '⏳ AI Analysing…' : '🤖 Generate My Report'}
        </button>
      </div>
    );
  } else if (windowExpired && !allDone) {
    entrySection = (
      <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:14, padding:20 }}>
        <h3 style={{ margin:'0 0 8px', color:'#b91c1c' }}>⏰ Submission window closed</h3>
        <p style={{ margin:0, color:'#7f1d1d', fontSize:14 }}>
          Your window started on {fmtDate(startedAt)} has ended. You submitted {daysCompleted}/7 days.
          Please contact support for assistance.
        </p>
      </div>
    );
  } else if (submittedToday) {
    entrySection = (
      <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:14,
                     padding:24, textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:10 }}>☀️</div>
        <h3 style={{ margin:'0 0 6px', color:'#1e40af' }}>Day {daysCompleted} logged!</h3>
        <p style={{ margin:0, color:'#3b82f6', fontSize:14 }}>
          Come back tomorrow for Day {daysCompleted + 1}.
          {reportUnlockAt && ` Report unlocks ${fmtDate(reportUnlockAt)}.`}
        </p>
      </div>
    );
  } else {
    entrySection = (
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                       marginBottom:12, flexWrap:'wrap', gap:8 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#15803d', background:'#f0fdf4',
                          padding:'4px 12px', borderRadius:99, border:'1px solid #bbf7d0' }}>
            Day {expectedDay ?? daysCompleted + 1} of 7
          </span>
          {startedAt && (
            <span style={{ fontSize:12, color:'#9ca3af' }}>
              Started {fmtDate(startedAt)} · Unlocks {fmtDate(reportUnlockAt)}
            </span>
          )}
        </div>

        <textarea
          rows={6}
          placeholder={'Describe today\'s meals:\n• Breakfast — what, how much, what time?\n• Lunch — home-cooked or outside?\n• Dinner — meals, snacks, sweets?\n• Water intake, cravings, mood…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={5000}
          style={{ width:'100%', padding:'14px', border:'1.5px solid #e5e7eb', borderRadius:12,
                   fontSize:14, resize:'vertical', boxSizing:'border-box', fontFamily:'inherit',
                   lineHeight:1.6, outline:'none', background:'#fafafa', transition:'border-color 0.15s' }}
          onFocus={e => { e.target.style.borderColor='#15803d'; e.target.style.background='#fff'; }}
          onBlur={e  => { e.target.style.borderColor='#e5e7eb'; e.target.style.background='#fafafa'; }}
        />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
          <span style={{ fontSize:12, color: input.length > 4500 ? '#ef4444' : '#9ca3af' }}>
            {input.length}/5000
          </span>
          <button
            disabled={loading || !input.trim()}
            onClick={handleSubmit}
            style={{ padding:'12px 28px',
                     background: loading || !input.trim() ? '#d1d5db' : '#15803d',
                     color:'#fff', border:'none', borderRadius:10, fontSize:14,
                     fontWeight:600, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer' }}>
            {loading ? '⏳ Saving…' : `Submit Day ${expectedDay ?? daysCompleted + 1} →`}
          </button>
        </div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', fontFamily:"'DM Sans',system-ui,sans-serif" }}>

      {/* Nav */}
      <nav style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'0 28px',
                    height:60, display:'flex', alignItems:'center', justifyContent:'space-between',
                    position:'sticky', top:0, zIndex:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>🥗</span>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>Food Habit Tracker</div>
            <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>{status.phone}</div>
          </div>
        </div>
        <button onClick={logout} style={{ padding:'8px 18px', border:'1px solid #e5e7eb',
          borderRadius:10, background:'#fff', color:'#374151', cursor:'pointer', fontSize:13 }}>
          Logout
        </button>
      </nav>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'28px 16px' }}>
        <Toast msg={msg}/>

        {/* Basic Details */}
        <Card>
          <SectionTitle icon="👤" title="Basic Details"
            subtitle="Helps the AI give you a personalised nutrition report"/>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',
                         gap:14, marginBottom:14 }}>
            <Field label="Full name"   value={details.name}     onChange={v=>setDetails({...details,name:v})}/>
            <Field label="Age"         value={details.age}      onChange={v=>setDetails({...details,age:v})}      type="number" placeholder="e.g. 24"/>
            <Field label="Height (cm)" value={details.heightCm} onChange={v=>setDetails({...details,heightCm:v})} type="number" placeholder="e.g. 165"/>
            <Field label="Weight (kg)" value={details.weightKg} onChange={v=>setDetails({...details,weightKg:v})} type="number" placeholder="e.g. 60"/>
          </div>
          <div style={{ marginBottom:14 }}>
            <GenderSelect value={details.gender} onChange={v=>setDetails({...details,gender:v})}/>
          </div>
          <div style={{ marginBottom:14 }}>
            <Field label="Health goal" value={details.healthGoal} onChange={v=>setDetails({...details,healthGoal:v})}
              placeholder="e.g. lose weight, eat healthier"/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#6b7280',
                             marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>
              Medical notes / allergies
            </label>
            <textarea
              value={details.medicalNotes||''}
              onChange={e=>setDetails({...details,medicalNotes:e.target.value})}
              rows={2}
              placeholder="Any allergies, medications, or dietary restrictions…"
              style={{ width:'100%', padding:'12px 14px', border:'1.5px solid #e5e7eb',
                       borderRadius:10, fontSize:14, fontFamily:'inherit', resize:'vertical',
                       boxSizing:'border-box', outline:'none', background:'#fafafa' }}
              onFocus={e=>{e.target.style.borderColor='#15803d';e.target.style.background='#fff';}}
              onBlur={e=>{e.target.style.borderColor='#e5e7eb';e.target.style.background='#fafafa';}}
            />
          </div>
          <button disabled={loading} onClick={saveDetails} style={{
            marginTop:16, padding:'11px 24px', background:'#15803d', color:'#fff',
            border:'none', borderRadius:10, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize:14, fontWeight:600, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Saving…' : 'Save Details'}
          </button>
        </Card>

        {/* 7-Day Tracker */}
        <Card>
          <SectionTitle icon="📅" title="7-Day Food Habit Collection"
            subtitle="Log your meals every day for 7 consecutive calendar days"/>

          <ProgressDots daysCompleted={daysCompleted} expectedDay={expectedDay} windowExpired={windowExpired}/>

          {entries.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase',
                             letterSpacing:'0.05em', marginBottom:10 }}>Submitted Entries</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {entries.map((e) => (
                  <div key={e._id} style={{ background:'#fafafa', borderLeft:'3px solid #16a34a',
                                             border:'1px solid #f0fdf4', borderRadius:10, padding:'10px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#15803d',
                                     textTransform:'uppercase', letterSpacing:'0.04em' }}>
                        Day {e.dayNumber}
                      </span>
                      <span style={{ fontSize:11, color:'#9ca3af' }}>{fmtDate(e.dateSubmitted)}</span>
                    </div>
                    <p style={{ margin:0, fontSize:13, color:'#374151', lineHeight:1.6 }}>
                      {e.foodDetails.length>140 ? e.foodDetails.slice(0,140)+'…' : e.foodDetails}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entries.length > 0 && <div style={{ height:1, background:'#f3f4f6', margin:'4px 0 20px' }}/>}

          {entrySection}
        </Card>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .report-body{font-size:14px;line-height:1.75;color:#1a2e1a}
        .report-body .md-h2{font-size:16px;font-weight:700;color:#14532d;margin:18px 0 6px;padding-bottom:4px;border-bottom:1px solid #bbf7d0}
        .report-body .md-h3{font-size:14px;font-weight:700;color:#166534;margin:12px 0 4px}
        .report-body .md-h4{font-size:13px;font-weight:700;color:#15803d;margin:10px 0 3px}
        .report-body .md-ul{padding-left:20px;margin:6px 0 10px}
        .report-body .md-ul li{margin-bottom:5px}
        .report-body .md-p{margin:6px 0}
        .report-body strong{color:#15803d}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){nav{padding:0 16px!important}}
      `}</style>
    </div>
  );
};

export default Dashboard;
