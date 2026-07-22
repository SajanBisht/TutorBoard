import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Logo } from '../auth/LoginScreen';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Avatar } from '../../components/Avatar';
import { SessionStatusBadge } from '../../components/StatusBadge';
import { Profile, SessionRow } from '../../lib/types';

export function AdminScreen() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<'sessions' | 'users'>('sessions');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && profile.role !== 'admin') { navigate('/lobby'); return; }
    (async () => {
      const { data: s } = await supabase.from('sessions').select().order('created_at', { ascending: false }).limit(100);
      setSessions((s || []) as SessionRow[]);
      const { data: u } = await supabase.from('profiles').select('id, name, username, email, role, created_at').order('created_at', { ascending: false }).limit(100);
      setUsers((u || []) as Profile[]);
      setLoading(false);
    })();
  }, [profile, navigate]);

  if (profile?.role !== 'admin') return null;

  return (
    <div className="min-h-full bg-ink-50 dark:bg-ink-800">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/80 backdrop-blur-md dark:border-ink-700 dark:bg-ink-700/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/lobby')} className="tb-btn-ghost">Sessions</button>
            <button onClick={() => navigate('/groups')} className="tb-btn-ghost">Groups</button>
            <button onClick={() => navigate('/settings')} className="tb-btn-ghost"><Avatar name={profile?.name || 'User'} size={28} /></button>
            <ThemeToggle />
            <button onClick={signOut} className="tb-btn-secondary text-xs">Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setTab('sessions')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'sessions' ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'}`}>Sessions</button>
          <button onClick={() => setTab('users')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'users' ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'}`}>Users</button>
        </div>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-ink-500"><div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /> Loading…</div>
        ) : tab === 'sessions' ? (
          <div className="mt-4 tb-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-100 dark:bg-ink-700/60"><tr><th className="px-4 py-2 text-left font-semibold">Title</th><th className="px-4 py-2 text-left font-semibold">Code</th><th className="px-4 py-2 text-left font-semibold">Status</th></tr></thead>
              <tbody>{sessions.map((s) => (<tr key={s.id} className="border-t border-ink-200 dark:border-ink-700"><td className="px-4 py-2">{s.title}</td><td className="px-4 py-2 font-mono">{s.join_code}</td><td className="px-4 py-2"><SessionStatusBadge status={s.status} /></td></tr>))}</tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 tb-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-100 dark:bg-ink-700/60"><tr><th className="px-4 py-2 text-left font-semibold">Name</th><th className="px-4 py-2 text-left font-semibold">Username</th><th className="px-4 py-2 text-left font-semibold">Role</th></tr></thead>
              <tbody>{users.map((u) => (<tr key={u.id} className="border-t border-ink-200 dark:border-ink-700"><td className="px-4 py-2 flex items-center gap-2"><Avatar name={u.name} size={24} /> {u.name}</td><td className="px-4 py-2">@{u.username}</td><td className="px-4 py-2 capitalize">{u.role}</td></tr>))}</tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
