import React, { useState } from 'react';
import { MatchRoomState, TeamId } from '../types';
import { Shield, Users, Eye, Sparkles, UserCheck, AlertCircle, LogIn, Disc as DiscordIcon, Plus, Trash2, Clock, CheckCircle } from 'lucide-react';

interface LoginPageProps {
  roomState: MatchRoomState | null;
  onJoinRoom: (username: string, provider: 'google' | 'discord' | 'direct', isAdminRequest: boolean) => void;
  onAdminUpdateRoster?: (roster: { username: string; team: TeamId; personalizedTime?: number }[]) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  roomState,
  onJoinRoom,
  onAdminUpdateRoster
}) => {
  const [activeTab, setActiveTab] = useState<'player' | 'admin' | 'spectator'>('player');
  const [usernameInput, setUsernameInput] = useState('');
  const [adminUsernameInput, setAdminUsernameInput] = useState('admin');
  const [selectedProvider, setSelectedProvider] = useState<'google' | 'discord' | 'direct'>('direct');
  
  // Pre-match roster setup state for Admin
  const [preMatchRoster, setPreMatchRoster] = useState<{ username: string; team: TeamId; personalizedTime: number }[]>(
    roomState?.registeredRoster.map(r => ({ ...r, personalizedTime: r.personalizedTime || 180 })) || [
      { username: 'alex_blue', team: 'team1', personalizedTime: 180 },
      { username: 'jordan_blue', team: 'team1', personalizedTime: 180 },
      { username: 'sarah_red', team: 'team2', personalizedTime: 180 },
      { username: 'sam_red', team: 'team2', personalizedTime: 180 }
    ]
  );
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerTeam, setNewPlayerTeam] = useState<TeamId>('team1');
  const [newPlayerTime, setNewPlayerTime] = useState(180);

  // Social Auth Modal helper simulations
  const handleSocialAuth = (provider: 'google' | 'discord', defaultUsername: string) => {
    setSelectedProvider(provider);
    setUsernameInput(defaultUsername);
  };

  const handleAddPreMatchPlayer = () => {
    const trimmed = newPlayerName.trim().toLowerCase();
    if (!trimmed) return;
    if (preMatchRoster.some(p => p.username.toLowerCase() === trimmed)) {
      alert('Username already exists in match roster!');
      return;
    }
    const updated = [...preMatchRoster, { username: trimmed, team: newPlayerTeam, personalizedTime: newPlayerTime }];
    setPreMatchRoster(updated);
    setNewPlayerName('');
    if (onAdminUpdateRoster) {
      onAdminUpdateRoster(updated);
    }
  };

  const handleRemovePreMatchPlayer = (idx: number) => {
    const updated = preMatchRoster.filter((_, i) => i !== idx);
    setPreMatchRoster(updated);
    if (onAdminUpdateRoster) {
      onAdminUpdateRoster(updated);
    }
  };

  const handleJoin = (mode: 'player' | 'admin' | 'spectator') => {
    let nameToUse = mode === 'admin' ? adminUsernameInput.trim() : usernameInput.trim();
    if (!nameToUse) {
      if (mode === 'admin') nameToUse = 'admin';
      else {
        alert('Please enter a username or sign in with Google/Discord');
        return;
      }
    }

    if (mode === 'admin' && onAdminUpdateRoster) {
      onAdminUpdateRoster(preMatchRoster);
    }

    onJoinRoom(nameToUse, selectedProvider, mode === 'admin');
  };

  // Live auto-detection status check for typed username
  const checkDetectionStatus = () => {
    const trimmed = usernameInput.trim().toLowerCase();
    if (!trimmed) return null;
    const match = preMatchRoster.find(r => r.username.toLowerCase() === trimmed);
    if (match) {
      return {
        isPlayer: true,
        team: match.team,
        message: `Matched in ${match.team === 'team1' ? 'Team 1 (Blue)' : 'Team 2 (Red)'} roster!`
      };
    }
    return {
      isPlayer: false,
      message: 'Not found in pre-match roster -> Will auto-shift to Spectator Lobby'
    };
  };

  const detectionInfo = checkDetectionStatus();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Dynamic background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-2xl w-full bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide uppercase mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            MatchLobby Pro
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Dual Team & Spectator Hub
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Real-time match lobbies, live turn timers, auto-mute controls, shared notes & spectator lounge.
          </p>
        </div>

        {/* Auth / Role Switcher Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/80 mb-6">
          <button
            onClick={() => setActiveTab('player')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'player'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            Player Join
          </button>
          <button
            onClick={() => setActiveTab('spectator')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'spectator'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Eye className="w-4 h-4" />
            Spectator
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === 'admin'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Shield className="w-4 h-4" />
            Admin Host
          </button>
        </div>

        {/* TAB 1: PLAYER / DIRECT AUTO-DETECT JOIN */}
        {activeTab === 'player' && (
          <div className="space-y-6">
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Sign in or Enter Match Username
              </label>

              {/* Quick OAuth Simulations */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => handleSocialAuth('google', 'alex_blue')}
                  className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium py-2.5 px-3 rounded-lg border border-slate-700 transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"/>
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.2-.7-.4-1.5-.4-2.3z"/>
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
                  </svg>
                  Google Login
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialAuth('discord', 'sarah_red')}
                  className="flex items-center justify-center gap-2 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 text-xs font-medium py-2.5 px-3 rounded-lg border border-indigo-800/60 transition"
                >
                  <DiscordIcon className="w-4 h-4 text-indigo-400" />
                  Discord Login
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="e.g. alex_blue or sarah_red"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Roster Auto-Detection Feedback Box */}
              {detectionInfo && (
                <div className={`mt-3 p-3 rounded-lg text-xs flex items-center gap-2 border ${
                  detectionInfo.isPlayer
                    ? 'bg-blue-950/50 border-blue-800 text-blue-300'
                    : 'bg-amber-950/50 border-amber-800 text-amber-300'
                }`}>
                  {detectionInfo.isPlayer ? (
                    <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span>{detectionInfo.message}</span>
                </div>
              )}
            </div>

            {/* Pre-configured Demo Accounts Helper */}
            <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-800/60">
              <p className="text-xs text-slate-400 mb-2 font-medium">Quick Preset Match Roster Accounts:</p>
              <div className="flex flex-wrap gap-2">
                {preMatchRoster.map((p) => (
                  <button
                    key={p.username}
                    type="button"
                    onClick={() => {
                      setUsernameInput(p.username);
                      setSelectedProvider('direct');
                    }}
                    className={`text-xs px-2.5 py-1 rounded-md border font-mono transition ${
                      p.team === 'team1'
                        ? 'bg-blue-950/40 border-blue-800/80 text-blue-300 hover:bg-blue-900/60'
                        : 'bg-red-950/40 border-red-800/80 text-red-300 hover:bg-red-900/60'
                    }`}
                  >
                    @{p.username} ({p.team === 'team1' ? 'Blue' : 'Red'})
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleJoin('player')}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-900/30 transition flex items-center justify-center gap-2 text-sm"
            >
              <LogIn className="w-4 h-4" />
              Enter Match Lobby
            </button>
          </div>
        )}

        {/* TAB 2: SPECTATOR DIRECT JOIN */}
        {activeTab === 'spectator' && (
          <div className="space-y-6">
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Spectator Name / Handle
              </label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. spectator_fan or guest_101"
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <p className="text-xs text-slate-400 mt-2">
                Spectators enjoy live video stream, turn timers, score updates, active speaker highlights, and global live chat!
              </p>
            </div>

            <button
              onClick={() => handleJoin('spectator')}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-amber-900/30 transition flex items-center justify-center gap-2 text-sm"
            >
              <Eye className="w-4 h-4" />
              Join Spectator Lounge
            </button>
          </div>
        )}

        {/* TAB 3: ADMIN / ROOM CREATOR PRE-MATCH SETUP */}
        {activeTab === 'admin' && (
          <div className="space-y-5">
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-3">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Admin Host Identifier
              </label>
              <input
                type="text"
                value={adminUsernameInput}
                onChange={(e) => setAdminUsernameInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-purple-500 rounded-lg py-2.5 px-3 text-sm text-white"
              />
            </div>

            {/* Pre-Match Player Selection & Roster Management */}
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-purple-400" />
                  Pre-Match Player Assignment
                </span>
                <span className="text-xs text-purple-400 font-mono">{preMatchRoster.length} Players Configured</span>
              </div>

              {/* Add player form */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  placeholder="Unique Username"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="sm:col-span-5 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                />
                <select
                  value={newPlayerTeam}
                  onChange={(e) => setNewPlayerTeam(e.target.value as TeamId)}
                  className="sm:col-span-3 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="team1">Team 1 (Blue)</option>
                  <option value="team2">Team 2 (Red)</option>
                </select>
                <div className="sm:col-span-3 flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="number"
                    value={newPlayerTime}
                    onChange={(e) => setNewPlayerTime(Number(e.target.value))}
                    className="w-full bg-transparent text-xs text-white focus:outline-none"
                    placeholder="Time(s)"
                  />
                  <span className="text-[10px] text-slate-400">s</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddPreMatchPlayer}
                  className="sm:col-span-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center justify-center p-1.5"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Roster List */}
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {preMatchRoster.map((player, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${player.team === 'team1' ? 'bg-blue-500' : 'bg-red-500'}`}></span>
                      <span className="font-mono text-white">@{player.username}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        player.team === 'team1' ? 'bg-blue-900/60 text-blue-300' : 'bg-red-900/60 text-red-300'
                      }`}>
                        {player.team === 'team1' ? 'Team 1' : 'Team 2'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px] font-mono">{player.personalizedTime}s turn</span>
                      <button
                        onClick={() => handleRemovePreMatchPlayer(idx)}
                        className="text-slate-500 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleJoin('admin')}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-purple-900/30 transition flex items-center justify-center gap-2 text-sm"
            >
              <Shield className="w-4 h-4" />
              Launch Match Lobby as Host
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
