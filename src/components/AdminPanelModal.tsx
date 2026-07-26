import React, { useState } from 'react';
import { MatchRoomState, TeamId, Player } from '../types';
import { Shield, X, Users, Clock, Plus, Check, UserX, Ban, Eye, UserCheck, Shuffle, ArrowUp, ArrowDown, Lock, RotateCcw } from 'lucide-react';

interface AdminPanelModalProps {
  roomState: MatchRoomState;
  onClose: () => void;
  onControlTimer: (action: "start" | "pause" | "reset" | "switch_turn" | "requeue", extra?: any) => void;
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
  const [activeTab, setActiveTab] = useState<'timers' | 'queue' | 'users' | 'danger'>('queue');

  // Time settings
  const [team1TimeInput, setTeam1TimeInput] = useState(roomState.team1TotalTime / 60);
  const [team2TimeInput, setTeam2TimeInput] = useState(roomState.team2TotalTime / 60);
  const [warningThresholdInput, setWarningThresholdInput] = useState(timer.warningThresholdSeconds);

  // Add mid-session player form state
  const [addNameInput, setAddNameInput] = useState('');
  const [addTeamInput, setAddTeamInput] = useState<TeamId>('team1');
  const [addTimeInput, setAddTimeInput] = useState(180);

  const activeSpectators = (Object.values(players) as Player[]).filter(p => p.role === 'spectator');

  const spokeList = (roomState.spokeUsernames || []).map(s => s.toLowerCase());
  const activeSpeakerId = timer.activePlayerId?.toLowerCase();

  // Roster entries
  const allRosterPlayers = React.useMemo(() => {
    const map = new Map<string, {
      username: string;
      team: TeamId;
      personalizedTime: number;
      connectedPlayer: Player | null;
      hasSpoken: boolean;
      isActive: boolean;
    }>();

    (registeredRoster || []).forEach(r => {
      const lower = r.username.toLowerCase();
      const connected = players[lower] || players[r.username] || null;
      map.set(lower, {
        username: r.username,
        team: r.team,
        personalizedTime: r.personalizedTime || 180,
        connectedPlayer: connected,
        hasSpoken: spokeList.includes(lower) || !!connected?.hasSpoken,
        isActive: lower === activeSpeakerId
      });
    });

    (Object.values(players) as Player[]).forEach(p => {
      if (p.role === 'player') {
        const lower = p.username.toLowerCase();
        if (!map.has(lower)) {
          map.set(lower, {
            username: p.username,
            team: p.team || 'team1',
            personalizedTime: p.timeLimitSeconds || 180,
            connectedPlayer: p,
            hasSpoken: spokeList.includes(lower) || !!p.hasSpoken,
            isActive: lower === activeSpeakerId
          });
        }
      }
    });

    return Array.from(map.values());
  }, [registeredRoster, players, spokeList, activeSpeakerId]);

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
    if (timer.isRunning) return;
    const currentRoster = registeredRoster || [];
    if (currentRoster.length < 2) return;

    // Filter out already spoke or active players
    const unspokenRoster = currentRoster.filter(r => {
      const u = r.username.toLowerCase();
      return !spokeList.includes(u) && u !== activeSpeakerId;
    });

    const lockedRoster = currentRoster.filter(r => {
      const u = r.username.toLowerCase();
      return spokeList.includes(u) || u === activeSpeakerId;
    });

    const team1List = unspokenRoster.filter(p => p.team === 'team1');
    const team2List = unspokenRoster.filter(p => p.team === 'team2');

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

    const shuffledUnspoken: typeof registeredRoster = [];
    const maxLen = Math.max(firstTeam.length, secondTeam.length);

    for (let i = 0; i < maxLen; i++) {
      if (i < firstTeam.length) shuffledUnspoken.push(firstTeam[i]);
      if (i < secondTeam.length) shuffledUnspoken.push(secondTeam[i]);
    }

