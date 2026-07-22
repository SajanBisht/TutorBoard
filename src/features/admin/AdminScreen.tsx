import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Profile, SessionStatus } from '../../lib/types';
import { fetchAllSessions, fetchAllUsers, setSessionStatus, deleteSession, SessionWithHost } from '../lobby/sessionApi';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Logo } from '../auth/LoginScreen';
import { SessionStatusBadge } from '../../components/StatusBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function AdminScreen() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionWithHost[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'sessions' | 'users'>('sessions');
  const [endTarget, setEndTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [{ data: sess, error: sErr }, { data: usrs, error: uErr }] = await Promise.all([fetchAllSessions(), fetchAllUsers()]);
    if (sErr || uErr) { setError(sErr || uErr || 'Failed to load admin data.'); setLoading(false); return; }
    setSessions(sess || []); setUsers(usrs || []); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (profile?.role !== 'admin') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-ink-50 dark:bg-ink-800">
        <p className="text-sm text-danger">Admins only.</p>
        <button onClick={() => navigate('/lobby')} className="tb-btn-secondary">Back to lobby</button>
      </div>
    );
  }

  const onEnd = async () => { if (!endTarget) return; await setSessionStatus(endTarget, 'ended'); setEndTarget(null); load(); };
  const onDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await deleteSession(deleteTarget);
    setDeleteTarget(null);
    if (error) setError(error);
    load();
  };
  const onSetStatus = async (id: string, status: SessionStatus) => { await setSessionStatus(id, status); load(); };

  return (
    <div className="min-h-full bg-ink-50 dark:bg-ink-800">
      <header className="sticky top-0 z-10 border-b border-ink-200 bg-ink-50/80 backdrop-blur dark:border-ink-700 dark:bg-ink-800/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2"><Logo /><span className="font-display text-lg font-bold tracking-tight">Admin</span><span className="tb-badge bg-brand-500/10 text-brand-600 dark:text-brand-300">admin</span></div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/lobby')} className="tb-btn-ghost">Lobby</button>
            <button onClick={() => navigate('/groups')} className="tb-btn-ghost">Groups</button>
            <button onClick={() => navigate('/settings')} className="tb-btn-ghost">Settings</button>
            <ThemeToggle />
            <button onClick={signOut} className="tb-btn-secondary">Log out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold">Admin dashboard</h1>
          <p className="text-sm text-ink-500 dark:text-ink-300">Manage all sessions and users across TutorBoard.</p>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg border border-ink-200 bg-white p-1 dark:border-ink-700 dark:bg-ink-700/60">
          {(['sessions', 'users'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition capitalize ${tab === t ? 'bg-brand-500 text-white' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-600'}`}>
              {t} {t === 'sessions' ? `(${sessions.length})` : `(${users.length})`}
            </button>
          ))}
        </div>

        {error && (
          <div className="tb-card mb-4 flex items-center justify-between p-4">
            <p className="text-sm text-danger">{error}</p>
            <button onClick={load} className="tb-btn-secondary">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="tb-card h-16 animate-pulse bg-ink-100 dark:bg-ink-700/40" />)}</div>
        ) : tab === 'sessions' ? (
          <div className="space-y-2">
            {sessions.length === 0 && <div className="tb-card p-8 text-center text-sm text-ink-500">No sessions.</div>}
            {sessions.map((s) => (
              <div key={s.id} className="tb-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button onClick={() => navigate(`/session/${s.id}`)} className="text-left"><p className="font-semibold hover:text-brand-500">{s.title}</p></button>
                    <p className="mt-1 text-xs text-ink-500 dark:text-ink-300">Host: {s.hostName || '—'} · Code <span className="font-mono font-semibold">{s.join_code}</span> · {s.participantCount || 0} participants</p>
                  </div>
                  <SessionStatusBadge status={s.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => navigate(`/session/${s.id}`)} className="tb-btn-secondary text-xs">View</button>
                  {s.status !== 'live' && <button onClick={() => onSetStatus(s.id, 'live')} className="tb-btn-ghost text-xs text-success">Mark live</button>}
                  {s.status !== 'ended' && <button onClick={() => setEndTarget(s.id)} className="tb-btn-ghost text-xs text-warning">End session</button>}
                  <button onClick={() => setDeleteTarget(s.id)} className="tb-btn-ghost text-xs text-danger">Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {users.length === 0 && <div className="tb-card p-8 text-center text-sm text-ink-500">No users.</div>}
            {users.map((u) => (
              <div key={u.id} className="tb-card flex items-center gap-3 p-4">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white">{(u.name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{u.name}</p><p className="truncate text-xs text-ink-500 dark:text-ink-300">@{u.username} · {u.email}</p></div>
                <span className="tb-badge bg-brand-500/10 text-brand-600 dark:text-brand-300 capitalize">{u.role}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      <ConfirmDialog open={!!endTarget} title="End this session?" description="The board becomes read-only for everyone. This cannot be undone." confirmLabel="End session" onConfirm={onEnd} onCancel={() => setEndTarget(null)} />
      <ConfirmDialog open={!!deleteTarget} danger title="Delete this session permanently?" description="All board events and participant records will be removed. This cannot be undone." confirmLabel="Delete" onConfirm={onDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
