import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Logo, Field } from './LoginScreen';
import { Role } from '../../lib/types';

export function RegisterScreen() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    const { error } = await signUp(email, password, name, username, role);
    setLoading(false);
    if (error) setError(error); else navigate('/lobby');
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-ink-50 px-4 py-8 dark:bg-ink-800">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="tb-card p-6">
          <h1 className="font-display text-xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">Join TutorBoard and start teaching or learning.</p>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <Field label="Full name" value={name} onChange={setName} placeholder="Jane Doe" required />
            <Field label="Username" value={username} onChange={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="jane_doe" required />
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" required minLength={6} />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink-600 dark:text-ink-300">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="tb-input">
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
            <button type="submit" disabled={loading} className="tb-btn-primary w-full">{loading ? 'Creating account…' : 'Create account'}</button>
          </form>
          <p className="mt-4 text-center text-sm text-ink-500 dark:text-ink-300">Already have an account? <Link to="/login" className="font-semibold text-brand-500 hover:text-brand-600">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
