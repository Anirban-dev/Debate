import React, { useState } from 'react';
import { MatchRoomState, TeamId, Player } from '../types';
import { Shield, X, Users, Clock, Plus, VolumeX, VideoOff, Check, UserX, Ban, Eye, UserCheck } from 'lucide-react';

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

  const activePlayers = (Object.values(players) as Player[]).filter(p => p.role === 'player');
  const activeSpectators = (Object.values(players) as Player[]).filter(p => p.role === 'spectator');

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
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Active Player Roster ({activePlayers.length})</span>
            <span className="text-[10px] text-slate-500">Edit side, turn limit, mute, kick & ban</span>
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

          {/* Connected Players List */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {activePlayers.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">No active players connected.</p>
            ) : (
              activePlayers.map((player) => (
                <div
                  key={player.username}
                  className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      player.team === 'team1' ? 'bg-blue-500' : 'bg-red-500'
                    }`}></span>
                    <span className="font-bold text-white font-mono">@{player.username}</span>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2">
                    {/* Team Reassignment */}
                    <select
                      value={player.team || 'team1'}
                      onChange={(e) => onAdminUpdatePlayer(player.username, { team: e.target.value as TeamId })}
                      className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-white"
                    >
                      <option value="team1">Team 1</option>
                      <option value="team2">Team 2</option>
                    </select>

                    {/* Turn Time (s) */}
                    <input
                      type="number"
                      value={player.timeLimitSeconds}
                      onChange={(e) => onAdminUpdatePlayer(player.username, { timeLimitSeconds: Number(e.target.value), remainingSeconds: Number(e.target.value) })}
                      className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-white font-mono"
                      title="Personalized Turn Time (s)"
                    />

                    {/* Force Mute */}
                    <button
                      onClick={() => onAdminUpdatePlayer(player.username, { isMutedByAdmin: !player.isMutedByAdmin })}
                      className={`p-1.5 rounded transition ${
                        player.isMutedByAdmin ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                      title="Force Admin Mute"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                    </button>

                    {/* Force Video Off */}
                    <button
                      onClick={() => onAdminUpdatePlayer(player.username, { isVideoOffByAdmin: !player.isVideoOffByAdmin })}
                      className={`p-1.5 rounded transition ${
                        player.isVideoOffByAdmin ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                      title="Force Video Off"
                    >
                      <VideoOff className="w-3.5 h-3.5" />
                    </button>

                    {/* Kick Player */}
                    <button
                      onClick={() => onAdminKickUser(player.username)}
                      className="p-1.5 bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-red-200 rounded transition"
                      title="Kick Player from Lobby"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>

                    {/* Ban Player */}
                    <button
                      onClick={() => onAdminBanUser(player.username)}
                      className="p-1.5 bg-red-950 hover:bg-red-900 text-red-400 hover:text-red-100 rounded border border-red-800 transition"
                      title="Ban Player from Lobby"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
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
