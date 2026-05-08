import React, { useEffect, useState, useCallback } from 'react';
import { API_BASE, apiFetch, authHeaders } from '../api';

/* ─────────────────────────────────────────────────────────────────────────────
   MARKDOWN → HTML  (no external lib needed — covers the subset Claude returns)
   Handles: # headings, **bold**, - bullet lists, blank-line paragraphs
───────────────────────────────────────────────────────────────────────────── */
function renderMarkdown(md = '') {
  if (!md) return '';
  const lines  = md.split('\n');
  const out    = [];
  let inList   = false;

  const closelist = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const inline    = (s) =>
    s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>');

  for (let raw of lines) {
    const line = raw.trimEnd();

    if (/^#{1,3}\s/.test(line)) {
      closelist();
      const lvl  = line.match(/^(#{1,3})/)[1].length;
      const text = inline(line.replace(/^#{1,3}\s+/, ''));
      const tag  = lvl === 1 ? 'h2' : lvl === 2 ? 'h3' : 'h4';
      out.push(`<${tag}>${text}</${tag}>`);

    } else if (/^[-•]\s/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^[-•]\s+/, ''))}</li>`);

    } else if (line === '') {
      closelist();
      out.push('<br/>');

    } else {
      closelist();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closelist();
  return out.join('');
}

/* ─────────────────────────────────────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────────────────────────────────────── */
const Badge = ({ days, hasReport }) => {
  const cfg =
    hasReport     ? { label: 'Report ready',   bg: '#d1fae5', color: '#065f46', dot: '#10b981' } :
    days === 7    ? { label: 'Awaiting report', bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' } :
    days === 0    ? { label: 'Not started',     bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' } :
                    { label: `Day ${days}/7`,   bg: '#eff6ff', color: '#1e40af', dot: '#3b82f6' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:500,
                   background:cfg.bg, color:cfg.color, padding:'3px 10px', borderRadius:20 }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:cfg.dot, flexShrink:0 }}/>
      {cfg.label}
    </span>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   PROGRESS BAR  (7 day dots)
───────────────────────────────────────────────────────────────────────────── */
const ProgressBar = ({ completed }) => (
  <div style={{ display:'flex', gap:4, alignItems:'center' }}>
    {Array.from({length:7}, (_,i) => (
      <div key={i} style={{
        width:9, height:9, borderRadius:'50%', flexShrink:0,
        background: i < completed ? '#16a34a' : '#e5e7eb',
        transition:'background 0.2s'
      }}/>
    ))}
    <span style={{ fontSize:12, color:'#6b7280', marginLeft:4, fontVariantNumeric:'tabular-nums' }}>
      {completed}/7
    </span>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   DETAIL ROW  (label + value)
───────────────────────────────────────────────────────────────────────────── */
const DetailRow = ({ label, value }) => (
  value ? (
    <div style={{ display:'flex', gap:12, padding:'9px 0',
                  borderBottom:'1px solid #f3f4f6', alignItems:'flex-start' }}>
      <span style={{ fontSize:12, color:'#9ca3af', minWidth:90, paddingTop:1,
                     fontWeight:500, textTransform:'uppercase', letterSpacing:'0.04em' }}>
        {label}
      </span>
      <span style={{ fontSize:14, color:'#111827', flex:1, lineHeight:1.5 }}>{value}</span>
    </div>
  ) : null
);

/* ─────────────────────────────────────────────────────────────────────────────
   SLIDE-IN DRAWER  (replaces the plain <div> detail panel)
───────────────────────────────────────────────────────────────────────────── */
const Drawer = ({ user, onClose }) => {
  if (!user) return null;
  const bd = user.basicDetails || {};

  return (
    <>
      {/* Scrim */}
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:40,
        animation:'fadeIn 0.18s ease'
      }}/>

      {/* Panel */}
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, width:'min(600px,100vw)',
        background:'#fff', zIndex:50, overflowY:'auto',
        boxShadow:'-8px 0 32px rgba(0,0,0,0.12)',
        animation:'slideIn 0.22s cubic-bezier(0.16,1,0.3,1)'
      }}>

        {/* ── Drawer header ── */}
        <div style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb',
                       padding:'20px 24px', position:'sticky', top:0, zIndex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, letterSpacing:'0.06em',
                            textTransform:'uppercase', marginBottom:4 }}>
                Customer Profile
              </div>
              <div style={{ fontSize:18, fontWeight:700, color:'#111827', fontFamily:'monospace',
                            letterSpacing:'-0.5px' }}>
                {user.phone}
              </div>
            </div>
            <button onClick={onClose} style={{
              width:34, height:34, borderRadius:'50%', border:'1px solid #e5e7eb',
              background:'#fff', cursor:'pointer', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:18, color:'#6b7280', flexShrink:0
            }}>×</button>
          </div>

          <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
            <Badge days={user.daysCompleted} hasReport={!!user.finalReport}/>
            {user.startedAt && (
              <span style={{ fontSize:12, color:'#6b7280', display:'flex', alignItems:'center', gap:4 }}>
                📅 Started {new Date(user.startedAt).toLocaleDateString('en-IN',
                  { day:'numeric', month:'short', year:'numeric' })}
              </span>
            )}
          </div>
        </div>

        <div style={{ padding:'0 24px 40px' }}>

          {/* ── Basic details ── */}
          {Object.values(bd).some(Boolean) ? (
            <section style={{ marginTop:24 }}>
              <SectionTitle icon="👤" label="Basic Details"/>
              <div style={{ background:'#fafafa', borderRadius:10, padding:'4px 16px',
                            border:'1px solid #f3f4f6' }}>
                <DetailRow label="Name"        value={bd.name}/>
                <DetailRow label="Age"         value={bd.age ? `${bd.age} years` : null}/>
                <DetailRow label="Gender"      value={bd.gender}/>
                <DetailRow label="Height"      value={bd.heightCm ? `${bd.heightCm} cm` : null}/>
                <DetailRow label="Weight"      value={bd.weightKg ? `${bd.weightKg} kg` : null}/>
                <DetailRow label="Goal"        value={bd.healthGoal}/>
                <DetailRow label="Med. Notes"  value={bd.medicalNotes}/>
              </div>
            </section>
          ) : (
            <EmptyState icon="📋" text="No basic details submitted yet"/>
          )}

          {/* ── Food entries ── */}
          <section style={{ marginTop:28 }}>
            <SectionTitle icon="🍱" label="Food Habit Diary"/>
            {user.entries?.length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {user.entries.map((e) => (
                  <div key={e._id} style={{
                    background:'#fafafa', border:'1px solid #f0fdf4',
                    borderLeft:'3px solid #16a34a', borderRadius:8,
                    padding:'10px 14px'
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#15803d',
                                     textTransform:'uppercase', letterSpacing:'0.05em' }}>
                        Day {e.dayNumber}
                      </span>
                      {e.dateSubmitted && (
                        <span style={{ fontSize:11, color:'#9ca3af' }}>
                          {new Date(e.dateSubmitted).toLocaleDateString('en-IN',
                            { day:'numeric', month:'short' })}
                        </span>
                      )}
                    </div>
                    <p style={{ margin:0, fontSize:13, color:'#374151', lineHeight:1.6 }}>
                      {e.foodDetails}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="🍽️" text="No food entries submitted yet"/>
            )}
          </section>

          {/* ── Final report ── */}
          {user.finalReport && (
            <section style={{ marginTop:28 }}>
              <SectionTitle icon="📊" label="AI Food Habit Report"/>
              <div
                style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10,
                          padding:'16px 20px', lineHeight:1.75, fontSize:14, color:'#1a2e1a' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(user.finalReport) }}
              />
              {user.reportGeneratedAt && (
                <p style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>
                  Generated on {new Date(user.reportGeneratedAt).toLocaleString('en-IN',
                    { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                </p>
              )}
            </section>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes slideIn { from { transform:translateX(100%) } to { transform:translateX(0) } }
        .report-content h2 { font-size:16px; font-weight:700; margin:16px 0 6px; color:#14532d }
        .report-content h3 { font-size:14px; font-weight:700; margin:12px 0 4px; color:#166534 }
        .report-content ul { padding-left:18px; margin:6px 0 }
        .report-content li { margin-bottom:4px }
        .report-content p  { margin:6px 0 }
        .report-content strong { color:#15803d }
      `}</style>
    </>
  );
};

const SectionTitle = ({ icon, label }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
    <span style={{ fontSize:16 }}>{icon}</span>
    <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:'#374151',
                  textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</h3>
  </div>
);

const EmptyState = ({ icon, text }) => (
  <div style={{ textAlign:'center', padding:'20px 0', color:'#9ca3af', fontSize:13 }}>
    <div style={{ fontSize:28, marginBottom:6 }}>{icon}</div>
    {text}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   SUMMARY STAT CARD
───────────────────────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, color }) => (
  <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10,
                 padding:'14px 18px', minWidth:110 }}>
    <div style={{ fontSize:26, fontWeight:700, color: color || '#111827' }}>{value}</div>
    <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{label}</div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN ADMIN PANEL
