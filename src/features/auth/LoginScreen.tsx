import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { ThemeToggle } from '../../components/ThemeToggle';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-white shadow-soft">
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><path d="M7 22l5-10 4 7 3-4 6 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="22" cy="10" r="2.5" fill="#F5A623"/></svg>
      </div>
      <span className="font-display text-lg font-bold tracking-tight">TutorBoard</span>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-500 dark:text-ink-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}

export function LoginScreen() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
    else navigate('/lobby');
  };

  return (
    <div className="min-h-full bg-ink-50 dark:bg-ink-800">
      <header className="flex items-center justify-between px-4 py-4"><Logo /><ThemeToggle /></header>
      <main className="mx-auto flex max-w-md flex-col px-4 py-8">
        <h1 className="font-display text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">Sign in to your TutorBoard account.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Email"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="tb-input" placeholder="you@example.com" /></Field>
          <Field label="Password"><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="tb-input" placeholder="••••••••" /></Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={busy} className="tb-btn-primary w-full">{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-300">Need an account? <Link to="/register" className="font-semibold text-brand-500 hover:underline">Sign up</Link></p>
      </main>
    </div>
  );
}
