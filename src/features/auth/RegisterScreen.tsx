import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Role } from '../../lib/types';
import { Logo, Field } from './LoginScreen';
import { ThemeToggle } from '../../components/ThemeToggle';

export function RegisterScreen() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('teacher');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) { setError('Username must be at least 3 characters (letters, numbers, underscores).'); return; }
    setBusy(true); setError(null);
    const { error } = await signUp(email.trim(), password, name.trim(), cleanUsername, role);
    setBusy(false);
    if (error) setError(error);
    else navigate('/lobby');
  };

  return (
    <div className="min-h-full bg-ink-50 dark:bg-ink-800">
      <header className="flex items-center justify-between px-4 py-4"><Logo /><ThemeToggle /></header>
      <main className="mx-auto flex max-w-md flex-col px-4 py-8">
        <h1 className="font-display text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">Start tutoring with a collaborative whiteboard and group chat.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Full name"><input required value={name} onChange={(e) => setName(e.target.value)} className="tb-input" placeholder="Jane Doe" /></Field>
          <Field label="Username" hint="Unique handle others can search to find you. Letters, numbers, underscores only.">
            <div className="flex items-center rounded-lg border border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-700">
              <span className="pl-3 text-sm text-ink-400">@</span>
              <input required value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} className="w-full bg-transparent px-1 py-2 text-sm text-ink-800 outline-none placeholder:text-ink-400 dark:text-ink-50" placeholder="jane_doe" />
            </div>
          </Field>
          <Field label="Email"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="tb-input" placeholder="you@example.com" /></Field>
          <Field label="Password"><input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="tb-input" placeholder="At least 6 characters" /></Field>
          <Field label="Role">
            <div className="grid grid-cols-3 gap-2">
              {(['teacher', 'student', 'admin'] as Role[]).map((r) => (
                <button type="button" key={r} onClick={() => setRole(r)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${role === r ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:bg-ink-700 dark:text-ink-200'}`}>{r}</button>
              ))}
            </div>
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={busy} className="tb-btn-primary w-full">{busy ? 'Creating…' : 'Create account'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-300">Already have an account? <Link to="/login" className="font-semibold text-brand-500 hover:underline">Sign in</Link></p>
      </main>
    </div>
  );
}
