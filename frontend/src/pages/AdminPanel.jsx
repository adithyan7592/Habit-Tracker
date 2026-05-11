import React, { useEffect, useState, useCallback } from 'react';
import { API_BASE, apiFetch, authHeaders } from '../api';

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

const Badge = ({ days, hasReport }) => {
  const cfg = hasReport
    ? { label: 'Report ready',   bg: '#d1fae5', color: '#065f46', dot: '#10b981' }
    : days === 7 ? { label: 'Awaiting report', bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' }
    : days === 0 ? { label: 'Not started',     bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' }
    :              { label: `Day ${days}/7`,   bg: '#eff6ff', color: '#1e40af', dot: '#3b82f6' };
  return (
    <span className="status-badge" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="status-badge-dot" style={{ background: cfg.dot }}/>
      {cfg.label}
    </span>
  );
};

const ProgressBar = ({ completed }) => (
  <div className="admin-progress">
    {Array.from({ length: 7 }, (_, i) => (
      <div key={i} className="admin-progress-dot"
        style={{ background: i < completed ? '#16a34a' : '#e5e7eb' }}/>
    ))}
    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>{completed}/7</span>
  </div>
);

const DetailRow = ({ label, value }) => value ? (
  <div className="detail-row">
    <span className="detail-label">{label}</span>
    <span className="detail-value">{value}</span>
  </div>
) : null;

const SectionTitle = ({ icon, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
    <span style={{ fontSize: 16 }}>{icon}</span>
    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#374151',
                  textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</h3>
  </div>
);

const EmptyState = ({ icon, text }) => (
  <div className="empty-state">
    <div className="empty-state-icon">{icon}</div>
    {text}
  </div>
);

const Drawer = ({ user, onClose }) => {
  if (!user) return null;
  const bd = user.basicDetails || {};
  return (
    <>
      <div className="drawer-scrim" onClick={onClose}/>
      <div className="drawer-panel">
        <div className="drawer-header">
          <div className="drawer-header-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="drawer-customer-label">Customer Profile</div>
              <div className="drawer-phone">{user.phone}</div>
            </div>
            <button className="btn-close" onClick={onClose}>×</button>
          </div>
          <div className="drawer-badges">
            <Badge days={user.daysCompleted} hasReport={!!user.finalReport}/>
            {user.startedAt && (
              <span className="drawer-started">
                📅 Started {new Date(user.startedAt).toLocaleDateString('en-IN',
                  { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        <div className="drawer-body">
          {/* Basic details */}
          {Object.values(bd).some(Boolean) ? (
            <div className="drawer-section">
              <SectionTitle icon="👤" label="Basic Details"/>
              <div className="detail-box">
                <DetailRow label="Name"       value={bd.name}/>
                <DetailRow label="Age"        value={bd.age ? `${bd.age} years` : null}/>
                <DetailRow label="Gender"     value={bd.gender}/>
                <DetailRow label="Height"     value={bd.heightCm ? `${bd.heightCm} cm` : null}/>
                <DetailRow label="Weight"     value={bd.weightKg ? `${bd.weightKg} kg` : null}/>
                <DetailRow label="Goal"       value={bd.healthGoal}/>
                <DetailRow label="Med. Notes" value={bd.medicalNotes}/>
              </div>
            </div>
          ) : <EmptyState icon="📋" text="No basic details submitted yet"/>}

          {/* Food entries */}
          <div className="drawer-section">
            <SectionTitle icon="🍱" label="Food Habit Diary"/>
            {user.entries?.length > 0 ? user.entries.map(e => (
              <div key={e._id} className="drawer-entry-card">
                <div className="drawer-entry-header">
                  <span className="drawer-entry-day">Day {e.dayNumber}</span>
                  {e.dateSubmitted && (
                    <span className="drawer-entry-date">
                      {new Date(e.dateSubmitted).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
                <p className="drawer-entry-text">{e.foodDetails}</p>
              </div>
            )) : <EmptyState icon="🍽️" text="No food entries submitted yet"/>}
          </div>

          {/* Report */}
          {user.finalReport && (
            <div className="drawer-section">
              <SectionTitle icon="📊" label="AI Food Habit Report"/>
              <div className="drawer-report-box"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(user.finalReport) }}/>
              {user.reportGeneratedAt && (
                <p className="drawer-report-date">
                  Generated on {new Date(user.reportGeneratedAt).toLocaleString('en-IN',
                    { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const AdminPanel = () => {
  const [usersData, setUsersData] = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('all');
  const [message,   setMessage]   = useState('');
  const [loading,   setLoading]   = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/admin/all-data');
      setUsersData(data.filter(u => u.role !== 'admin'));
    } catch (err) { setMessage(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const downloadCSV = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/download-csv`, { headers: authHeaders() });
      if (!res.ok) throw new Error('CSV download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'food_habits_report.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setMessage(err.message); }
  };

  const logout = () => { localStorage.clear(); window.location.href = '/login'; };

  const total    = usersData.length;
  const active   = usersData.filter(u => u.daysCompleted > 0 && u.daysCompleted < 7).length;
  const complete = usersData.filter(u => u.daysCompleted === 7).length;
  const reported = usersData.filter(u => u.finalReport).length;

  const filtered = usersData.filter(u => {
    const matchSearch = !search || u.phone.includes(search) ||
      (u.basicDetails?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' ? true
      : filter === 'active'   ? (u.daysCompleted > 0 && u.daysCompleted < 7)
      : filter === 'complete' ? u.daysCompleted === 7
      : filter === 'reported' ? !!u.finalReport : true;
    return matchSearch && matchFilter;
  });

  return (
    <div className="admin-page">
      {/* Nav */}
      <div className="admin-nav">
        <div className="admin-nav-left">
          <span className="admin-nav-logo">🥗</span>
          <span className="admin-nav-title">Food Habit Tracker</span>
          <span className="admin-badge">Admin</span>
        </div>
        <div className="admin-nav-right">
          <button className="btn-nav" onClick={loadData}>↻</button>
          <button className="btn-nav primary" onClick={downloadCSV}>⬇ CSV</button>
          <button className="btn-nav danger" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="admin-container">
        <div style={{ marginBottom: 20 }}>
          <h1 className="admin-page-title">Admin Control Panel</h1>
          <p className="admin-page-sub">Monitor all customers' 7-day food habit submissions</p>
        </div>

        {message && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <span className="alert-icon">⚠️</span>{message}
          </div>
        )}

        {/* Stat cards */}
        <div className="stat-cards">
          {[
            { label: 'Total users',       value: total,    color: '#111827' },
            { label: 'In progress',       value: active,   color: '#2563eb' },
            { label: '7 days done',       value: complete, color: '#d97706' },
            { label: 'Reports generated', value: reported, color: '#15803d' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <input className="admin-search" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by phone or name…"/>
        <div className="filter-row">
          {[
            { key: 'all',      label: 'All' },
            { key: 'active',   label: 'In Progress' },
            { key: 'complete', label: 'Completed' },
            { key: 'reported', label: 'Report Ready' },
          ].map(f => (
            <button key={f.key} className={`filter-btn${filter === f.key ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="table-wrap">
          {loading ? (
            <div className="table-empty">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="table-empty">No users match your search.</div>
          ) : (
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    {['Phone', 'Name', 'Progress', 'Status', 'Action'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(user => {
                    const bd = user.basicDetails || {};
                    return (
                      <tr key={user.phone}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {user.phone}
                        </td>
                        <td style={{ fontWeight: bd.name ? 500 : 400, whiteSpace: 'nowrap' }}>
                          {bd.name || <span style={{ color: '#9ca3af' }}>—</span>}
                        </td>
                        <td><ProgressBar completed={user.daysCompleted}/></td>
                        <td><Badge days={user.daysCompleted} hasReport={!!user.finalReport}/></td>
                        <td>
                          <button className="btn-view" onClick={() => setSelected(user)}>View</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="table-footer">Showing {filtered.length} of {total} users</div>
          )}
        </div>
      </div>

      <Drawer user={selected} onClose={() => setSelected(null)}/>
    </div>
  );
};

export default AdminPanel;
