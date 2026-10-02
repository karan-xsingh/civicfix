import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const user = await login(email, password);
      showToast(`Welcome back, ${user.name.split(' ')[0]}.`);
      nav(user.role === 'citizen' ? '/report' : '/officer');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <h2 className="font-display text-lg font-semibold mb-1">Sign in</h2>
      <p className="text-sm text-inksoft mb-5">Officers, admins, and returning citizens sign in here.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5">Email</label>
          <input className="field-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5">Password</label>
          <input className="field-input" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-sm text-signal-orange">{error}</p>}
        <button className="btn btn-yellow w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="text-xs text-inksoft mt-4">
        New citizen? <Link to="/register" className="underline">Create an account</Link>
      </p>
      <div className="mt-6 card text-xs text-inksoft">
        <strong className="block text-ink dark:text-concrete mb-1">Demo accounts (password: password123)</strong>
        admin@civicfix.dev · roads@civicfix.dev · sanitation@civicfix.dev · electrical@civicfix.dev · water@civicfix.dev
      </div>
    </div>
  );
}
