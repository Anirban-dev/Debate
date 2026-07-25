import React, { useState } from 'react';
import { MatchRoomState, TeamId, Player } from '../types';
import { Shield, X, Users, Clock, Plus, VolumeX, VideoOff, Check, UserX, Ban, Eye, UserCheck, Shuffle, ArrowUp, ArrowDown } from 'lucide-react';

interface AdminPanelModalProps {
  roomState: MatchRoomState;
  onClose: () => void;
  onControlTimer: (action: "start" | "pause" | "reset" | "switch_turn", extra?: any) => void;
  onAdminUpdatePlayer: (targetUsername: string, updates: Partial<Player>) => void;
  onAdminUpdateRoster: (roster: { username: string; team: TeamId; personalizedTime?: number }[]) => void;
  onAdminKickUser: (targetUsername: string) => void;
  onAdminBanUser: (targetUsername: string) => void;
  onAdminUnbanUser?: (targetUsername: string) => void;
  onAdminEndSession: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  roomState,
  onClose,
  onControlTimer,
  onAdminUpdatePlayer,
  onAdminUpdateRoster,
  onAdminKickUser,
  onAdminBanUser,
  onAdminUnbanUser,
  onAdminEndSession
}) => {
  const { timer, players, registeredRoster, isPersonalLobby } = roomState;

  // Time limit controls state
  const [team1TimeInput, setTeam1TimeInput] = useState(roomState.team1TotalTime / 60);
  const [team2TimeInput, setTeam2TimeInput] = useState(roomState.team2TotalTime / 60);
  const [warningThresholdInput, setWarningThresholdInput] = useState(timer.warningThresholdSeconds);

  // New mid-session player form state
  const [addNameInput, setAddNameInput] = useState('');
  const [addTeamInput, setAddTeamInput] = useState<TeamId>('team1');
  const [addTimeInput, setAddTimeInput] = useState(180);

  const activeSpectators = (Object.values(players) as Player[]).filter(p => p.role === 'spectator');

  // Unified Roster List (Registered + Connected Players)
  const allRosterPlayers = React.useMemo(() => {
    const map = new Map<string, {
      username: string;
      team: TeamId;
      personalizedTime: number;
      connectedPlayer: Player | null;
    }>();

    // 1. Add all from registeredRoster
    (registeredRoster || []).forEach(r => {
      const lower = r.username.toLowerCase();
      map.set(lower, {
        username: r.username,
        team: r.team,
        personalizedTime: r.personalizedTime || 180,
        connectedPlayer: players[lower] || players[r.username] || null
      });
    });

    // 2. Add connected players who have role === 'player'
    (Object.values(players) as Player[]).forEach(p => {
      if (p.role === 'player') {
        const lower = p.username.toLowerCase();
        if (!map.has(lower)) {
          map.set(lower, {
            username: p.username,
            team: p.team || 'team1',
            personalizedTime: p.timeLimitSeconds || 180,
            connectedPlayer: p
          });
        } else {
          map.get(lower)!.connectedPlayer = p;
        }
      }
    });

    return Array.from(map.values());
  }, [registeredRoster, players]);

  const handleApplyGlobalTimeSettings = () => {
    onControlTimer('reset', {
      team1Time: team1TimeInput * 60,
      team2Time: team2TimeInput * 60,
      warningSeconds: warningThresholdInput
    });
  };

  const handleAddPlayerMidSession = () => {
    const username = addNameInput.trim().toLowerCase();
    if (!username) return;

    const newRoster = [...registeredRoster, { username, team: addTeamInput, personalizedTime: addTimeInput }];
    onAdminUpdateRoster(newRoster);

    // If player already connected, update them directly
    if (players[username]) {
      onAdminUpdatePlayer(username, {
        role: 'player',
        team: addTeamInput,
        timeLimitSeconds: addTimeInput,
        remainingSeconds: addTimeInput
      });
    }

    setAddNameInput('');
  };

  const handleRandomizeAlternatingOrder = () => {
    const currentRoster = registeredRoster || [];
    if (currentRoster.length < 2) return;

    const team1List = currentRoster.filter(p => p.team === 'team1');
    const team2List = currentRoster.filter(p => p.team === 'team2');

    const shuffle = <T,>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const s1 = shuffle(team1List);
    const s2 = shuffle(team2List);

    const startWithTeam1 = Math.random() < 0.5;
    const firstTeam = startWithTeam1 ? s1 : s2;
    const secondTeam = startWithTeam1 ? s2 : s1;

    const newRoster: typeof registeredRoster = [];
    const maxLen = Math.max(firstTeam.length, secondTeam.length);

    for (let i = 0; i < maxLen; i++) {
      if (i < firstTeam.length) newRoster.push(firstTeam[i]);
      if (i < secondTeam.length) newRoster.push(secondTeam[i]);
    }

    onAdminUpdateRoster(newRoster);
  };

  const handleMovePlayerInRoster = (username: string, direction: 'up' | 'down') => {
    const currentRoster = [...(registeredRoster || [])];
    const index = currentRoster.findIndex(r => r.username.toLowerCase() === username.toLowerCase());
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [currentRoster[index - 1], currentRoster[index]] = [currentRoster[index], currentRoster[index - 1]];
    } else if (direction === 'down' && index < currentRoster.length - 1) {
      [currentRoster[index + 1], currentRoster[index]] = [currentRoster[index], currentRoster[index + 1]];
    }
    onAdminUpdateRoster(currentRoster);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-purple-800/60 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-slate-100 space-y-6 relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Admin Match Control Suite</h2>
                {isPersonalLobby && (
                  <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-mono">
                    Personal Lobby Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Mid-session player & spectator management, kicks, bans & timer controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SECTION 1: GLOBAL SIDE TIMERS & FINISH WARNING */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Global Side Timers & Warning Control
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Team 1 Total Time (Mins)</label>
              <input
                type="number"
                value={team1TimeInput}
                onChange={(e) => setTeam1TimeInput(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Team 2 Total Time (Mins)</label>
              <input
                type="number"
                value={team2TimeInput}
                onChange={(e) => setTeam2TimeInput(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Finish Time Warning (Secs)</label>
              <input
                type="number"
                value={warningThresholdInput}
                onChange={(e) => setWarningThresholdInput(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-amber-300"
              />
            </div>
          </div>

          <button
            onClick={handleApplyGlobalTimeSettings}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Apply Timer Settings & Reset Clocks
          </button>
        </div>

        {/* SECTION 2: ACTIVE PLAYER MANAGEMENT & MID-SESSION EDIT */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Registered Roster & Active Players ({allRosterPlayers.filter(p => p.connectedPlayer).length}/{allRosterPlayers.length} Online)
            </span>
            <span className="text-[10px] text-slate-500">Offline users greyed out &bull; Admin controls activate upon entry</span>
          </h3>

          {/* Quick Add Mid-Session */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              placeholder="Username"
              value={addNameInput}
              onChange={(e) => setAddNameInput(e.target.value)}
              className="sm:col-span-4 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
            <select
              value={addTeamInput}
              onChange={(e) => setAddTeamInput(e.target.value as TeamId)}
              className="sm:col-span-3 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
            >
              <option value="team1">Team 1 (Blue)</option>
              <option value="team2">Team 2 (Red)</option>
            </select>
            <input
              type="number"
              placeholder="Turn Time (s)"
              value={addTimeInput}
              onChange={(e) => setAddTimeInput(Number(e.target.value))}
              className="sm:col-span-3 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
            />
            <button
              onClick={handleAddPlayerMidSession}
              className="sm:col-span-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {/* Turn Order Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-purple-950/30 border border-purple-800/40 p-2.5 rounded-xl">
            <div className="text-xs">
              <span className="font-bold text-purple-300 flex items-center gap-1">
                <Shuffle className="w-3.5 h-3.5" /> Organize Speaking Order
              </span>
              <p className="text-[10px] text-slate-400">Set turn sequence or automatically alternate teams.</p>
            </div>

            <button
              onClick={handleRandomizeAlternatingOrder}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-lg shadow-md transition flex items-center gap-1.5 shrink-0"
              title="Randomly shuffle roster while strictly alternating Team 1 and Team 2"
            >
              <Shuffle className="w-3.5 h-3.5" /> Randomize Alternating Order
            </button>
          </div>

          {/* Roster & Connected Players List */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {allRosterPlayers.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">No players registered or connected.</p>
            ) : (
              allRosterPlayers.map((item) => {
                const player = item.connectedPlayer;
                const isOnline = !!player;
                const currentTeam = player?.team || item.team;
                const currentTurnTime = player?.timeLimitSeconds || item.personalizedTime;

                return (
                  <div
                    key={item.username}
                    className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs transition ${
                      isOnline
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-slate-950/70 border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        !isOnline
                          ? 'bg-slate-600'
                          : currentTeam === 'team1'
                          ? 'bg-blue-500 animate-pulse'
                          : 'bg-red-500 animate-pulse'
                      }`}></span>
                      <span className={`font-bold font-mono ${isOnline ? 'text-white' : 'text-slate-400'}`}>
                        @{item.username}
                      </span>
                      {isOnline ? (
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded font-mono font-semibold">
                          🟢 Online
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-900 text-slate-500 border border-slate-800 px-1.5 py-0.2 rounded font-mono">
                          🔴 Not Connected
                        </span>
                      )}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                      {/* Reorder Position */}
                      <div className="flex items-center gap-0.5 border border-slate-800 rounded bg-slate-950 p-0.5">
                        <button
                          type="button"
                          onClick={() => handleMovePlayerInRoster(item.username, 'up')}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                          title="Move Up in Turn Order"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMovePlayerInRoster(item.username, 'down')}
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                          title="Move Down in Turn Order"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Team Reassignment */}
                      <select
                        value={currentTeam}
                        disabled={!isOnline}
                        onChange={(e) => isOnline && onAdminUpdatePlayer(item.username, { team: e.target.value as TeamId })}
                        className={`border rounded px-1.5 py-1 text-[11px] ${
                          isOnline
                            ? 'bg-slate-950 text-white border-slate-700'
                            : 'bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
                        }`}
                        title={isOnline ? "Reassign Team" : "Admin powers activate once user enters room"}
                      >
                        <option value="team1">Team 1 (Blue)</option>
                        <option value="team2">Team 2 (Red)</option>
                      </select>

                      {/* Turn Time (s) */}
                      <input
                        type="number"
                        value={currentTurnTime}
                        disabled={!isOnline}
                        onChange={(e) => isOnline && onAdminUpdatePlayer(item.username, { timeLimitSeconds: Number(e.target.value), remainingSeconds: Number(e.target.value) })}
                        className={`w-16 border rounded px-1.5 py-1 text-[11px] font-mono ${
                          isOnline
                            ? 'bg-slate-950 text-white border-slate-700'
                            : 'bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
                        }`}
                        title={isOnline ? "Personalized Turn Time (s)" : "Admin powers activate once user enters room"}
                      />

                      {/* Force Mute */}
                      <button
                        disabled={!isOnline}
                        onClick={() => isOnline && onAdminUpdatePlayer(item.username, { isMutedByAdmin: !player?.isMutedByAdmin })}
                        className={`p-1.5 rounded transition ${
                          !isOnline
                            ? 'bg-slate-950 text-slate-700 border border-slate-800/80 cursor-not-allowed opacity-40'
                            : player?.isMutedByAdmin
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title={isOnline ? "Force Admin Mute" : "Admin powers activate once user enters room"}
                      >
                        <VolumeX className="w-3.5 h-3.5" />
                      </button>

                      {/* Force Video Off */}
                      <button
                        disabled={!isOnline}
                        onClick={() => isOnline && onAdminUpdatePlayer(item.username, { isVideoOffByAdmin: !player?.isVideoOffByAdmin })}
                        className={`p-1.5 rounded transition ${
                          !isOnline
                            ? 'bg-slate-950 text-slate-700 border border-slate-800/80 cursor-not-allowed opacity-40'
                            : player?.isVideoOffByAdmin
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title={isOnline ? "Force Video Off" : "Admin powers activate once user enters room"}
                      >
                        <VideoOff className="w-3.5 h-3.5" />
                      </button>

                      {/* Kick Player */}
                      <button
                        disabled={!isOnline}
                        onClick={() => isOnline && onAdminKickUser(item.username)}
                        className={`p-1.5 rounded transition ${
                          !isOnline
                            ? 'bg-slate-950 text-slate-700 border border-slate-800/80 cursor-not-allowed opacity-40'
                            : 'bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-red-200'
                        }`}
                        title={isOnline ? "Kick Player from Lobby" : "Admin powers activate once user enters room"}
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>

                      {/* Ban Player */}
                      <button
                        disabled={!isOnline}
                        onClick={() => isOnline && onAdminBanUser(item.username)}
                        className={`p-1.5 rounded transition ${
                          !isOnline
                            ? 'bg-slate-950 text-slate-700 border border-slate-800/80 cursor-not-allowed opacity-40'
                            : 'bg-red-950 hover:bg-red-900 text-red-400 hover:text-red-100 border border-red-800'
                        }`}
                        title={isOnline ? "Ban Player from Lobby" : "Admin powers activate once user enters room"}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SECTION 3: SPECTATORS LIST & ADMIN SPECTATOR CONTROLS */}
        <div className="bg-slate-950 p-4 rounded-xl border border-amber-900/40 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Eye className="w-4 h-4" /> Connected Spectator Roster ({activeSpectators.length})</span>
            <span className="text-[10px] text-slate-500">No cam/mic permissions &bull; Promote, Kick or Ban</span>
          </h3>

          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {activeSpectators.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">No spectators currently in the lounge.</p>
            ) : (
              activeSpectators.map((spectator) => (
                <div
                  key={spectator.username}
                  className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="font-bold text-white font-mono">@{spectator.username}</span>
                    <span className="text-[10px] text-slate-500">(Spectator)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Promote to Team 1 */}
                    <button
                      onClick={() => onAdminUpdatePlayer(spectator.username, { role: 'player', team: 'team1' })}
                      className="px-2 py-1 bg-blue-900/80 hover:bg-blue-800 text-blue-200 text-[11px] font-bold rounded border border-blue-700"
                    >
                      + Team 1
                    </button>

                    {/* Promote to Team 2 */}
                    <button
                      onClick={() => onAdminUpdatePlayer(spectator.username, { role: 'player', team: 'team2' })}
                      className="px-2 py-1 bg-red-900/80 hover:bg-red-800 text-red-200 text-[11px] font-bold rounded border border-red-700"
                    >
                      + Team 2
                    </button>

                    {/* Kick Spectator */}
                    <button
                      onClick={() => onAdminKickUser(spectator.username)}
                      className="p-1.5 bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-red-200 rounded transition"
                      title="Kick Spectator"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>

                    {/* Ban Spectator */}
                    <button
                      onClick={() => onAdminBanUser(spectator.username)}
                      className="p-1.5 bg-red-950 hover:bg-red-900 text-red-400 hover:text-red-100 rounded border border-red-800 transition"
                      title="Ban Spectator"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION 4: BANNED USERS LIST & UNBAN CONTROL */}
        <div className="bg-slate-950 p-4 rounded-xl border border-red-900/40 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Ban className="w-4 h-4 text-red-500" /> Banned Users Blacklist ({roomState.bannedUsernames?.length || 0})</span>
            <span className="text-[10px] text-slate-500">Blocked from re-entering lobby &bull; Admin can unban</span>
          </h3>

          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {(!roomState.bannedUsernames || roomState.bannedUsernames.length === 0) ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">No users currently banned from this lobby.</p>
            ) : (
              roomState.bannedUsernames.map((bannedUser) => {
                const isRosterPlayer = roomState.registeredRoster?.find(
                  r => r.username.toLowerCase() === bannedUser.toLowerCase()
                );

                return (
                  <div
                    key={bannedUser}
                    className="bg-slate-900 p-2.5 rounded-xl border border-red-900/40 flex items-center justify-between gap-2 text-xs shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                      <span className="font-bold text-white font-mono">@{bannedUser}</span>
                      
                      {isRosterPlayer ? (
                        <span className={`text-[10px] border px-1.5 py-0.5 rounded font-bold uppercase ${
                          isRosterPlayer.team === 'team1'
                            ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                            : 'bg-red-950/80 text-red-300 border-red-800'
                        }`}>
                          🎮 Player ({isRosterPlayer.team === 'team1' ? 'Team 1' : 'Team 2'})
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/80 px-1.5 py-0.5 rounded font-bold uppercase">
                          👁️ Spectator / Viewer
                        </span>
                      )}
                      
                      <span className="text-[9px] bg-red-950 text-red-400 border border-red-900 px-1 py-0.2 rounded font-mono">
                        Banned
                      </span>
                    </div>

                    {onAdminUnbanUser && (
                      <button
                        onClick={() => onAdminUnbanUser(bannedUser)}
                        className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/80 rounded text-[11px] font-bold transition flex items-center gap-1 shrink-0"
                        title="Lift Ban and Allow Re-entry to Lobby"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Unban User
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SECTION 5: DESTRUCTIVE / SESSION TERMINATION */}
        <div className="bg-red-950/40 p-4 rounded-xl border border-red-900/60 flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-red-300 flex items-center gap-1.5">
              🛑 End Session & Destroy Lobby
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Permanently ends this match session, evicts all participants, and completely deletes the room state from temporary memory. No persistent traces will remain.
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to end this match session and destroy the room? All participants will be disconnected.')) {
                onAdminEndSession();
              }
            }}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/80 transition flex items-center gap-2 shrink-0"
          >
            <Ban className="w-4 h-4" /> End & Destroy Room
          </button>
        </div>
      </div>
    </div>
  );
};
