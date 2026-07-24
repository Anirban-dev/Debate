import React, { useState, useEffect } from 'react';
import { PlusCircle, LogIn, Users, Shield, Clock, Plus, Trash2, ArrowRight, UserCheck, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import { TeamId } from '../types';

interface ModeSelectionStepProps {
  currentUser: { username: string; authProvider: string; avatarUrl: string };
  onEnterGame: (roomId: string) => void;
  onLogout: () => void;
}

export const ModeSelectionStep: React.FC<ModeSelectionStepProps> = ({
  currentUser,
  onEnterGame,
  onLogout
}) => {
  const [selectedMode, setSelectedMode] = useState<'choose' | 'create' | 'enter'>('choose');

  // Active rooms list for "Enter a Game"
  const [activeRoomsList, setActiveRoomsList] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [targetRoomId, setTargetRoomId] = useState('');

  // "Create a Game" Admin Form state
  const [newRoomId, setNewRoomId] = useState('');
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [team1Time, setTeam1Time] = useState(300); // 5 minutes
  const [team2Time, setTeam2Time] = useState(300); // 5 minutes
  const [warningSeconds, setWarningSeconds] = useState(10);

  // Pre-match player selection roster
  const [rosterInputUser, setRosterInputUser] = useState('');
  const [rosterInputTeam, setRosterInputTeam] = useState<TeamId>('team1');
  const [rosterInputTime, setRosterInputTime] = useState(180);
  const [registeredRoster, setRegisteredRoster] = useState<
    { username: string; team: TeamId; personalizedTime: number }[]
  >([]);

  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch active rooms list
  const fetchActiveRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await fetch('/api/rooms');
      const data = await res.json();
      if (data.rooms) {
        setActiveRoomsList(data.rooms);
      }
    } catch (err) {
      console.error('Failed to load active rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchActiveRooms();
  }, []);

  // Add user to pre-match roster
  const handleAddRosterPlayer = () => {
    const cleanName = rosterInputUser.trim().toLowerCase();
    if (!cleanName) return;

    if (registeredRoster.some(r => r.username === cleanName)) {
      setErrorMsg(`User @${cleanName} is already added to roster.`);
      return;
    }

    setRegisteredRoster([
      ...registeredRoster,
      { username: cleanName, team: rosterInputTeam, personalizedTime: Number(rosterInputTime) || 180 }
    ]);
    setRosterInputUser('');
    setErrorMsg(null);
  };

  const handleRemoveRosterPlayer = (usernameToRemove: string) => {
    setRegisteredRoster(registeredRoster.filter(r => r.username !== usernameToRemove));
  };

  // Submit "Create a Game" (Admin)
  const handleCreateGameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRoomId = (newRoomId || `room-${Date.now().toString().slice(-4)}`).trim().toLowerCase().replace(/\s+/g, '-');
    const title = newRoomTitle.trim() || `Pro Tournament (${cleanRoomId})`;

    setCreating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: cleanRoomId,
          roomTitle: title,
          adminUsername: currentUser.username,
          registeredRoster,
          team1TotalTime: team1Time,
          team2TotalTime: team2Time,
          warningThresholdSeconds: warningSeconds
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create room');

      // Room created -> launch game
      onEnterGame(cleanRoomId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Room creation failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-10 right-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-2xl w-full bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md relative z-10 space-y-6">
        
        {/* Top User Profile Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.username}
              className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 p-0.5"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">@{currentUser.username}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold uppercase">
                  {currentUser.authProvider} auth
                </span>
              </div>
              <p className="text-xs text-slate-400">Logged in & ready to join match</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition"
          >
            Switch User
          </button>
        </div>

        {/* ---------------- MODE 1: CHOOSE MAIN MODE ---------------- */}
        {selectedMode === 'choose' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Select Game Mode</h2>
              <p className="text-xs text-slate-400">
                Create a custom game room with admin controls or enter an active match as Player or Spectator.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: Create a Game (Admin) */}
              <button
                type="button"
                onClick={() => setSelectedMode('create')}
                className="group flex flex-col justify-between text-left p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-800/40 hover:border-purple-500/80 hover:shadow-xl hover:shadow-purple-950/50 transition relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30 group-hover:scale-110 transition">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white group-hover:text-purple-300 transition">
                      Create a Game
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Admin host features: Pre-match roster selection, side total time control, personalized timers & finish warnings.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                  <span>Host Admin Setup</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </button>

              {/* Option B: Enter a Game (Player / Spectator) */}
              <button
                type="button"
                onClick={() => setSelectedMode('enter')}
                className="group flex flex-col justify-between text-left p-5 rounded-2xl bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-800/40 hover:border-blue-500/80 hover:shadow-xl hover:shadow-blue-950/50 transition relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 group-hover:scale-110 transition">
                    <LogIn className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white group-hover:text-blue-300 transition">
                      Enter a Game
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Auto-detects your username: Auto redirects to Player Lobby if registered, or Spectator Lounge if not on roster.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-blue-400">
                  <span>Join Match Lobby</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ---------------- MODE 2: CREATE A GAME (ADMIN FEATURES) ---------------- */}
        {selectedMode === 'create' && (
          <form onSubmit={handleCreateGameSubmit} className="space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                <h2 className="font-bold text-lg text-white">Create a Game (Admin Host)</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMode('choose')}
                className="text-xs text-slate-400 hover:text-white"
              >
                ← Back
              </button>
            </div>

            {/* Room Basic Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Room ID Handle
                </label>
                <input
                  type="text"
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(e.target.value)}
                  placeholder="e.g. final-match-101"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Match Title
                </label>
                <input
                  type="text"
                  value={newRoomTitle}
                  onChange={(e) => setNewRoomTitle(e.target.value)}
                  placeholder="e.g. Grand Debate Tournament"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Side Total Time & Finish Time Warning Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <label className="block text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-1">
                  Team 1 (Blue) Total Time
                </label>
                <select
                  value={team1Time}
                  onChange={(e) => setTeam1Time(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2 text-xs text-white"
                >
                  <option value={180}>3 Minutes (180s)</option>
                  <option value={300}>5 Minutes (300s)</option>
                  <option value={600}>10 Minutes (600s)</option>
                  <option value={900}>15 Minutes (900s)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-red-400 uppercase tracking-wider mb-1">
                  Team 2 (Red) Total Time
                </label>
                <select
                  value={team2Time}
                  onChange={(e) => setTeam2Time(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2 text-xs text-white"
                >
                  <option value={180}>3 Minutes (180s)</option>
                  <option value={300}>5 Minutes (300s)</option>
                  <option value={600}>10 Minutes (600s)</option>
                  <option value={900}>15 Minutes (900s)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1">
                  Finish Warning (s)
                </label>
                <input
                  type="number"
                  value={warningSeconds}
                  onChange={(e) => setWarningSeconds(Number(e.target.value))}
                  placeholder="e.g. 10"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2 text-xs text-white"
                />
              </div>
            </div>

            {/* Pre-Match Player Selection using Unique Username */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Pre-Match Player Roster Selection
                </span>
                <span className="text-[11px] text-slate-400">
                  {registeredRoster.length} Players Assigned
                </span>
              </div>

              {/* Add Roster Player controls */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <input
                  type="text"
                  value={rosterInputUser}
                  onChange={(e) => setRosterInputUser(e.target.value)}
                  placeholder="Unique Username"
                  className="flex-1 min-w-[130px] bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs text-white"
                />
                <select
                  value={rosterInputTeam}
                  onChange={(e) => setRosterInputTeam(e.target.value as TeamId)}
                  className="bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2 text-xs text-white"
                >
                  <option value="team1">Team 1 (Blue)</option>
                  <option value="team2">Team 2 (Red)</option>
                </select>
                <input
                  type="number"
                  value={rosterInputTime}
                  onChange={(e) => setRosterInputTime(Number(e.target.value))}
                  placeholder="Turn s"
                  title="Personalized Player Turn Time (s)"
                  className="w-20 bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-2 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleAddRosterPlayer}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              {/* Roster Badge List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {registeredRoster.map((item) => (
                  <div
                    key={item.username}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                      item.team === 'team1'
                        ? 'bg-blue-950/40 border-blue-800/60 text-blue-200'
                        : 'bg-red-950/40 border-red-800/60 text-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-semibold truncate">@{item.username}</span>
                      <span className="text-[10px] opacity-75 font-mono">({item.personalizedTime}s turn)</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRosterPlayer(item.username)}
                      className="text-slate-400 hover:text-red-400 p-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-400 bg-red-950/60 p-2 rounded-lg border border-red-800">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={creating}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-purple-900/40 transition flex items-center justify-center gap-2 text-sm"
            >
              {creating ? 'Saving to Database...' : '🚀 Create & Launch Room as Host'}
            </button>
          </form>
        )}

        {/* ---------------- MODE 3: ENTER A GAME (AUTO REDIRECT PLAYER/SPECTATOR) ---------------- */}
        {selectedMode === 'enter' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <LogIn className="w-5 h-5 text-blue-400" />
                <h2 className="font-bold text-lg text-white">Enter a Game Room</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMode('choose')}
                className="text-xs text-slate-400 hover:text-white"
              >
                ← Back
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Enter Room ID Handle
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetRoomId}
                  onChange={(e) => setTargetRoomId(e.target.value)}
                  placeholder="Enter exact Room ID Handle"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (targetRoomId.trim()) {
                      onEnterGame(targetRoomId.trim());
                    } else {
                      setErrorMsg("Please enter a valid Room ID Handle.");
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 rounded-xl transition text-xs shadow-lg shadow-blue-900/30"
                >
                  Enter
                </button>
              </div>
            </div>

            {/* Active Lobbies List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Active Game Rooms
                </span>
                <button
                  onClick={fetchActiveRooms}
                  disabled={loadingRooms}
                  className="text-slate-400 hover:text-white p-1 transition"
                  title="Refresh Rooms"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {activeRoomsList.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 text-center bg-slate-950/40 rounded-xl">
                    No active rooms currently available. Create a new room as Host above or enter a Room ID.
                  </p>
                ) : (
                  activeRoomsList.map((room) => (
                    <div
                      key={room.roomId}
                      onClick={() => onEnterGame(room.roomId)}
                      className="group flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/60 transition cursor-pointer"
                    >
                      <div>
                        <h4 className="font-bold text-xs text-white group-hover:text-blue-300 transition">
                          {room.roomTitle}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {room.roomId} • Host: @{room.adminUsername}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                          {room.playerCount} Players
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                          {room.spectatorCount} Spectators
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl text-xs text-blue-300 flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Auto-Detection Active:</strong> Server automatically assigns your role as <strong>Team Player</strong> if your username (@{currentUser.username}) exists in the match roster, or <strong>Spectator</strong> if unlisted.
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
