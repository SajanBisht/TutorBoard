import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Logo } from '../auth/LoginScreen';
import { Avatar } from '../../components/Avatar';
import { GroupWithMeta, Profile } from '../../lib/types';
import { fetchMyGroups, searchGroups, searchUsers, createGroup, joinGroup, getGroupJoinUrl } from './groupApi';

type SearchTab = 'groups' | 'users';

export function GroupsScreen() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [myGroups, setMyGroups] = useState<GroupWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTab, setSearchTab] = useState<SearchTab>('groups');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GroupWithMeta[]>([]);
  const [userResults, setUserResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadMyGroups = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await fetchMyGroups(user.id);
    if (!error) setMyGroups(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadMyGroups(); }, [loadMyGroups]);

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); setUserResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      if (searchTab === 'groups') {
        const { data } = await searchGroups(query, user?.id || '');
        if (!cancelled) setSearchResults(data || []);
      } else {
        const { data } = await searchUsers(query);
        if (!cancelled) setUserResults(data || []);
      }
      if (!cancelled) setSearching(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, searchTab, user?.id]);

  const onCreate = async () => {
    if (!user?.id || !newName.trim()) return;
    setCreating(true); setCreateError(null);
    const { data, error } = await createGroup(newName, newDesc, user.id);
    setCreating(false);
    if (error || !data) { setCreateError(error || 'Failed to create group.'); return; }
    setShowCreate(false); setNewName(''); setNewDesc('');
    await loadMyGroups();
    navigate(`/groups/${data.id}`);
  };

  const onJoin = async (groupId: string) => {
    if (!user?.id) return;
    setJoinError(null);
    const { error } = await joinGroup(groupId, user.id);
    if (error) { setJoinError(error); return; }
    await loadMyGroups();
    navigate(`/groups/${groupId}`);
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
            <button onClick={() => navigate('/lobby')} className="tb-btn-ghost">Sessions</button>
            {profile?.role === 'admin' && <button onClick={() => navigate('/admin')} className="tb-btn-ghost">Admin</button>}
            <button onClick={() => navigate('/settings')} className="tb-btn-ghost">Settings</button>
            <ThemeToggle />
            <button onClick={signOut} className="tb-btn-secondary">Log out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Groups</h1>
            <p className="text-sm text-ink-500 dark:text-ink-300">Create groups, chat, and share files with anyone.</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="tb-btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Create group
          </button>
        </div>

        <div className="mb-6">
          <div className="mb-3 flex gap-1 rounded-lg border border-ink-200 bg-white p-1 dark:border-ink-700 dark:bg-ink-700/60">
            <button onClick={() => setSearchTab('groups')}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${searchTab === 'groups' ? 'bg-brand-500 text-white' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-600'}`}>
              Search groups
            </button>
            <button onClick={() => setSearchTab('users')}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${searchTab === 'users' ? 'bg-brand-500 text-white' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-600'}`}>
              Search users
            </button>
          </div>

          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="tb-input pl-10"
              placeholder={searchTab === 'groups' ? 'Search by group name or URL slug (e.g. math-class or math-class)' : 'Search by @username (e.g. jane_doe)'}
            />
          </div>
          {joinError && <p className="mt-2 text-xs text-danger">{joinError}</p>}
        </div>

        {query.trim() ? (
          searching ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="tb-card h-16 animate-pulse bg-ink-100 dark:bg-ink-700/40" />)}</div>
          ) : searchTab === 'groups' ? (
            <div className="space-y-2">
              {searchResults.length === 0 && <div className="tb-card p-8 text-center text-sm text-ink-500">No groups found. Try a different name or create a new one.</div>}
              {searchResults.map((g) => <GroupCard key={g.id} group={g} onOpen={() => g.isMember ? navigate(`/groups/${g.id}`) : onJoin(g.id)} actionLabel={g.isMember ? 'Open' : 'Join'} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {userResults.length === 0 && <div className="tb-card p-8 text-center text-sm text-ink-500">No users found.</div>}
              {userResults.map((u) => <UserCard key={u.id} user={u} onMessage={() => navigate('/groups')} />)}
            </div>
          )
        ) : (
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold">Your groups</h2>
            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="tb-card h-16 animate-pulse bg-ink-100 dark:bg-ink-700/40" />)}</div>
            ) : myGroups.length === 0 ? (
              <div className="tb-card p-8 text-center text-sm text-ink-500 dark:text-ink-300">
                You're not in any groups yet. Create one or search above to join.
              </div>
            ) : (
              <div className="space-y-2">
                {myGroups.map((g) => <GroupCard key={g.id} group={g} onOpen={() => navigate(`/groups/${g.id}`)} actionLabel="Open" />)}
              </div>
            )}
          </section>
        )}
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md animate-popIn rounded-2xl border border-ink-200 bg-white p-5 shadow-float dark:border-ink-700 dark:bg-ink-700">
            <h3 className="mb-1 font-display text-lg font-bold">Create a group</h3>
            <p className="mb-4 text-sm text-ink-500 dark:text-ink-300">Anyone can join with the group URL.</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-300">Group name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} className="tb-input" placeholder="e.g. Math Class 2024" autoFocus />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-300">Description (optional)</label>
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="tb-input" placeholder="What's this group about?" />
              </div>
              {createError && <p className="text-xs text-danger">{createError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="tb-btn-secondary">Cancel</button>
              <button onClick={onCreate} disabled={creating || !newName.trim()} className="tb-btn-primary">{creating ? 'Creating…' : 'Create group'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, onOpen, actionLabel }: { group: GroupWithMeta; onOpen: () => void; actionLabel: string }) {
  return (
    <div className="tb-card flex items-center gap-3 p-4 transition hover:border-brand-400">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-lg font-bold text-brand-500">
        {group.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{group.name}</p>
        <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-300">
          {group.description || 'No description'} · {group.memberCount || 0} members
        </p>
        <p className="mt-0.5 truncate text-[11px] text-ink-400">/{group.slug}</p>
      </div>
      <button onClick={onOpen} className={`shrink-0 ${group.isMember ? 'tb-btn-secondary' : 'tb-btn-primary'} text-xs`}>{actionLabel}</button>
    </div>
  );
}

function UserCard({ user, onMessage }: { user: Profile; onMessage: () => void }) {
  return (
    <div className="tb-card flex items-center gap-3 p-4 transition hover:border-brand-400">
      <Avatar name={user.name} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{user.name}</p>
        <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-300">@{user.username} · <span className="capitalize">{user.role}</span></p>
      </div>
      <button onClick={onMessage} className="tb-btn-secondary shrink-0 text-xs">View groups</button>
    </div>
  );
}
