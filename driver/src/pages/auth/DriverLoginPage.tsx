import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { friendlyError } from '@poeage/firebase-client';
import { useDriverAuth } from '../../context/AuthContext';
import { ActionButton, AuthShell, Field, Notice } from '../../components/ui';

export const DriverLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { loginDriver } = useDriverAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      await loginDriver(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Failed to sign in. Please check your details.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="d-card p-4 min-[380px]:p-6 sm:p-8">
        <h1 className="text-2xl font-black tracking-tight text-white">Welcome back</h1>
        <p className="text-sm text-slate-400 mt-1.5">Sign in to accept dispatches and track your earnings.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 min-[380px]:space-y-5">
          {errorMsg && <Notice tone="error">{errorMsg}</Notice>}
          <Field label="Email">
            <input className="d-input" type="email" required autoComplete="username" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password">
            <div className="relative">
              <input className="d-input pr-12" type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="••••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-white">
                {show ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
          </Field>
          <ActionButton type="submit" size="lg" className="w-full" loading={loading}>Sign in</ActionButton>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          New delivery partner?{' '}
          <Link to="/register" className="font-bold text-accent-300 hover:text-accent-200">Create an account</Link>
        </p>
      </div>
    </AuthShell>
  );
};
