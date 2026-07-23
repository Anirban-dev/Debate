import React from 'react';
import { MatchRoomState, Player, TeamId } from '../types';
import { Play, Pause, RotateCcw, Shield, Eye, Users, Volume2, VolumeX, AlertTriangle, Settings, LogOut, Clock, Sparkles } from 'lucide-react';

interface LobbyHeaderProps {
  roomState: MatchRoomState;
  currentUser: Player | null;
  onControlTimer: (action: "start" | "pause" | "reset" | "switch_turn", extra?: any) => void;
  onOpenAdminPanel: () => void;
  onLeaveRoom: () => void;
}

export const LobbyHeader: React.FC<LobbyHeaderProps> = ({
  roomState,
  currentUser,
  onControlTimer,
  onOpenAdminPanel,
  onLeaveRoom
}) => {
  const { timer, spectatorCount } = roomState;

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activePlayer = timer.activePlayerId ? roomState.players[timer.activePlayerId] : null;

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-xl">
      {/* Top Banner: Title & User Badge */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: App Brand & Room Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-900/30 font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {roomState.roomTitle}
              </h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>Room ID: <span className="font-mono text-slate-300">{roomState.roomId}</span></span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-400">
                <Eye className="w-3.5 h-3.5" />
                {spectatorCount} Spectators Watching
              </span>
            </p>
          </div>
        </div>

        {/* Center: Live Timer Clock Section */}
        <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800 shadow-inner">
          {/* Team 1 Clock */}
          <div className={`text-center px-2 py-1 rounded-lg ${timer.activeTeam === 'team1' ? 'bg-blue-950/60 border border-blue-800/80' : ''}`}>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-400 block">Team 1</span>
            <span className="text-sm sm:text-base font-mono font-bold text-blue-200">
              {formatTime(timer.team1TimeRemaining)}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-800"></div>

          {/* Turn Countdown Clock */}
          <div className={`text-center px-3 py-1 rounded-lg transition-all ${
            timer.isWarningActive
              ? 'bg-amber-950/80 border border-amber-600 animate-pulse text-amber-300'
              : timer.autoMutedTriggered
              ? 'bg-red-950/80 border border-red-600 text-red-300'
              : 'bg-slate-900 border border-slate-800 text-white'
          }`}>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Turn Clock
            </span>
            <span className="text-lg sm:text-xl font-mono font-black tracking-wider">
              {formatTime(timer.turnTimeRemaining)}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-800"></div>

          {/* Team 2 Clock */}
          <div className={`text-center px-2 py-1 rounded-lg ${timer.activeTeam === 'team2' ? 'bg-red-950/60 border border-red-800/80' : ''}`}>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-red-400 block">Team 2</span>
            <span className="text-sm sm:text-base font-mono font-bold text-red-200">
              {formatTime(timer.team2TimeRemaining)}
            </span>
          </div>
        </div>

        {/* Right: Current User Role & Logout */}
        <div className="flex items-center gap-2">
          {currentUser && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
              currentUser.role === 'admin'
                ? 'bg-purple-950/50 border-purple-800 text-purple-300'
                : currentUser.role === 'player'
                ? currentUser.team === 'team1'
                  ? 'bg-blue-950/50 border-blue-800 text-blue-300'
                  : 'bg-red-950/50 border-red-800 text-red-300'
                : 'bg-amber-950/50 border-amber-800 text-amber-300'
            }`}>
              {currentUser.role === 'admin' ? <Shield className="w-3.5 h-3.5" /> : currentUser.role === 'player' ? <Users className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>@{currentUser.username}</span>
              <span className="opacity-75 uppercase text-[10px] font-mono">({currentUser.role})</span>
            </div>
          )}

          {currentUser?.role === 'admin' && (
            <button
              onClick={onOpenAdminPanel}
              className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition shadow-md shadow-purple-950/50"
              title="Admin Match Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onLeaveRoom}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
            title="Leave / Change Role"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Admin Quick Timer Control Sub-Bar */}
      {currentUser?.role === 'admin' && (
        <div className="bg-slate-950/90 border-t border-slate-800/80 py-2 px-4">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-purple-400 font-semibold uppercase text-[10px] tracking-wider flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Admin Timer Master
              </span>

              {/* Play / Pause */}
              {timer.isRunning ? (
                <button
                  onClick={() => onControlTimer('pause')}
                  className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-md font-medium transition"
                >
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
              ) : (
                <button
                  onClick={() => onControlTimer('start')}
                  className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium transition"
                >
                  <Play className="w-3.5 h-3.5" /> Start Timer
                </button>
              )}

              {/* Reset */}
              <button
                onClick={() => onControlTimer('reset')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>

              {/* Active Side Switcher */}
              <div className="flex items-center gap-1 ml-2 bg-slate-900 p-0.5 rounded-md border border-slate-800">
                <button
                  onClick={() => onControlTimer('switch_turn', { activeTeam: 'team1' })}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                    timer.activeTeam === 'team1' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Team 1 Turn
                </button>
                <button
                  onClick={() => onControlTimer('switch_turn', { activeTeam: 'team2' })}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                    timer.activeTeam === 'team2' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Team 2 Turn
                </button>
              </div>
            </div>

            {/* Active Speaker Selection */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-[11px]">Active Speaker:</span>
              <select
                value={timer.activePlayerId || ''}
                onChange={(e) => onControlTimer('switch_turn', { activePlayerId: e.target.value })}
                className="bg-slate-900 border border-slate-700 rounded-md text-xs text-white px-2 py-1 focus:outline-none"
              >
                <option value="">-- None Selected --</option>
                {Object.values(roomState.players)
                  .filter(p => p.role === 'player')
                  .map(p => (
                    <option key={p.username} value={p.username}>
                      @{p.username} ({p.team === 'team1' ? 'Team 1' : 'Team 2'})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Warning & Auto-Mute Live Ticker Banners */}
      {timer.autoMutedTriggered && (
        <div className="bg-red-600 text-white py-1.5 px-4 text-center text-xs font-bold flex items-center justify-center gap-2 animate-bounce">
          <VolumeX className="w-4 h-4" />
          <span>TIME OUT TRIGGERED! Active speaker has been automatically muted by server timer rule.</span>
        </div>
      )}

      {timer.isWarningActive && !timer.autoMutedTriggered && (
        <div className="bg-amber-500 text-slate-950 py-1.5 px-4 text-center text-xs font-bold flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>FINISH TIME WARNING: Under {timer.warningThresholdSeconds} seconds remaining for speaker turn!</span>
        </div>
      )}
    </header>
  );
};
