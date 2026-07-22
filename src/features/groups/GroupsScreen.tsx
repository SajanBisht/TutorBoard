import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Logo } from '../auth/LoginScreen';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Avatar } from '../../components/Avatar';
import { createGroup, searchGroups, searchUsers, joinGroup, fetchMyGroups, getGroupJoinUrl } from './groupApi';
import { GroupWithMeta, Profile } from '../../lib/types';

export function GroupsScreen() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'groups' | 'users'>('groups');
  const [groupResults, setGroupResults] = useState<GroupWithMeta[]>([]);
  const [userResults, setUserResults] = useState<Profile[]>([]);
  const [myGroups, setMyGroups] = useState<GroupWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const loadMyGroups = useCallback(async () => { setMyGroups(await fetchMyGroups()); }, []);
  useEffect(() => { loadMyGroups(); }, [loadMyGroups]);

  useEffect(() => {
    if (!searchQuery.trim()) { setGroupResults([]); setUserResults([]); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      if (searchMode === 'groups') setGroupResults(await searchGroups(searchQuery));
      else setUserResults(await searchUsers(searchQuery));
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchMode]);

  const onJoinGroup = async (slug: string) => {
    setBusy(true); setError(null);
    const { group, error } = await joinGroup(slug);
    setBusy(false);
    if (error) { setError(error); return; }
    await loadMyGroups(); setSearchQuery('');
    if (group) navigate(`/groups/${group.id}`);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true); setError(null);
    const { group, error } = await createGroup(newName, newDesc);
    setBusy(false);
    if (error) { setError(error); return; }
    setShowCreate(false); setNewName(''); setNewDesc('');
    await loadMyGroups();
    if (group) navigate(`/groups/${group.id}`);
  };

  const copyLink = (slug: string) => {
    navigator.clipboard?.writeText(getGroupJoinUrl(slug)).then(() => { setCopied(slug); setTimeout(() => setCopied(null), 2000); });
  };

  return (
    <div className="min-h-full bg-ink-50 dark:bg-ink-800">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/80 backdrop-blur-md dark:border-ink-700 dark:bg-ink-700/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/lobby')} className="tb-btn-ghost">Sessions</button>
            {profile?.role === 'admin' && <button onClick={() => navigate('/admin')} className="tb-btn-ghost">Admin</button>}
            <button onClick={() => navigate('/settings')} className="tb-btn-ghost" aria-label="Settings"><Avatar name={profile?.name || 'User'} size={28} /></button>
            <ThemeToggle />
            <button onClick={signOut} className="tb-btn-secondary text-xs">Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center justify-between">
          <div><h1 className="font-display text-2xl font-bold">Groups</h1><p className="mt-1 text-sm text-ink-500 dark:text-ink-300">Search for groups or users, or create your own group.</p></div>
          <button onClick={() => setShowCreate(true)} className="tb-btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New group
          </button>
        </div>
        <div className="mt-5 tb-card p-4">
          <div className="flex gap-2">
            <button onClick={() => setSearchMode('groups')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${searchMode === 'groups' ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'}`}>Search groups</button>
            <button onClick={() => setSearchMode('users')} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${searchMode === 'users' ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200'}`}>Search users</button>
          </div>
          <div className="relative mt-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input className="tb-input pl-9" placeholder={searchMode === 'groups' ? 'Search by group name or URL…' : 'Search by @username…'} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          {loading && <p className="mt-3 text-sm text-ink-400">Searching…</p>}
          {searchMode === 'groups' && groupResults.length > 0 && (
            <ul className="mt-3 space-y-2">
              {groupResults.map((g) => (
                <li key={g.id} className="flex items-center justify-between rounded-lg border border-ink-200 px-3 py-2 dark:border-ink-700">
                  <div><p className="text-sm font-semibold">{g.name}</p><p className="text-xs text-ink-500">{g.slug}</p></div>
                  <button onClick={() => onJoinGroup(g.slug)} disabled={busy} className="tb-btn-secondary text-xs">Join</button>
                </li>
              ))}
            </ul>
          )}
          {searchMode === 'users' && userResults.length > 0 && (
            <ul className="mt-3 space-y-2">
              {userResults.map((u) => (
                <li key={u.id} className="flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2 dark:border-ink-700">
                  <Avatar name={u.name} size={32} />
                  <div className="flex-1"><p className="text-sm font-semibold">{u.name}</p><p className="text-xs text-ink-500">@{u.username}</p></div>
                  <span className="tb-badge bg-brand-500/10 text-brand-600 capitalize">{u.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <div className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
        <h2 className="mt-8 font-display text-lg font-semibold">Your groups</h2>
        {myGroups.length === 0 ? (
          <div className="mt-4 tb-card p-8 text-center text-sm text-ink-400">No groups yet. Create one or join an existing group.</div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {myGroups.map((g) => (
              <div key={g.id} className="tb-card p-4 transition hover:shadow-float">
                <button onClick={() => navigate(`/groups/${g.id}`)} className="block w-full text-left"><p className="font-semibold">{g.name}</p>{g.description && <p className="mt-1 text-sm text-ink-500 line-clamp-2">{g.description}</p>}</button>
                <div className="mt-2 flex items-center gap-2">
                  <span className="tb-badge bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-200">/{g.slug}</span>
                  <button onClick={() => copyLink(g.slug)} className="text-xs text-brand-500 hover:text-brand-600">{copied === g.slug ? 'Copied!' : 'Copy link'}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md animate-popIn rounded-2xl border border-ink-200 bg-white p-5 shadow-float dark:border-ink-700 dark:bg-ink-700">
            <h3 className="font-display text-base font-semibold">Create a new group</h3>
            <form onSubmit={onCreate} className="mt-4 space-y-3">
              <input className="tb-input" placeholder="Group name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <textarea className="tb-input" placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="tb-btn-secondary">Cancel</button>
                <button type="submit" disabled={busy} className="tb-btn-primary">{busy ? 'Creating…' : 'Create group'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
