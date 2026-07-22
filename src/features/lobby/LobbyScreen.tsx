import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useMySessions, createSession, joinSessionByCode, canCreateSession } from './sessionApi';
import { Logo } from '../auth/LoginScreen';
import { ThemeToggle } from '../../components/ThemeToggle';
import { SessionStatusBadge } from '../../components/StatusBadge';
import { Avatar } from '../../components/Avatar';

export function LobbyScreen() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { sessions, loading, refresh } = useMySessions();
  const [joinCode, setJoinCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canCreate = canCreateSession(profile);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setBusy(true); setError(null);
    const { session, error } = await createSession(newTitle.trim());
    setBusy(false);
    if (error) { setError(error); return; }
    setNewTitle('');
    navigate(`/session/${session!.id}`);
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy(true); setError(null);
    const { session, error } = await joinSessionByCode(joinCode.trim());
    setBusy(false);
    if (error) { setError(error); return; }
    setJoinCode('');
    refresh();
    navigate(`/session/${session!.id}`);
  };

  return (
    <div className="min-h-full bg-ink-50 dark:bg-ink-800">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/80 backdrop-blur-md dark:border-ink-700 dark:bg-ink-700/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/groups')} className="tb-btn-ghost">Groups</button>
            {profile?.role === 'admin' && <button onClick={() => navigate('/admin')} className="tb-btn-ghost">Admin</button>}
            <button onClick={() => navigate('/settings')} className="tb-btn-ghost" aria-label="Settings"><Avatar name={profile?.name || 'User'} size={28} /></button>
            <ThemeToggle />
            <button onClick={signOut} className="tb-btn-secondary text-xs">Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="font-display text-2xl font-bold">Sessions</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">Create a new session or join one with a code.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="tb-card p-5">
            <h2 className="font-display text-base font-semibold">Create a session</h2>
            {canCreate ? (
              <form onSubmit={onCreate} className="mt-3 space-y-3">
                <input className="tb-input" placeholder="Session title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                <button type="submit" disabled={busy} className="tb-btn-primary w-full">Create & start</button>
              </form>
            ) : <p className="mt-2 text-sm text-ink-400">Only teachers and admins can create sessions.</p>}
          </div>
          <div className="tb-card p-5">
            <h2 className="font-display text-base font-semibold">Join a session</h2>
            <form onSubmit={onJoin} className="mt-3 space-y-3">
              <input className="tb-input font-mono" placeholder="Enter join code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={8} />
              <button type="submit" disabled={busy} className="tb-btn-secondary w-full">Join</button>
            </form>
          </div>
        </div>
        {error && <div className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
        <h2 className="mt-8 font-display text-lg font-semibold">Your sessions</h2>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-ink-500"><div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /> Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="mt-4 tb-card p-8 text-center text-sm text-ink-400">No sessions yet. Create or join one above.</div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {sessions.map((s) => (
              <button key={s.id} onClick={() => navigate(`/session/${s.id}`)} className="tb-card p-4 text-left transition hover:shadow-float">
                <div className="flex items-start justify-between">
                  <div><p className="font-semibold">{s.title}</p><p className="mt-0.5 text-xs text-ink-500">Code: <span className="font-mono font-semibold">{s.join_code}</span></p></div>
                  <SessionStatusBadge status={s.status} />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
