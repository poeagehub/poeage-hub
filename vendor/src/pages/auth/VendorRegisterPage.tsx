import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useVendorAuth } from '../../context/AuthContext';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@poeage/ui';
import { Store, AlertCircle } from 'lucide-react';
import { friendlyError } from '@poeage/firebase-client';

export const VendorRegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { registerVendorAccount } = useVendorAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      await registerVendorAccount(email, password, name);
      navigate('/onboarding', { replace: true });
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Failed to create seller account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-950/40 via-slate-950 to-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full border-slate-800/80 bg-slate-900/95 backdrop-blur-xl text-white shadow-2xl rounded-3xl animate-in fade-in zoom-in-95 duration-200">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-teal-500/25 to-teal-400/10 border border-teal-500/30 rounded-2xl text-teal-400 flex items-center justify-center mx-auto shadow-inner">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <CardTitle className="text-2xl font-black tracking-tight text-white">Create Seller Account</CardTitle>
            <p className="text-xs uppercase tracking-widest text-teal-400 font-bold mt-1">
              Step 1 of 2: Account Setup
            </p>
          </div>
          <CardDescription className="text-slate-400 text-xs">
            Start selling to thousands of customers across India on POEAGE HUB.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Primary Contact Name"
              type="text"
              required
              placeholder="Rajesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/40 rounded-xl"
            />

            <Input
              label="Business Email"
              type="email"
              required
              autoComplete="username"
              placeholder="rajesh@enterprises.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/40 rounded-xl"
            />

            <Input
              label="Password"
              type="password"
              required
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/40 rounded-xl"
            />

            <Input
              label="Confirm Password"
              type="password"
              required
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/40 rounded-xl"
            />

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-bold py-2.5 shadow-lg shadow-teal-900/30 active:scale-[0.99] transition-all duration-200 rounded-xl mt-2"
              isLoading={loading}
            >
              Continue to Business KYC
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400">
            Already registered as a seller?{' '}
            <Link to="/login" className="font-semibold text-teal-400 hover:text-teal-300 transition-colors">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