    onAdminUpdateRoster([...lockedRoster, ...shuffledUnspoken]);
  };

  const handleMovePlayerInRoster = (username: string, direction: 'up' | 'down') => {
    if (timer.isRunning) return;
    const currentRoster = [...(registeredRoster || [])];
    const index = currentRoster.findIndex(r => r.username.toLowerCase() === username.toLowerCase());
    if (index === -1) return;

    const targetUser = currentRoster[index].username.toLowerCase();
    if (spokeList.includes(targetUser) || targetUser === activeSpeakerId) {
      return; // Locked
    }

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= currentRoster.length) return;

    const swapUser = currentRoster[swapIndex].username.toLowerCase();
    if (spokeList.includes(swapUser) || swapUser === activeSpeakerId) {
      return; // Cannot swap into locked position
    }

    [currentRoster[index], currentRoster[swapIndex]] = [currentRoster[swapIndex], currentRoster[index]];
    onAdminUpdateRoster(currentRoster);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-purple-800/60 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Admin Match Control Suite</h2>
                {isPersonalLobby && (
                  <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-mono">
                    Personal Lobby
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Streamlined controls for timer, queue order & participants</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-950/80 border-b border-slate-800 px-4 pt-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-2 rounded-t-lg border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'border-purple-500 text-purple-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Speaking Queue</span>
          </button>

          <button
            onClick={() => setActiveTab('timers')}
            className={`px-3 py-2 rounded-t-lg border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'timers'
                ? 'border-purple-500 text-purple-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Timer & Allocation</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-2 rounded-t-lg border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'border-purple-500 text-purple-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Players & Spectators ({activeSpectators.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('danger')}
            className={`px-3 py-2 rounded-t-lg border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'danger'
                ? 'border-red-500 text-red-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Blacklist & Room</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: SPEAKING QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5 text-purple-400" />
                    Queue Controls
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {timer.isRunning ? "⚠️ Queue reordering locked during active turn. Pause match to reorder." : "Reorder waiting players. Active speaker & completed turns are locked."}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onControlTimer('requeue')}
                    className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/80 font-bold text-xs rounded-lg transition flex items-center gap-1"
                    title="Reset spoke status and re-queue all debaters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Re-queue All
                  </button>

                  <button
                    disabled={timer.isRunning}
                    onClick={handleRandomizeAlternatingOrder}
                    className={`px-3 py-1.5 font-bold text-xs rounded-lg transition flex items-center gap-1 ${
                      timer.isRunning
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'
                    }`}
                  >
                    <Shuffle className="w-3.5 h-3.5" /> Alternate Order
                  </button>
                </div>
              </div>

              {/* Roster Queue Items */}
              <div className="space-y-2">
                {allRosterPlayers.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center bg-slate-950 rounded-xl border border-slate-800">No players registered in speaking queue.</p>
                ) : (
                  allRosterPlayers.map((item, idx) => {
                    const isLocked = timer.isRunning || item.hasSpoken || item.isActive;

                    return (
                      <div
                        key={item.username}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
                          item.isActive
                            ? 'bg-purple-950/80 border-purple-500 shadow-lg shadow-purple-950/50'
                            : item.hasSpoken
                            ? 'bg-slate-950/60 border-slate-800/80 opacity-70'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] text-slate-500 w-4 font-bold">#{idx + 1}</span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            item.team === 'team1' ? 'bg-blue-500' : 'bg-red-500'
                          }`}></span>
                          <span className="font-bold text-white font-mono truncate">@{item.username}</span>

                          {item.isActive ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-900 text-purple-200 border border-purple-600 text-[10px] font-extrabold flex items-center gap-1">
                              🎙️ Active
                            </span>
                          ) : item.hasSpoken ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold flex items-center gap-1">
                              ✅ Spoke
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-700 text-[10px] font-medium">
                              ⏳ Waiting
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-mono text-slate-400">
                            {item.personalizedTime}s
                          </span>

                          {/* Reorder Buttons */}
                          <div className="flex items-center gap-0.5 border border-slate-800 rounded bg-slate-900 p-0.5">
                            {isLocked ? (
                              <span className="p-1 text-slate-600" title="Order locked (Spoke / Active / Session Running)">
                                <Lock className="w-3 h-3" />
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleMovePlayerInRoster(item.username, 'up')}
                                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMovePlayerInRoster(item.username, 'down')}
                                  className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TIMER & ALLOCATION SETTINGS */}
          {activeTab === 'timers' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Equal Time Share Allocation
                </h3>
                <p className="text-xs text-slate-400">
                  Total team duration is divided mathematically and equally among all registered players in each team.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Team 1 Total Time (Mins)</label>
                    <input
                      type="number"
                      value={team1TimeInput}
                      onChange={(e) => setTeam1TimeInput(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Team 2 Total Time (Mins)</label>
                    <input
                      type="number"
                      value={team2TimeInput}
                      onChange={(e) => setTeam2TimeInput(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Warning Threshold (Secs)</label>
                    <input
                      type="number"
                      value={warningThresholdInput}
                      onChange={(e) => setWarningThresholdInput(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-amber-300 font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={handleApplyGlobalTimeSettings}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Recalculate Equal Shares & Apply Timers
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: PLAYERS & SPECTATORS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Add player */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-200 block">➕ Add Player Mid-Session</span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    placeholder="Username"
                    value={addNameInput}
                    onChange={(e) => setAddNameInput(e.target.value)}
                    className="sm:col-span-5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <select
                    value={addTeamInput}
                    onChange={(e) => setAddTeamInput(e.target.value as TeamId)}
                    className="sm:col-span-3 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    <option value="team1">Team 1 (Blue)</option>
                    <option value="team2">Team 2 (Red)</option>
                  </select>
                  <button
                    onClick={handleAddPlayerMidSession}
                    className="sm:col-span-4 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Register Player
                  </button>
                </div>
              </div>

              {/* Connected Spectators */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Connected Spectators ({activeSpectators.length})
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {activeSpectators.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-1">No spectators in room.</p>
                  ) : (
                    activeSpectators.map((spec) => (
                      <div key={spec.username} className="bg-slate-900 p-2 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-bold text-white font-mono">@{spec.username}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onAdminUpdatePlayer(spec.username, { role: 'player', team: 'team1' })}
                            className="px-2 py-0.5 bg-blue-900 text-blue-200 text-[10px] font-bold rounded border border-blue-700"
                          >
                            + Team 1
                          </button>
                          <button
                            onClick={() => onAdminUpdatePlayer(spec.username, { role: 'player', team: 'team2' })}
                            className="px-2 py-0.5 bg-red-900 text-red-200 text-[10px] font-bold rounded border border-red-700"
                          >
                            + Team 2
                          </button>
                          <button
                            onClick={() => onAdminKickUser(spec.username)}
                            className="p-1 bg-slate-800 hover:bg-red-900 text-slate-300 rounded"
                            title="Kick"
                          >
                            <UserX className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BLACKLIST & ROOM DESTRUCTION */}
          {activeTab === 'danger' && (
            <div className="space-y-4">
              {/* Banned Users */}
              <div className="bg-slate-950 p-3 rounded-xl border border-red-900/40 space-y-2">
                <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5" /> Banned Blacklist ({roomState.bannedUsernames?.length || 0})
                </span>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {(!roomState.bannedUsernames || roomState.bannedUsernames.length === 0) ? (
                    <p className="text-xs text-slate-500 italic py-1">No users currently banned.</p>
                  ) : (
                    roomState.bannedUsernames.map((bannedUser) => (
                      <div key={bannedUser} className="bg-slate-900 p-2 rounded-lg border border-red-900/40 flex items-center justify-between text-xs">
                        <span className="font-bold text-white font-mono">@{bannedUser}</span>
                        {onAdminUnbanUser && (
                          <button
                            onClick={() => onAdminUnbanUser(bannedUser)}
                            className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 rounded text-[10px] font-bold flex items-center gap-1"
                          >
                            <UserCheck className="w-3 h-3" /> Unban
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* End session */}
              <div className="bg-red-950/40 p-3 rounded-xl border border-red-900/60 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-red-300">🛑 Destroy Lobby & End Session</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Disconnects all users and deletes room memory.</p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to end this match session and destroy the room? All participants will be disconnected.')) {
                      onAdminEndSession();
                    }
                  }}
                  className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow transition shrink-0"
                >
                  End Room
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