───────────────────────────────────────────────────────────────────────────── */
const AdminPanel = () => {
  const [usersData, setUsersData] = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('all'); // all | active | complete | reported
  const [message,   setMessage]   = useState('');
  const [loading,   setLoading]   = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/admin/all-data');
      // filter out the admin user
      setUsersData(data.filter(u => u.role !== 'admin'));
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const downloadCSV = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/download-csv`, { headers: authHeaders() });
      if (!res.ok) throw new Error('CSV download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'food_habits_report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const logout = () => { localStorage.clear(); window.location.href = '/login'; };

  // ── Stats ──
  const total    = usersData.length;
  const active   = usersData.filter(u => u.daysCompleted > 0 && u.daysCompleted < 7).length;
  const complete = usersData.filter(u => u.daysCompleted === 7).length;
  const reported = usersData.filter(u => u.finalReport).length;

  // ── Filter + search ──
  const filtered = usersData.filter(u => {
    const matchSearch = !search ||
      u.phone.includes(search) ||
      (u.basicDetails?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'active'   ? (u.daysCompleted > 0 && u.daysCompleted < 7) :
      filter === 'complete' ? u.daysCompleted === 7 :
      filter === 'reported' ? !!u.finalReport : true;
    return matchSearch && matchFilter;
  });

  const filterBtnStyle = (key) => ({
    padding:'6px 14px', borderRadius:20, fontSize:13, cursor:'pointer',
    fontWeight: filter === key ? 600 : 400,
    background: filter === key ? '#15803d' : 'transparent',
    color:       filter === key ? '#fff'    : '#6b7280',
    border:      filter === key ? '1px solid #15803d' : '1px solid #e5e7eb',
    transition:'all 0.15s'
  });

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', fontFamily:'system-ui, sans-serif' }}>

      {/* ── Top nav ── */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb',
                     padding:'0 28px', height:56,
                     display:'flex', alignItems:'center', justifyContent:'space-between',
                     position:'sticky', top:0, zIndex:30 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>🥗</span>
          <span style={{ fontSize:15, fontWeight:700, color:'#111827' }}>Food Habit Tracker</span>
          <span style={{ fontSize:12, background:'#dcfce7', color:'#15803d', padding:'2px 8px',
                          borderRadius:20, fontWeight:600 }}>Admin</span>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={loadData} style={{
            padding:'7px 14px', borderRadius:8, border:'1px solid #e5e7eb',
            background:'#fff', cursor:'pointer', fontSize:13, color:'#374151'
          }}>↻ Refresh</button>
          <button onClick={downloadCSV} style={{
            padding:'7px 16px', borderRadius:8, border:'none',
            background:'#15803d', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600
          }}>⬇ Download CSV</button>
          <button onClick={logout} style={{
            padding:'7px 14px', borderRadius:8, border:'1px solid #e5e7eb',
            background:'#fff', cursor:'pointer', fontSize:13, color:'#ef4444'
          }}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'28px 20px' }}>

        {/* ── Page title ── */}
        <div style={{ marginBottom:24 }}>
          <h1 style={{ margin:'0 0 4px', fontSize:22, fontWeight:700, color:'#111827' }}>
            Admin Control Panel
          </h1>
          <p style={{ margin:0, color:'#6b7280', fontSize:14 }}>
            Monitor all customers' 7-day food habit submissions
          </p>
        </div>

        {/* ── Error ── */}
        {message && (
          <div style={{ background:'#fef2f2', border:'1px solid #fecaca', color:'#b91c1c',
                         padding:'10px 14px', borderRadius:8, marginBottom:20, fontSize:14 }}>
            {message}
          </div>
        )}

        {/* ── Stat cards ── */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:24 }}>
          <StatCard label="Total users"     value={total}    />
          <StatCard label="In progress"     value={active}   color="#2563eb"/>
          <StatCard label="All 7 days done" value={complete} color="#d97706"/>
          <StatCard label="Reports generated" value={reported} color="#15803d"/>
        </div>

        {/* ── Search + filters ── */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by phone or name…"
            style={{ flex:1, minWidth:200, padding:'8px 14px', borderRadius:8,
                      border:'1px solid #e5e7eb', fontSize:14, outline:'none',
                      background:'#fff' }}
          />
          {['all','active','complete','reported'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={filterBtnStyle(f)}>
              {f === 'all' ? 'All' : f === 'active' ? 'In Progress' :
               f === 'complete' ? 'Completed' : 'Report Ready'}
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>
              No users match your search.
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:580 }}>
                <thead>
                  <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                    {['Phone','Name','Age','Goal','Progress','Status','Action'].map(h => (
                      <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:11,
                                            fontWeight:700, color:'#6b7280', textTransform:'uppercase',
                                            letterSpacing:'0.05em', whiteSpace:'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user, idx) => {
                    const bd = user.basicDetails || {};
                    return (
                      <tr key={user.phone} style={{
                        borderBottom: idx < filtered.length-1 ? '1px solid #f3f4f6' : 'none',
                        transition:'background 0.1s'
                      }}
                        onMouseEnter={e => e.currentTarget.style.background='#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background='transparent'}
                      >
                        <td style={{ padding:'13px 16px', fontFamily:'monospace', fontSize:13,
                                      color:'#374151', whiteSpace:'nowrap' }}>
                          {user.phone}
                        </td>
                        <td style={{ padding:'13px 16px', fontSize:14, color:'#111827',
                                      fontWeight: bd.name ? 500 : 400 }}>
                          {bd.name || <span style={{ color:'#9ca3af' }}>—</span>}
                        </td>
                        <td style={{ padding:'13px 16px', fontSize:14, color:'#6b7280' }}>
                          {bd.age || <span style={{ color:'#9ca3af' }}>—</span>}
                        </td>
                        <td style={{ padding:'13px 16px', fontSize:13, color:'#6b7280',
                                      maxWidth:130, overflow:'hidden', textOverflow:'ellipsis',
                                      whiteSpace:'nowrap' }}>
                          {bd.healthGoal || <span style={{ color:'#d1d5db' }}>—</span>}
                        </td>
                        <td style={{ padding:'13px 16px' }}>
                          <ProgressBar completed={user.daysCompleted}/>
                        </td>
                        <td style={{ padding:'13px 16px' }}>
                          <Badge days={user.daysCompleted} hasReport={!!user.finalReport}/>
                        </td>
                        <td style={{ padding:'13px 16px' }}>
                          <button
                            onClick={() => setSelected(user)}
                            style={{
                              padding:'6px 16px', borderRadius:7, border:'1px solid #d1d5db',
                              background:'#fff', cursor:'pointer', fontSize:13, fontWeight:500,
                              color:'#374151', transition:'all 0.15s'
                            }}
                            onMouseEnter={e => { e.target.style.background='#f0fdf4'; e.target.style.borderColor='#86efac'; e.target.style.color='#15803d'; }}
                            onMouseLeave={e => { e.target.style.background='#fff'; e.target.style.borderColor='#d1d5db'; e.target.style.color='#374151'; }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table footer */}
          {!loading && filtered.length > 0 && (
            <div style={{ padding:'10px 16px', borderTop:'1px solid #f3f4f6',
                           fontSize:12, color:'#9ca3af' }}>
              Showing {filtered.length} of {total} users
            </div>
          )}
        </div>
      </div>

      {/* ── Slide-in drawer ── */}
      <Drawer user={selected} onClose={() => setSelected(null)}/>
    </div>
  );
};

export default AdminPanel;
