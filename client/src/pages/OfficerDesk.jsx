import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api, { API_BASE } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { STATUSES, CATEGORIES, timeAgo } from '../constants';

export default function OfficerDesk() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [issues, setIssues] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const csvTextareaRef = useRef(null);

  const deptScope = user.role === 'officer' ? user.department_id : null;

  async function loadAll() {
    setLoading(true);
    const [issuesRes, summaryRes] = await Promise.all([
      api.get('/issues', { params: deptScope ? { department_id: deptScope } : {} }),
      api.get('/analytics/summary')
    ]);
    setIssues(issuesRes.data.issues);
    setSummary(summaryRes.data);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  const filtered = useMemo(() => {
    let list = issues.filter(i => statusFilter === 'all' || i.status === statusFilter);
    const sevRank = { High: 3, Medium: 2, Low: 1 };
    if (sortBy === 'oldest') list = [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sortBy === 'severity') list = [...list].sort((a, b) => (sevRank[b.severity] || 2) - (sevRank[a.severity] || 2));
    else list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return list;
  }, [issues, statusFilter, sortBy]);

  const statusCounts = useMemo(() => {
    const counts = { Reported: 0, Acknowledged: 0, 'In Progress': 0, Resolved: 0 };
    (summary?.statusCounts || []).forEach(s => { counts[s.status] = s.count; });
    return counts;
  }, [summary]);

  const trendData = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const map = {};
    (summary?.trend || []).forEach(t => { map[t.day] = t.count; });
    return days.map(d => ({ day: d.slice(5), count: map[d] || 0 }));
  }, [summary]);

  const categoryData = useMemo(() => {
    return CATEGORIES.map(c => {
      const found = (summary?.categoryCounts || []).find(x => x.category === c.id);
      return { label: c.label, count: found ? found.count : 0 };
    });
  }, [summary]);

  async function updateStatus(issueId, status, remarks) {
    try {
      await api.patch(`/issues/${issueId}/status`, { status, remarks });
      showToast(`Ticket #${issueId.replace('issue-', '').slice(0, 8)} marked ${status} — citizen will see this on Track a Report.`);
      loadAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Could not update status.');
    }
  }

  function exportCsv() {
    const rows = [['Ticket ID', 'Category', 'Severity', 'Status', 'Department', 'Description', 'Lat', 'Lng', 'Created At', 'Overdue']];
    filtered.forEach(i => rows.push([
      i.id.replace('issue-', ''), i.category_label, i.severity, i.status, i.department_name,
      (i.description || '').replace(/"/g, '""').replace(/\n/g, ' '), i.lat, i.lng, i.created_at, i.overdue ? 'Yes' : 'No'
    ]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    setCsvText(csv);
    setCsvOpen(true);
    try {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'civicfix-tickets.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* modal fallback still shown */ }
  }

  if (loading) return <p className="text-inksoft text-sm">Loading officer desk…</p>;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-1">Officer desk</h2>
      <p className="text-sm text-inksoft mb-4">
        Signed in as <strong>{user.name}</strong>{deptScope ? ' — scoped to your department.' : ' — viewing all departments (admin).'}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
        {Object.entries(statusCounts).map(([s, n]) => (
          <div key={s} className="card">
            <div className="font-display text-xl font-semibold">{n}</div>
            <div className="text-[11px] text-inksoft">{s}</div>
          </div>
        ))}
        <div className="card">
          <div className="font-display text-xl font-semibold">{summary?.avgResolutionHours != null ? (summary.avgResolutionHours < 24 ? Math.round(summary.avgResolutionHours) + 'h' : (summary.avgResolutionHours / 24).toFixed(1) + 'd') : '—'}</div>
          <div className="text-[11px] text-inksoft">Avg. resolve time</div>
        </div>
      </div>

      <div className="card mb-5">
        <div className="text-xs font-semibold text-inksoft mb-2.5">Reports over the last 14 days</div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={trendData}>
            <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={2} />
            <YAxis hide />
            <Tooltip />
            <Bar dataKey="count" fill="#F5B700" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card mb-5">
        <div className="text-xs font-semibold text-inksoft mb-2.5">Issues by category</div>
        {categoryData.map(c => {
          const max = Math.max(1, ...categoryData.map(x => x.count));
          return (
            <div key={c.label} className="flex items-center gap-2 text-xs mb-1.5">
              <div className="w-32 sm:w-40 flex-none text-inksoft truncate">{c.label}</div>
              <div className="flex-1 bg-line dark:bg-asphalt rounded h-2 overflow-hidden">
                <div className="h-full bg-signal-blue rounded" style={{ width: `${(c.count / max) * 100}%` }} />
              </div>
              <div className="w-5 flex-none text-right font-mono text-inksoft">{c.count}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select className="field-input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="field-input w-auto" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="severity">Highest severity first</option>
        </select>
        <button className="btn btn-outline" onClick={loadAll}>Refresh</button>
        <button className="btn btn-outline ml-auto" onClick={exportCsv}>Export CSV</button>
      </div>

      {filtered.length === 0 && <p className="text-inksoft text-sm text-center py-8">No tickets match this filter.</p>}

      <div className="space-y-2.5">
        {filtered.map(iss => <TicketCard key={iss.id} issue={iss} onUpdate={updateStatus} />)}
      </div>

      {csvOpen && (
        <div className="fixed inset-0 bg-black/45 z-[1500] flex items-center justify-center p-5">
          <div className="bg-panel dark:bg-asphalt-2 rounded-lg p-4.5 max-w-lg w-full max-h-[80vh] flex flex-col gap-2.5">
            <h3 className="font-display font-semibold">Export — CSV</h3>
            <p className="text-xs text-inksoft m-0">Download didn't start automatically? Select all and copy the text below.</p>
            <textarea ref={csvTextareaRef} readOnly value={csvText} className="field-input flex-1 min-h-[220px] font-mono text-[11.5px]" onClick={e => e.target.select()} />
            <div className="flex gap-2 justify-end">
              <button className="btn btn-outline" onClick={() => csvTextareaRef.current?.select()}>Select all</button>
              <button className="btn btn-dark" onClick={() => setCsvOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketCard({ issue, onUpdate }) {
  const [status, setStatus] = useState(issue.status);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onUpdate(issue.id, status, remarks.trim());
    setRemarks('');
    setSaving(false);
  }

  return (
    <div className="card">
      <div className="flex justify-between items-start gap-2.5">
        <div>
          <div className="font-mono text-[11.5px] text-inksoft">#{issue.id.replace('issue-', '').slice(0, 8)}</div>
          <div className="font-semibold text-[15px] mt-0.5">
            {issue.category_label}
            <span className={`badge-sev badge-sev-${issue.severity}`}>{issue.severity}</span>
            {issue.overdue && <span className="overdue-flag">Overdue</span>}
          </div>
          <div className="text-xs text-inksoft mt-0.5">{issue.department_name}</div>
        </div>
        <span className={`badge badge-${issue.status.replace(' ', '')}`}>{issue.status}</span>
      </div>
      {issue.description && <p className="text-sm mt-2.5">{issue.description}</p>}
      {issue.photo_url && <img src={`${API_BASE}${issue.photo_url}`} className="max-w-full max-h-40 rounded-md mt-2" />}
      <p className="text-xs text-inksoft mt-2">Reported {timeAgo(issue.created_at)} · {issue.lat.toFixed(4)}, {issue.lng.toFixed(4)}</p>

      <div className="border-t border-line dark:border-asphalt mt-3 pt-3">
        <div className="flex gap-2 flex-wrap items-center">
          <select className="field-input w-auto flex-1 min-w-[140px]" value={status} onChange={e => setStatus(e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-dark" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Update'}</button>
        </div>
        <textarea
          className="field-input min-h-[50px] mt-2"
          placeholder="Remarks (optional) — e.g. 'crew dispatched, ETA 2 days'"
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
        />
        <div className="mt-2 space-y-1">
          {issue.logs.slice().reverse().map(l => (
            <div key={l.id} className="text-xs text-inksoft border-t border-dashed border-line dark:border-asphalt pt-1.5 first:border-t-0 first:pt-0">
              <strong>{l.status}</strong> — {l.remarks} <span className="opacity-70">({timeAgo(l.at)})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
