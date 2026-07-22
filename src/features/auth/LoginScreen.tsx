import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h20v14H2z" /><path d="M8 21h8M12 17v4" /></svg>
      </div>
      <span className="font-display text-lg font-bold">TutorBoard</span>
    </div>
  );
}

interface FieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}

export function Field({ label, type = 'text', value, onChange, placeholder, error, ...rest }: FieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="tb-input" {...rest} />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function LoginScreen() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error); else navigate('/lobby');
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-ink-50 px-4 dark:bg-ink-800">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="tb-card p-6">
          <h1 className="font-display text-xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">Sign in to continue to TutorBoard.</p>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />
            {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
            <button type="submit" disabled={loading} className="tb-btn-primary w-full">{loading ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p className="mt-4 text-center text-sm text-ink-500 dark:text-ink-300">No account? <Link to="/register" className="font-semibold text-brand-500 hover:text-brand-600">Sign up</Link></p>
        </div>
      </div>
    </div>
  );
}
