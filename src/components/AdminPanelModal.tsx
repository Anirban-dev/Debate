import React, { useState } from 'react';
import { MatchRoomState, TeamId, PlayerRole, Player } from '../types';
import { Shield, X, Users, Clock, AlertTriangle, Plus, Trash2, VolumeX, VideoOff, Check, RotateCcw } from 'lucide-react';

interface AdminPanelModalProps {
  roomState: MatchRoomState;
  onClose: () => void;
  onControlTimer: (action: "start" | "pause" | "reset" | "switch_turn", extra?: any) => void;
  onAdminUpdatePlayer: (targetUsername: string, updates: any) => void;
  onAdminUpdateRoster: (roster: { username: string; team: TeamId; personalizedTime?: number }[]) => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  roomState,
  onClose,
  onControlTimer,
  onAdminUpdatePlayer,
  onAdminUpdateRoster
}) => {
  const { timer, players, registeredRoster } = roomState;

  // Time limit controls state
  const [team1TimeInput, setTeam1TimeInput] = useState(roomState.team1TotalTime / 60);
  const [team2TimeInput, setTeam2TimeInput] = useState(roomState.team2TotalTime / 60);
  const [warningThresholdInput, setWarningThresholdInput] = useState(timer.warningThresholdSeconds);

  // New mid-session player form state
  const [addNameInput, setAddNameInput] = useState('');
  const [addTeamInput, setAddTeamInput] = useState<TeamId>('team1');
  const [addTimeInput, setAddTimeInput] = useState(180);

  const handleApplyGlobalTimeSettings = () => {
    onControlTimer('reset', {
      team1Time: team1TimeInput * 60,
      team2Time: team2TimeInput * 60,
      warningSeconds: warningThresholdInput
    });
    alert('Match timer settings updated!');
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
      <div className="bg-slate-900 border border-purple-800/60 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-slate-100 space-y-6 relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Admin Match Control Suite</h2>
              <p className="text-xs text-slate-400">Mid-session player edits, side times, turn limits & force controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SECTION 1: SIDE TOTAL TIME & FINISH WARNING CONTROLS */}
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

        {/* SECTION 2: MID-SESSION PLAYER EDIT & TIME PERSONALIZATION */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Mid-Session Player Roster & Personal Limits
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

          {/* Active Connected Players List */}
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {(Object.values(players) as Player[]).map((player) => (
              <div
                key={player.username}
                className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    player.team === 'team1' ? 'bg-blue-500' : player.team === 'team2' ? 'bg-red-500' : 'bg-amber-500'
                  }`}></span>
                  <span className="font-bold text-white font-mono">@{player.username}</span>
                  <span className="text-[10px] uppercase font-mono text-slate-400">({player.role})</span>
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

                  {/* Personal Turn Duration */}
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
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
