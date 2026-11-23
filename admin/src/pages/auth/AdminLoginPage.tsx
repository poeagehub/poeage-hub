import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/AuthContext';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@poeage/ui';
import { Shield, AlertCircle, Lock, Sparkles, CheckCircle2 } from 'lucide-react';
import { friendlyError } from '@poeage/firebase-client';

export const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { loginAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleLogin = async (targetEmail: string, targetPass: string) => {
    setErrorMsg(null);
    setLoading(true);

    try {
      await loginAdmin(targetEmail, targetPass);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, 'Authentication failed. Please verify credentials.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-primary-500 selection:text-white">
      {/* Modern cyber ambient glow orbs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/15 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-500/15 rounded-full blur-[128px] pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e3a8a_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />

      <Card className="max-w-md w-full border-slate-800/90 bg-slate-900/90 backdrop-blur-xl text-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] relative z-10 rounded-2xl overflow-hidden ring-1 ring-white/10 animate-page-enter">
        {/* Top electric accent strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400" />

        <CardHeader className="text-center space-y-3 pb-4 pt-6">
          <div className="relative mx-auto">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/40 rounded-2xl text-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/10 ring-4 ring-blue-500/10">
              <Shield className="w-7 h-7 text-blue-400" />
            </div>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse-live" />
          </div>
          <div>
            <CardTitle className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
              <span>POEAGE</span>
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">ADMIN</span>
            </CardTitle>
            <p className="text-xs uppercase tracking-widest text-blue-400 font-bold mt-1">
              Operations & Control Center
            </p>
          </div>
          <CardDescription className="text-slate-400 text-xs max-w-xs mx-auto">
            Restricted entry. Authenticated administrative token and role clearance required.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-1 pb-6">
          {errorMsg && (
            <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 shadow-inner">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Admin Identity (Email)"
              type="email"
              required
              autoComplete="username"
              placeholder="admin@poeagehub.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-950/80 border-slate-700/80 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl h-11"
            />

            <Input
              label="Security Passkey (Password)"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950/80 border-slate-700/80 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl h-11"
            />

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 shadow-lg shadow-blue-600/30 active:scale-98 transition-all rounded-xl mt-2 cursor-pointer"
              isLoading={loading}
            >
              Authenticate Admin Session
            </Button>
          </form>

          <div className="pt-3 border-t border-slate-800/80 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>End-to-End TLS 1.3 · Audit Logging Enabled</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Access is continuously recorded. Unauthorized attempts will be quarantined.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
