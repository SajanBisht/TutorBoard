import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { Logo } from '../auth/LoginScreen';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Avatar } from '../../components/Avatar';

export function SettingsScreen() {
  const navigate = useNavigate();
  const { profile, signOut, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setBusy(true); setError(null); setSuccess(false);
    const { error } = await supabase.from('profiles').update({ name, username: username.toLowerCase().trim() }).eq('id', profile.id);
    setBusy(false);
    if (error) setError(error.message); else { setSuccess(true); await refreshProfile(); }
  };

  return (
    <div className="min-h-full bg-ink-50 dark:bg-ink-800">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/80 backdrop-blur-md dark:border-ink-700 dark:bg-ink-700/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/lobby')} className="tb-btn-ghost">Sessions</button>
            <button onClick={() => navigate('/groups')} className="tb-btn-ghost">Groups</button>
            <ThemeToggle />
            <button onClick={signOut} className="tb-btn-secondary text-xs">Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-8">
        <div className="flex items-center gap-3">
          <Avatar name={profile?.name || 'User'} size={48} />
          <div><h1 className="font-display text-xl font-bold">Settings</h1><p className="text-sm text-ink-500">{profile?.email}</p></div>
        </div>
        <form onSubmit={onSave} className="mt-6 tb-card space-y-4 p-5">
          <label className="block"><span className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Full name</span><input className="tb-input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Username</span><input className="tb-input" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Role</span><input className="tb-input opacity-60" value={profile?.role || ''} disabled /></label>
          {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
          {success && <div className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">Profile updated successfully.</div>}
          <button type="submit" disabled={busy} className="tb-btn-primary w-full">{busy ? 'Saving…' : 'Save changes'}</button>
        </form>
      </main>
    </div>
  );
}
