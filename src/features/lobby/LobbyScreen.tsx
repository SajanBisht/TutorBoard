import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Logo } from '../auth/LoginScreen';
import { SessionStatusBadge } from '../../components/StatusBadge';
import { canCreateSession, createSession, joinSessionByCode, useMySessions, SessionWithHost } from './sessionApi';

export function LobbyScreen() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { sessions, loading, error, reload } = useMySessions(user?.id);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const canCreate = canCreateSession(profile);

  const onCreate = async () => {
    if (!user || !profile) return;
    setCreating(true); setCreateError(null);
    const title = newTitle.trim() || 'Untitled Session';
    const { data, error } = await createSession(title, user.id, profile.role);
    setCreating(false);
    if (error || !data) { setCreateError(error || 'Failed to create session.'); return; }
    setNewTitle('');
    navigate(`/session/${data.id}`);
  };

  const onJoin = async () => {
    if (!user || !profile) return;
    setJoining(true); setJoinError(null);
    const { data, error } = await joinSessionByCode(joinCode, user.id, profile.role);
    setJoining(false);
    if (error || !data) { setJoinError(error || 'Failed to join session.'); return; }
    setJoinCode('');
    navigate(`/session/${data.id}`);
  };

  return (
    <div className="min-h-full bg-ink-50 dark:bg-ink-800">
      <header className="sticky top-0 z-10 border-b border-ink-200 bg-ink-50/80 backdrop-blur dark:border-ink-700 dark:bg-ink-800/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Logo />
            {profile && <span className="tb-badge bg-brand-500/10 capitalize text-brand-600 dark:text-brand-300">{profile.role}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/groups')} className="tb-btn-ghost">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              Groups
            </button>
            {profile?.role === 'admin' && <button onClick={() => navigate('/admin')} className="tb-btn-ghost">Admin</button>}
            <button onClick={() => navigate('/settings')} className="tb-btn-ghost">Settings</button>
            <ThemeToggle />
            <button onClick={signOut} className="tb-btn-secondary">Log out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold">Sessions</h1>
          <p className="text-sm text-ink-500 dark:text-ink-300">Create a whiteboard session and share the join code with your students.</p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {canCreate && (
            <div className="tb-card p-5">
              <h2 className="mb-3 font-display text-base font-semibold">Create a session</h2>
              <div className="flex gap-2">
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="tb-input" placeholder="Session title" onKeyDown={(e) => e.key === 'Enter' && onCreate()} />
                <button onClick={onCreate} disabled={creating} className="tb-btn-primary shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
              {createError && <p className="mt-2 text-xs text-danger">{createError}</p>}
            </div>
          )}

          <div className="tb-card p-5">
            <h2 className="mb-3 font-display text-base font-semibold">Join a session</h2>
            <div className="flex gap-2">
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={6} className="tb-input font-mono tracking-[0.2em]" placeholder="ABC123" onKeyDown={(e) => e.key === 'Enter' && onJoin()} />
              <button onClick={onJoin} disabled={joining || joinCode.length !== 6} className="tb-btn-secondary shrink-0">
                {joining ? 'Joining…' : 'Join'}
              </button>
            </div>
            {joinError && <p className="mt-2 text-xs text-danger">{joinError}</p>}
          </div>
        </div>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Your sessions</h2>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="tb-card h-16 animate-pulse bg-ink-100 dark:bg-ink-700/40" />)}</div>
          ) : error ? (
            <div className="tb-card flex items-center justify-between p-4">
              <p className="text-sm text-danger">Couldn't load sessions: {error}</p>
              <button onClick={reload} className="tb-btn-secondary">Retry</button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="tb-card p-8 text-center text-sm text-ink-500 dark:text-ink-300">
              {canCreate ? 'No sessions yet. Create one above to get started.' : 'No sessions yet. Join one with a code above.'}
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} onOpen={() => navigate(`/session/${s.id}`)} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Group chats</h2>
            <button onClick={() => navigate('/groups')} className="tb-btn-ghost text-xs">Browse all</button>
          </div>
          <button onClick={() => navigate('/groups')} className="tb-card mt-3 flex w-full items-center gap-3 p-4 text-left transition hover:border-brand-400">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-500">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold">Create or join a group</p>
              <p className="text-xs text-ink-500 dark:text-ink-300">Chat, share files, images, and videos with your groups.</p>
            </div>
          </button>
        </section>
      </main>
    </div>
  );
}

function SessionCard({ session, onOpen }: { session: SessionWithHost; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="tb-card flex w-full items-center justify-between gap-3 p-4 text-left transition hover:border-brand-400 hover:shadow-float">
      <div className="min-w-0">
        <p className="truncate font-semibold">{session.title}</p>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-300">Code <span className="font-mono font-semibold">{session.join_code}</span> · {session.participantCount || 0} participants</p>
      </div>
      <SessionStatusBadge status={session.status} />
    </button>
  );
}
