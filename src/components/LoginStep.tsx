import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { ArrowRight, Disc as DiscordIcon, ShieldCheck, AtSign, CheckCircle2, Copy, Info } from 'lucide-react';

interface LoginStepProps {
  onLoginSuccess: (user: { username: string; authProvider: string; avatarUrl: string }) => void;
}

export const LoginStep: React.FC<LoginStepProps> = ({ onLoginSuccess }) => {
  const [handleInput, setHandleInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRedirectInfo, setShowRedirectInfo] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const nextAuthCallbackUrl = `${currentOrigin}/api/auth/callback/google`;

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = handleInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!cleanName || cleanName.length < 3) {
      setErrorMsg('Username must be at least 3 alphanumeric characters.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await signIn('credentials', {
        username: cleanName,
        redirect: false
      });

      if (res?.error) {
        throw new Error('Failed to sign in with handle.');
      }

      // Fetch verified user session
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const data = await meRes.json();
        if (data.authenticated && data.user) {
          onLoginSuccess(data.user);
          return;
        }
      }

      // Fallback
      onLoginSuccess({
        username: cleanName,
        authProvider: 'nextauth',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanName}`
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error signing in');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'discord') => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await signIn(provider, { callbackUrl: '/' });
    } catch (err: any) {
      setErrorMsg(`Failed to initiate ${provider} OAuth.`);
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
            NextAuth Session Security
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Sign In to MatchLobby
          </h1>

          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Enter your player handle to join immediately, or use NextAuth with Google or Discord.
          </p>
        </div>

        {errorMsg && (
          <div className="text-xs text-red-400 bg-red-950/80 p-3 rounded-xl border border-red-800/80 leading-relaxed space-y-1">
            <p className="font-semibold">{errorMsg}</p>
          </div>
        )}

        <div className="space-y-4 pt-2">
          {/* Instant Handle Sign-In */}
          <form onSubmit={handleCredentialsLogin} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Player Handle / Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <AtSign className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder="Enter your handle (e.g. alex_99)"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-xl py-3 pl-9 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-blue-900/30 transition flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <span>Entering Lobby...</span>
              ) : (
                <>
                  <span>Enter Match Lobby</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-3 text-slate-500 font-semibold tracking-wider">
                or authenticate with social OAuth
              </span>
            </div>
          </div>

          {/* Social OAuth Buttons */}
          <button
            type="button"
            onClick={() => handleOAuthSignIn('google')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 px-4 rounded-2xl shadow-lg transition active:scale-[0.98]"
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
            onClick={() => handleOAuthSignIn('discord')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-2xl shadow-lg shadow-indigo-900/30 transition active:scale-[0.98]"
          >
            <DiscordIcon className="w-5 h-5 text-white" />
            <span>Continue with Discord</span>
          </button>

          {/* OAuth Redirect Info Toggle */}
          <div className="pt-2 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRedirectInfo(!showRedirectInfo)}
              className="text-xs text-slate-400 hover:text-blue-400 underline flex items-center gap-1 transition"
            >
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span>NextAuth OAuth Redirect URI Details</span>
            </button>

            {showRedirectInfo && (
              <div className="w-full bg-slate-950/90 border border-slate-800 p-3.5 rounded-2xl text-[11px] text-slate-300 space-y-2 mt-1">
                <p className="font-semibold text-blue-400">NextAuth Redirect URI for Google Cloud Console:</p>
                <p className="text-slate-400 leading-relaxed">
                  When using Google OAuth with NextAuth, register this exact URI under <strong>Authorized redirect URIs</strong>:
                </p>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between bg-slate-900 border border-amber-500/50 rounded-lg p-2 font-mono text-[10px] text-amber-300 overflow-x-auto">
                    <span className="truncate mr-2 font-bold">{nextAuthCallbackUrl}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(nextAuthCallbackUrl)}
                      className="text-slate-400 hover:text-white shrink-0 p-1 bg-slate-800 rounded"
                    >
                      {copiedUrl === nextAuthCallbackUrl ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                  Notice that NextAuth uses <code className="text-blue-300">/api/auth/callback/google</code> as its callback path.
                </p>
              </div>
            )}
          </div>

          <div className="pt-1 text-center text-[11px] text-slate-500 space-y-1">
            <p className="flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Powered by NextAuth.js &bull; Fast & Secure Access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
