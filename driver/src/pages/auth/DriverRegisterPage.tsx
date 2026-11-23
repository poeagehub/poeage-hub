import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { friendlyError } from '@poeage/firebase-client';
import { useDriverAuth } from '../../context/AuthContext';
import { ActionButton, AuthShell, Field, Notice } from '../../components/ui';

export const DriverRegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { registerDriverAccount } = useDriverAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password !== confirmPassword) return setErrorMsg('Passwords do not match.');
    if (password.length < 8) return setErrorMsg('Password must be at least 8 characters long.');
    setLoading(true);
    try {
      await registerDriverAccount(email, password, name);
      navigate('/onboarding', { replace: true });
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Failed to create your account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="d-card p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent-300">
          <span className="w-5 h-5 rounded-full bg-accent-500 text-white flex items-center justify-center text-[10px]">1</span> of 2 · Account
        </div>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-white">Become a delivery partner</h1>
        <p className="text-sm text-slate-400 mt-1.5">Create your account first. You'll add your vehicle details next.</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          {errorMsg && <Notice tone="error">{errorMsg}</Notice>}
          <Field label="Full name"><input className="d-input" required autoComplete="name" placeholder="Vikram Singh" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email"><input className="d-input" type="email" required autoComplete="username" placeholder="vikram@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Password"><input className="d-input" type="password" required autoComplete="new-password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <Field label="Confirm password"><input className="d-input" type="password" required autoComplete="new-password" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></Field>
          </div>
          <ActionButton type="submit" size="lg" className="w-full" loading={loading}>Continue to vehicle details</ActionButton>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already registered? <Link to="/login" className="font-bold text-accent-300 hover:text-accent-200">Sign in</Link>
        </p>
      </div>
    </AuthShell>
  );
};
