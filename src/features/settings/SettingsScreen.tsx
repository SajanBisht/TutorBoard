import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/useTheme';
import { ThemeToggle } from '../../components/ThemeToggle';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Logo } from '../auth/LoginScreen';

function Row({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-ink-500 dark:text-ink-300">{label}</span>
      <span className="text-sm font-medium text-ink-800 dark:text-ink-50">{value ?? children}</span>
    </div>
  );
}

export function SettingsScreen() {
  const { profile, user, refreshProfile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => { setName(profile?.name || ''); setUsername(profile?.username || ''); }, [profile?.name, profile?.username]);

  const onSave = async () => {
    setSaving(true); setError(null);
    const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    const { error } = await supabase.from('profiles').update({ name, username: cleanUsername }).eq('id', user!.id);
    setSaving(false);
    if (error) { setError(error.message); return; }
    await refreshProfile();
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000);
  };

  return (
    <div className="min-h-full bg-ink-50 dark:bg-ink-800">
      <header className="sticky top-0 z-10 border-b border-ink-200 bg-ink-50/80 backdrop-blur dark:border-ink-700 dark:bg-ink-800/80">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2"><Logo /><span className="font-display text-lg font-bold tracking-tight">Settings</span></div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/lobby')} className="tb-btn-ghost">Lobby</button>
            <button onClick={() => navigate('/groups')} className="tb-btn-ghost">Groups</button>
            {profile?.role === 'admin' && <button onClick={() => navigate('/admin')} className="tb-btn-ghost">Admin</button>}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-1 font-display text-2xl font-bold">Settings</h1>
        <p className="mb-6 text-sm text-ink-500 dark:text-ink-300">Manage your profile and preferences.</p>

        <section className="tb-card mb-4 p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Profile</h2>
          <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-300">Display name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="tb-input mb-3" placeholder="Your name" />
          <label className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-300">Username</label>
          <div className="mb-3 flex items-center rounded-lg border border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-700">
            <span className="pl-3 text-sm text-ink-400">@</span>
            <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} className="w-full bg-transparent px-1 py-2 text-sm text-ink-800 outline-none dark:text-ink-50" />
          </div>
          {error && <p className="mb-2 text-xs text-danger">{error}</p>}
          <div className="flex items-center gap-3">
            <button onClick={onSave} disabled={saving || !name.trim()} className="tb-btn-primary">{saving ? 'Saving…' : 'Save changes'}</button>
            {savedFlash && <span className="text-xs text-success">Saved</span>}
          </div>
        </section>

        <section className="tb-card mb-4 divide-y divide-ink-100 p-5 dark:divide-ink-700">
          <h2 className="mb-1 font-display text-base font-semibold">Account</h2>
          <Row label="Email" value={profile?.email || user?.email} />
          <Row label="Role"><span className="tb-badge bg-brand-500/10 capitalize text-brand-600 dark:text-brand-300">{profile?.role}</span></Row>
          <Row label="Joined" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'} />
        </section>

        <section className="tb-card mb-4 p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Appearance</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-ink-500 dark:text-ink-300">Switch between light and dark mode.</p>
            </div>
            <button onClick={toggle} className="tb-btn-secondary">
              {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            </button>
          </div>
        </section>

        <section className="tb-card p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Session</h2>
          <button onClick={() => setConfirmLogout(true)} className="tb-btn-secondary text-danger">Log out</button>
        </section>
      </main>

      <ConfirmDialog open={confirmLogout} title="Log out?" description="You will need to sign in again to access your sessions." confirmLabel="Log out" onConfirm={signOut} onCancel={() => setConfirmLogout(false)} />
    </div>
  );
}
