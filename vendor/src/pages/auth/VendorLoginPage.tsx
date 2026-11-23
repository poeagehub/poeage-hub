import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useVendorAuth } from '../../context/AuthContext';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@poeage/ui';
import { Store, AlertCircle } from 'lucide-react';
import { friendlyError } from '@poeage/firebase-client';

export const VendorLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { loginVendor } = useVendorAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleLogin = async (targetEmail: string, targetPass: string) => {
    setErrorMsg(null);
    setLoading(true);

    try {
      await loginVendor(targetEmail, targetPass);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Failed to sign in. Please verify credentials.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-950/40 via-slate-950 to-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full border-slate-800/80 bg-slate-900/95 backdrop-blur-xl text-white shadow-2xl rounded-3xl animate-in fade-in zoom-in-95 duration-200">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-teal-500/25 to-teal-400/10 border border-teal-500/30 rounded-2xl text-teal-400 flex items-center justify-center mx-auto shadow-inner">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <CardTitle className="text-2xl font-black tracking-tight text-white">POEAGE HUB</CardTitle>
            <p className="text-xs uppercase tracking-widest text-teal-400 font-bold mt-1">
              Seller & Merchant Portal
            </p>
          </div>
          <CardDescription className="text-slate-400 text-xs">
            Manage your store inventory, customer orders, and payouts.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-1">
          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Seller Email"
              type="email"
              required
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/40 rounded-xl"
            />

            <Input
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-teal-400 focus:ring-1 focus:ring-teal-400/40 rounded-xl"
            />

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-bold py-2.5 shadow-lg shadow-teal-900/30 active:scale-[0.99] transition-all duration-200 rounded-xl mt-2"
              isLoading={loading}
            >
              Sign In to Seller Dashboard
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 pt-1">
            Want to sell on POEAGE HUB?{' '}
            <Link to="/register" className="font-semibold text-teal-400 hover:text-teal-300 transition-colors">
              Register your business
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
