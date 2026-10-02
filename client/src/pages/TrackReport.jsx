import React, { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext.jsx';
import { timeAgo } from '../constants';

export default function TrackReport() {
  const { showToast } = useToast();
  const [input, setInput] = useState('');
  const [issue, setIssue] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const pollRef = useRef(null);
  const knownStatus = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  async function track() {
    clearInterval(pollRef.current);
    setNotFound(false); setIssue(null);
    const raw = input.trim();
    if (!raw) return;
    const id = raw.startsWith('issue-') ? raw : 'issue-' + raw;
    try {
      const res = await api.get(`/issues/${id}`);
      setIssue(res.data.issue);
      knownStatus.current = res.data.issue.status;
      pollRef.current = setInterval(async () => {
        try {
          const r2 = await api.get(`/issues/${id}`);
          if (r2.data.issue.status !== knownStatus.current) {
            showToast(`Ticket #${id.replace('issue-', '').slice(0, 8)} updated: now ${r2.data.issue.status}.`);
            knownStatus.current = r2.data.issue.status;
          }
          setIssue(r2.data.issue);
        } catch { /* ignore transient poll errors */ }
      }, 15000);
    } catch {
      setNotFound(true);
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-1">Track a report</h2>
      <p className="text-sm text-inksoft mb-5">Enter your ticket ID to see its current status and full history.</p>
      <div className="flex gap-2 mb-5">
        <input className="field-input flex-1" placeholder="e.g. 836fa02e-7bfd-483b" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && track()} />
        <button className="btn btn-yellow" onClick={track}>Track</button>
      </div>
      {notFound && <p className="text-signal-orange text-sm">No ticket found with that ID. Double-check it and try again.</p>}
      {issue && (
        <div>
          <div className="card mb-4">
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
            {issue.photo_url && <img src={`${api.defaults.baseURL.replace('/api','')}${issue.photo_url}`} className="max-w-full max-h-40 rounded-md mt-2" />}
            <p className="text-xs text-inksoft mt-2.5">Reported {timeAgo(issue.created_at)}</p>
          </div>
          <div className="space-y-4">
            {issue.logs.slice().reverse().map((l, idx) => (
              <div key={l.id} className="flex gap-3 relative">
                <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-none ${l.status === 'Resolved' ? 'bg-signal-green' : 'bg-signal-blue'}`} />
                <div>
                  <strong className="text-sm">{l.status}</strong>
                  <div className="text-sm text-inksoft">{l.remarks}</div>
                  <div className="text-[11.5px] text-inksoft font-mono">{new Date(l.at + 'Z').toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
