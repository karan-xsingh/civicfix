import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await register(form.name, form.email, form.password);
      showToast('Account created — welcome to CivicFix.');
      nav('/report');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <h2 className="font-display text-lg font-semibold mb-1">Create a citizen account</h2>
      <p className="text-sm text-inksoft mb-5">You can also report issues anonymously — an account just lets you keep a history.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5">Name</label>
          <input className="field-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5">Email</label>
          <input className="field-input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5">Password</label>
          <input className="field-input" type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        </div>
        {error && <p className="text-sm text-signal-orange">{error}</p>}
        <button className="btn btn-yellow w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="text-xs text-inksoft mt-4">
        Already have an account? <Link to="/login" className="underline">Sign in</Link>
      </p>
    </div>
  );
}
