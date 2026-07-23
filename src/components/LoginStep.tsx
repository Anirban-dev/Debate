import React, { useState, useEffect } from 'react';
import { ArrowRight, Disc as DiscordIcon, ShieldCheck, UserCheck, AtSign, CheckCircle2, Copy, Info } from 'lucide-react';

interface LoginStepProps {
  onLoginSuccess: (user: { username: string; authProvider: string; avatarUrl: string }) => void;
}

export const LoginStep: React.FC<LoginStepProps> = ({ onLoginSuccess }) => {
  // Mode: 'oauth_select' | 'choose_username'
  const [stepMode, setStepMode] = useState<'oauth_select' | 'choose_username'>('oauth_select');

  const [desiredUsername, setDesiredUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRedirectInfo, setShowRedirectInfo] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const devCallbackUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-o67dfueucobbxfqmdxf65h-251519709486.asia-southeast1.run.app'}/api/auth/callback`;

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OAUTH_AUTH_SUCCESS') {
        const payload = event.data.user;
        if (payload) {
          if (payload.needsUsername || !payload.username) {
            // New user via OAuth -> Show "Choose Unique Username" screen
            setStepMode('choose_username');
            setErrorMsg(null);
          } else {
            // Returning user -> Log in directly!
            onLoginSuccess({
              username: payload.username,
              authProvider: payload.authProvider,
              avatarUrl: payload.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${payload.username}`
            });
          }
        }
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [onLoginSuccess]);

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
            `Please configure ${selectedProvider.toUpperCase()}_CLIENT_ID and ${selectedProvider.toUpperCase()}_CLIENT_SECRET in your environment settings.`
        );
        setShowRedirectInfo(true);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to initiate ${selectedProvider} OAuth login.`);
      setShowRedirectInfo(true);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = desiredUsername.trim().toLowerCase();

    if (!cleanName || cleanName.length < 3) {
      setErrorMsg('Username must be at least 3 characters long.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanName })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register username.');
      }

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error setting username');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            MatchLobby Identity Authentication
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {stepMode === 'oauth_select' ? 'Sign In to MatchLobby' : 'Create Your Unique Username'}
          </h1>

          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {stepMode === 'oauth_select'
              ? 'OAuth authentication with Google or Discord is required to enter competitive lobbies.'
              : 'Choose a unique player handle to represent you across all lobbies and matches.'}
          </p>
        </div>

        {errorMsg && (
          <div className="text-xs text-red-400 bg-red-950/80 p-3 rounded-xl border border-red-800/80 leading-relaxed space-y-1">
            <p className="font-semibold">{errorMsg}</p>
          </div>
        )}

        {/* STEP 1: OAuth Social Buttons Only */}
        {stepMode === 'oauth_select' && (
          <div className="space-y-4 pt-2">
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

            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRedirectInfo(!showRedirectInfo)}
                className="text-xs text-slate-400 hover:text-blue-400 underline flex items-center gap-1 transition"
              >
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Google / Discord OAuth Redirect URI Setup</span>
              </button>

              {showRedirectInfo && (
                <div className="w-full bg-slate-950/90 border border-slate-800 p-3.5 rounded-2xl text-[11px] text-slate-300 space-y-2 mt-1">
                  <p className="font-semibold text-blue-400">Authorized Redirect URIs for OAuth Console:</p>
                  <p className="text-slate-400">
                    Add the following URI to your <strong>Google Cloud Console</strong> &rarr; Credentials &rarr; OAuth 2.0 Client ID:
                  </p>
                  
                  {/* Localhost Callback URI */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Localhost (Standard):</span>
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-700/80 rounded-lg p-2 font-mono text-[10px] text-emerald-400 overflow-x-auto">
                      <span className="truncate mr-2">http://localhost:3000/api/auth/callback</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard('http://localhost:3000/api/auth/callback')}
                        className="text-slate-400 hover:text-white shrink-0 p-1 bg-slate-800 rounded"
                      >
                        {copiedUrl === 'http://localhost:3000/api/auth/callback' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Active Cloud App Callback URI */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Preview / Cloud URL:</span>
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-700/80 rounded-lg p-2 font-mono text-[10px] text-blue-300 overflow-x-auto">
                      <span className="truncate mr-2">{devCallbackUrl}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(devCallbackUrl)}
                        className="text-slate-400 hover:text-white shrink-0 p-1 bg-slate-800 rounded"
                      >
                        {copiedUrl === devCallbackUrl ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                    💡 Tip: Set <code className="text-blue-300">APP_URL=http://localhost:3000</code> in your environment variables if you want to force all OAuth callback requests to use localhost.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-1 text-center text-[11px] text-slate-500 space-y-1">
              <p className="flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                No passwords required &bull; Secured with Google & Discord OAuth
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: New User - Choose Unique Username Form */}
        {stepMode === 'choose_username' && (
          <form onSubmit={handleClaimUsername} className="space-y-4 pt-1">
            <div className="bg-blue-950/40 border border-blue-900/50 p-3 rounded-xl text-xs text-blue-300 flex items-center gap-2">
              <UserCheck className="w-4 h-4 shrink-0 text-blue-400" />
              <span>OAuth Verified! Please choose your unique username to complete registration.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Desired Unique Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <AtSign className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={desiredUsername}
                  onChange={(e) => setDesiredUsername(e.target.value)}
                  placeholder="e.g. shadow_striker, alex_99"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl py-3 pl-9 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                3-20 characters (letters, numbers, and underscores). Must be unique.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-900/30 transition flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <span>Registering Username...</span>
              ) : (
                <>
                  <span>Claim Username & Enter</span>
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
