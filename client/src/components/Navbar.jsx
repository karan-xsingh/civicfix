import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem('civicfix_theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('civicfix_theme', dark ? 'dark' : 'light');
  }, [dark]);

  const linkClass = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium rounded-t-md ${isActive ? 'bg-concrete dark:bg-asphalt text-ink dark:text-concrete' : 'text-[#C9C6BC] hover:text-white'}`;

  return (
    <header className="bg-asphalt border-b-[6px] border-signal-yellow px-5 pt-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-baseline gap-2.5 mb-3.5">
          <span className="w-3.5 h-3.5 bg-signal-yellow rounded-sm inline-block" />
          <h1 className="font-display font-bold text-xl text-concrete tracking-wide">CivicFix</h1>
          <span className="text-xs text-[#B9B6AC] font-mono">municipal issue tracker</span>
          <button
            onClick={() => setDark(d => !d)}
            className="ml-auto bg-asphalt-2 border border-[#45484D] text-concrete rounded-md px-2.5 py-1.5 text-xs"
          >
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
        <nav className="flex gap-0.5 overflow-x-auto">
          <NavLink to="/report" className={linkClass}>Report an Issue</NavLink>
          <NavLink to="/map" className={linkClass}>Public Map</NavLink>
          <NavLink to="/track" className={linkClass}>Track a Report</NavLink>
          {(user?.role === 'officer' || user?.role === 'admin') && (
            <NavLink to="/officer" className={linkClass}>Officer Desk</NavLink>
          )}
          {!user && <NavLink to="/login" className={linkClass}>Officer / Login</NavLink>}
          {user && (
            <button onClick={logout} className="ml-auto px-3 py-2 text-sm text-[#C9C6BC] hover:text-white">
              Sign out ({user.name.split(' ')[0]})
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
