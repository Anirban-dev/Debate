import React, { useState } from 'react';
import { Sparkles, ArrowRight, Disc as DiscordIcon, User, ShieldCheck } from 'lucide-react';

interface LoginStepProps {
  onLoginSuccess: (user: { username: string; authProvider: string; avatarUrl: string }) => void;
}

export const LoginStep: React.FC<LoginStepProps> = ({ onLoginSuccess }) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [provider, setProvider] = useState<'direct' | 'google' | 'discord'>('direct');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = usernameInput.trim();
    if (!cleanName) {
      setErrorMsg('Please enter a unique username to continue');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanName, authProvider: provider })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting to database server');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (selectedProvider: 'google' | 'discord') => {
    setProvider(selectedProvider);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/auth/oauth?provider=${selectedProvider}`);
      const data = await res.json();

      if (data.configured && data.authUrl) {
        window.open(data.authUrl, 'oauth_popup', 'width=600,height=700');
      } else {
        // Preset username fallback if env var is not yet configured in .env
        const defaultName = selectedProvider === 'google' ? 'alex_blue' : 'sarah_red';
        setUsernameInput(defaultName);
        setErrorMsg(
          data.message ||
            `Note: ${selectedProvider.toUpperCase()}_CLIENT_ID environment variable is not configured yet. Added demo handle @${defaultName}.`
        );
      }
    } catch (err: any) {
      handleQuickPreset(selectedProvider === 'google' ? 'alex_blue' : 'sarah_red', selectedProvider);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Step 1: Account Login
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome to MatchLobby
          </h1>
          <p className="text-xs text-slate-400">
            Sign in with your unique username to access competitive match lobbies, video/voice & spectator lounges.
          </p>
        </div>

        {/* Social Quick Login Options */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleOAuthLogin('google')}
            className={`flex items-center justify-center gap-2 text-xs font-semibold py-2.5 px-3 rounded-xl border transition ${
              provider === 'google'
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40'
                : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200'
            }`}
          >
            <svg width={16} height={16} className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
              <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.2-.7-.4-1.5-.4-2.3z"/>
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
            </svg>
            Google OAuth
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin('discord')}
            className={`flex items-center justify-center gap-2 text-xs font-semibold py-2.5 px-3 rounded-xl border transition ${
              provider === 'discord'
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/40'
                : 'bg-indigo-950/60 hover:bg-indigo-900/60 border-indigo-800/80 text-indigo-200'
            }`}
          >
            <DiscordIcon className="w-4 h-4 text-indigo-400" />
            Discord OAuth
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Unique Player / Host Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. alex_blue, sarah_red, host_admin"
                className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl py-3 pl-9 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-400 bg-red-950/60 p-2.5 rounded-lg border border-red-800">
              {errorMsg}
            </p>
          )}

          {/* Preset User Handles Helper */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <span className="text-[11px] text-slate-400 block font-medium">Quick Select Demo Usernames:</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickPreset('admin')}
                className="text-[11px] px-2.5 py-1 rounded-md bg-purple-950/80 border border-purple-800 text-purple-300 hover:bg-purple-900/80 font-mono"
              >
                @admin (Host)
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('alex_blue')}
                className="text-[11px] px-2.5 py-1 rounded-md bg-blue-950/80 border border-blue-800 text-blue-300 hover:bg-blue-900/80 font-mono"
              >
                @alex_blue (Team 1)
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('sarah_red')}
                className="text-[11px] px-2.5 py-1 rounded-md bg-red-950/80 border border-red-800 text-red-300 hover:bg-red-900/80 font-mono"
              >
                @sarah_red (Team 2)
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('fan_guest')}
                className="text-[11px] px-2.5 py-1 rounded-md bg-amber-950/80 border border-amber-800 text-amber-300 hover:bg-amber-900/80 font-mono"
              >
                @fan_guest (Spectator)
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-900/30 transition flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <span>Authenticating with Database...</span>
            ) : (
              <>
                <span>Login & Proceed to Game Modes</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
