import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Disc as DiscordIcon, User, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface LoginStepProps {
  onLoginSuccess: (user: { username: string; authProvider: string; avatarUrl: string }) => void;
}

export const LoginStep: React.FC<LoginStepProps> = ({ onLoginSuccess }) => {
  const [authTab, setAuthTab] = useState<'oauth' | 'credentials'>('oauth');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OAUTH_AUTH_SUCCESS') {
        const user = event.data.user;
        if (user && user.username) {
          onLoginSuccess(user);
        }
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [onLoginSuccess]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = usernameInput.trim();
    if (!cleanName) {
      setErrorMsg('Please enter your unique username');
      return;
    }
    if (!passwordInput || passwordInput.length < 4) {
      setErrorMsg('Password must be at least 4 characters long to authenticate account');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanName, password: passwordInput, authProvider: 'direct' })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (selectedProvider: 'google' | 'discord') => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/oauth?provider=${selectedProvider}`);
      const data = await res.json();

      if (data.configured && data.authUrl) {
        window.open(data.authUrl, 'oauth_popup', 'width=600,height=700');
      } else {
        setErrorMsg(
          data.message ||
            `Please configure your ${selectedProvider.toUpperCase()}_CLIENT_ID and ${selectedProvider.toUpperCase()}_CLIENT_SECRET in environment settings to enable ${selectedProvider} OAuth.`
        );
      }
    } catch (err: any) {
      setErrorMsg(`Failed to initiate ${selectedProvider} OAuth login.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            MatchLobby Auth Required
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Sign In to Continue
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Mandatory account authentication is required to access competitive lobbies, voice/video stages and spectator lounges.
          </p>
        </div>

        {/* Auth Method Switcher Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => { setAuthTab('oauth'); setErrorMsg(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              authTab === 'oauth'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            OAuth Sign-In
          </button>
          <button
            type="button"
            onClick={() => { setAuthTab('credentials'); setErrorMsg(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              authTab === 'credentials'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Player Credentials
          </button>
        </div>

        {errorMsg && (
          <div className="text-xs text-red-400 bg-red-950/80 p-3 rounded-xl border border-red-800/80 leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* TAB 1: OAuth Social Login */}
        {authTab === 'oauth' && (
          <div className="space-y-4 pt-1">
            <button
              type="button"
              onClick={() => handleOAuthLogin('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 px-4 rounded-2xl shadow-lg transition active:scale-[0.98]"
            >
              <svg width={20} height={20} viewBox="0 0 24 24" className="shrink-0">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.2-.7-.4-1.5-.4-2.3z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin('discord')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-indigo-900/30 transition active:scale-[0.98]"
            >
              <DiscordIcon className="w-5 h-5 text-white" />
              <span>Continue with Discord</span>
            </button>

            <div className="pt-2 text-center text-[11px] text-slate-500 space-y-1">
              <p className="flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Verified identity with OAuth 2.0 & JWT Sessions
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: Username & Password Auth */}
        {authTab === 'credentials' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Player Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="e.g. alex_blue, host_admin"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl py-3 pl-9 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Account Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="At least 4 characters"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl py-3 pl-9 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-900/30 transition flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <span>Authenticating Credentials...</span>
              ) : (
                <>
                  <span>Authenticate & Enter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
