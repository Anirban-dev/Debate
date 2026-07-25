import { Server as ServerIO } from 'socket.io';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as NetServer } from 'http';
import { activeRooms, createDefaultRoomState } from '@/lib/socketStore';
import { ChatMessage, MatchRoomState, Player, TeamId } from '@/types';

export const config = {
  api: {
    bodyParser: false,
  },
};

declare global {
  var socketIoInstance: ServerIO | undefined;
  var timerInterval: NodeJS.Timeout | undefined;
}

function updateSpectatorCount(roomState: MatchRoomState) {
  let count = 0;
  Object.values(roomState.players).forEach(p => {
    if (p.role === "spectator" && p.isOnline) {
      count++;
    }
  });
  roomState.spectatorCount = count;
}

function recalculateTeamEqualTime(roomState: MatchRoomState, team: TeamId) {
  const totalTeamTime = team === "team1" ? roomState.team1TotalTime : roomState.team2TotalTime;
  const teamPlayers = (Object.values(roomState.players) as Player[]).filter(
    p => p.role === "player" && p.team === team
  );
  if (teamPlayers.length === 0) return;

  // Filter for players who have NOT finished speaking yet (remainingSeconds > 0)
  const remainingPlayers = teamPlayers.filter(p => p.remainingSeconds > 0);
  const targetPlayers = remainingPlayers.length > 0 ? remainingPlayers : teamPlayers;

  // Calculate time consumed by players who have already finished speaking
  const consumedTime = teamPlayers
    .filter(p => p.remainingSeconds <= 0)
    .reduce((acc, p) => acc + (p.timeLimitSeconds || 0), 0);

  const availableTimeForRemaining = Math.max(10, totalTeamTime - consumedTime);
  const equalShare = Math.max(10, Math.floor(availableTimeForRemaining / targetPlayers.length));

  targetPlayers.forEach(p => {
    p.timeLimitSeconds = equalShare;
    p.remainingSeconds = equalShare;
  });
}

function getSanitizedRoomStateForPlayer(roomState: MatchRoomState, player: Player | null): MatchRoomState {
  const isTeam1Player = player?.role === 'player' && player?.team === 'team1';
  const isTeam2Player = player?.role === 'player' && player?.team === 'team2';

  // Allowed channels for this specific recipient:
  // Admin & Spectators ONLY get 'global' chat messages.
  // Team 1 players get 'global' + 'team1' chat messages.
  // Team 2 players get 'global' + 'team2' chat messages.
  const allowedChannels: string[] = ['global'];
  if (isTeam1Player) allowedChannels.push('team1');
  if (isTeam2Player) allowedChannels.push('team2');

  const filteredChatMessages = (roomState.chatMessages || []).filter(m => allowedChannels.includes(m.channel));

  // Sanitize secret team strategy notes so spectators, admins, and opposing teams cannot read them in WS payloads
  const defaultTeam1Note = { teamId: "team1" as const, title: 'Team 1 Notes', content: '', updatedAt: 0 };
  const defaultTeam2Note = { teamId: "team2" as const, title: 'Team 2 Notes', content: '', updatedAt: 0 };

  const team1Note = roomState.teamNotes?.team1 || defaultTeam1Note;
  const team2Note = roomState.teamNotes?.team2 || defaultTeam2Note;

  const sanitizedTeamNotes = {
    team1: isTeam1Player ? team1Note : defaultTeam1Note,
    team2: isTeam2Player ? team2Note : defaultTeam2Note
  };

  return {
    ...roomState,
    chatMessages: filteredChatMessages,
    teamNotes: sanitizedTeamNotes
  };
}

function broadcastSanitizedRoomState(io: ServerIO, roomState: MatchRoomState) {
  const roomSockets = io.sockets.adapter.rooms.get(roomState.roomId);
  if (!roomSockets) return;

  for (const socketId of roomSockets) {
    const s = io.sockets.sockets.get(socketId);
    if (s) {
      const username = (s as any).currentUsername;
      const player = username ? roomState.players[username] : null;
      const sanitized = getSanitizedRoomStateForPlayer(roomState, player);
      s.emit("room_state_update", sanitized);
    }
  }
}

function startTimerLoop(io: ServerIO) {
  if (global.timerInterval) return;

  global.timerInterval = setInterval(() => {
    Object.values(activeRooms).forEach((roomState) => {
      if (!roomState.timer.isRunning) return;

      const timer = roomState.timer;
      let stateChanged = false;

      if (timer.turnTimeRemaining > 0) {
        timer.turnTimeRemaining -= 1;
        stateChanged = true;

        if (timer.activeTeam === "team1" && timer.team1TimeRemaining > 0) {
          timer.team1TimeRemaining -= 1;
        } else if (timer.activeTeam === "team2" && timer.team2TimeRemaining > 0) {
          timer.team2TimeRemaining -= 1;
        }

        if (timer.activePlayerId && roomState.players[timer.activePlayerId]) {
          const activePlayer = roomState.players[timer.activePlayerId];
          if (activePlayer.remainingSeconds > 0) {
            activePlayer.remainingSeconds -= 1;
          }
        }

        if (timer.turnTimeRemaining <= timer.warningThresholdSeconds && !timer.isWarningActive) {
          timer.isWarningActive = true;
          roomState.chatMessages.push({
            id: `sys-warn-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            senderId: "system",
            senderName: "System",
            senderRole: "admin",
            channel: "global",
            text: `⚠️ WARNING: Only ${timer.turnTimeRemaining} seconds remaining for active speaker turn!`,
            timestamp: Date.now(),
            isSystem: true
          });
        }
      }

      if (
        timer.turnTimeRemaining <= 0 ||
        (timer.activeTeam === "team1" && timer.team1TimeRemaining <= 0) ||
        (timer.activeTeam === "team2" && timer.team2TimeRemaining <= 0)
      ) {
        timer.isRunning = false;
        timer.autoMutedTriggered = true;

        if (timer.activePlayerId && roomState.players[timer.activePlayerId]) {
          const player = roomState.players[timer.activePlayerId];
          player.isMuted = true;
          roomState.chatMessages.push({
            id: `sys-mute-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            senderId: "system",
            senderName: "System",
            senderRole: "admin",
            channel: "global",
            text: `⏰ Time's up! Active speaker @${player.username} has been automatically muted.`,
            timestamp: Date.now(),
            isSystem: true
          });
        }

        stateChanged = true;
      }

      if (stateChanged) {
        broadcastSanitizedRoomState(io, roomState);
      }
    });
  }, 1000);
}

const ioHandler = (
  req: NextApiRequest,
  res: NextApiResponse & { socket: { server: NetServer & { io?: ServerIO } } }
) => {
  if (!res.socket.server.io) {
    const httpServer: NetServer = res.socket.server as any;
    const io = new ServerIO(httpServer, {
      path: '/api/socket/io',
      addTrailingSlash: false,
      cors: { origin: '*' }
    });

    global.socketIoInstance = io;
    startTimerLoop(io);

    io.on("connection", (socket) => {
      let currentUsername: string | null = null;
      let currentRoomId: string | null = null;

      socket.on("join_room", (payload: { roomId?: string; username: string; provider?: string }) => {
        const rawUsername = (payload.username || "").trim().toLowerCase();
        const targetRoomId = (payload.roomId || "main-lobby").trim().toLowerCase();

        if (!rawUsername) return;

        if (!activeRooms[targetRoomId]) {
          socket.emit("room_not_found_error", {
            roomId: targetRoomId,
            message: `Lobby "${targetRoomId}" does not exist. Please check the Lobby ID or ask the host to create it.`
          });
          return;
        }

        const roomState = activeRooms[targetRoomId];

        // Check if username is banned
        if (roomState.bannedUsernames?.includes(rawUsername)) {
          socket.emit("banned_error", { message: "You are banned from this lobby by the admin." });
          return;
        }

        currentUsername = rawUsername;
        currentRoomId = targetRoomId;
        (socket as any).currentUsername = rawUsername;

        socket.join(targetRoomId);

        let role: 'admin' | 'player' | 'spectator' = 'spectator';
        let team: TeamId | undefined = undefined;
        let personalizedTime = 180;

        if (rawUsername === roomState.adminUsername.toLowerCase()) {
          role = "admin";
        } else {
          const rosterEntry = roomState.registeredRoster.find(
            r => r.username.toLowerCase() === rawUsername
          );

          if (rosterEntry) {
            role = "player";
            team = rosterEntry.team;
            personalizedTime = rosterEntry.personalizedTime || 180;
          } else {
            role = "spectator";
          }
        }

        const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(rawUsername)}`;
        const existingPlayer = roomState.players[rawUsername];

        const playerObj: Player = {
          id: rawUsername,
          username: rawUsername,
          avatarUrl,
          role,
          team,
          // Spectators do NOT have camera/mic permission:
          isMuted: role === 'spectator' ? true : (existingPlayer ? existingPlayer.isMuted : false),
          isVideoOff: role === 'spectator' ? true : (existingPlayer ? existingPlayer.isVideoOff : false),
          isMutedByAdmin: existingPlayer ? existingPlayer.isMutedByAdmin : false,
          isVideoOffByAdmin: existingPlayer ? existingPlayer.isVideoOffByAdmin : false,
          isOnline: true,
          timeLimitSeconds: personalizedTime,
          remainingSeconds: existingPlayer ? existingPlayer.remainingSeconds : personalizedTime,
          authProvider: (payload.provider as any) || "direct",
          joinedAt: existingPlayer?.joinedAt || Date.now()
        };

        roomState.players[rawUsername] = playerObj;

        if (role === "player" && !roomState.timer.activePlayerId) {
          roomState.timer.activePlayerId = rawUsername;
          if (team) roomState.timer.activeTeam = team;
        }

        updateSpectatorCount(roomState);

        socket.emit("joined_room_ack", {
          roomState: getSanitizedRoomStateForPlayer(roomState, playerObj),
          assignedPlayer: playerObj
        });

        // Only emit player toasts for PLAYERS and ADMIN, NOT spectators!
        if (role === "player" || role === "admin") {
          io.to(targetRoomId).emit("player_toast_event", {
            message: `⚡ @${rawUsername} joined the game as ${role === 'admin' ? 'Admin Host' : `Player (${team?.toUpperCase() || 'PLAYER'})`}`
          });
        }

        const joinMsg: ChatMessage = {
          id: `sys-join-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          senderId: "system",
          senderName: "System",
          senderRole: "admin",
          channel: "global",
          text: `⚡ @${rawUsername} joined as ${role.toUpperCase()}${team ? ` (${team.toUpperCase()})` : ""}`,
          timestamp: Date.now(),
          isSystem: true
        };
        roomState.chatMessages.push(joinMsg);

        broadcastSanitizedRoomState(io, roomState);
      });

      // Spectators or Players leaving voluntarily
      socket.on("leave_room", () => {
        if (!currentRoomId || !currentUsername || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];

        const isAdminLeaving = currentUsername.toLowerCase() === roomState.adminUsername.toLowerCase();

        if (isAdminLeaving && roomState.isPersonalLobby) {
          io.to(currentRoomId).emit("session_ended_event", {
            message: "The Admin Host left the lobby. The match session has been ended and room destroyed."
          });
          delete activeRooms[currentRoomId];
          socket.leave(currentRoomId);
          return;
        }

        const leavingPlayer = roomState.players[currentUsername];
        if (leavingPlayer) {
          const wasPlayerOrAdmin = leavingPlayer.role === 'player' || leavingPlayer.role === 'admin';
          const leavingTeam = leavingPlayer.team;
          delete roomState.players[currentUsername];
          updateSpectatorCount(roomState);

          if (leavingTeam) {
            recalculateTeamEqualTime(roomState, leavingTeam);
          }

          if (wasPlayerOrAdmin) {
            io.to(currentRoomId).emit("player_toast_event", {
              message: `👋 @${currentUsername} left the game.`
            });
          }

          roomState.chatMessages.push({
            id: `sys-leave-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            senderId: "system",
            senderName: "System",
            senderRole: "admin",
            channel: "global",
            text: `👋 @${currentUsername} left the lobby.`,
            timestamp: Date.now(),
            isSystem: true
          });

          broadcastSanitizedRoomState(io, roomState);
        }

        socket.leave(currentRoomId);
      });

      // Media Toggles (Players only - Spectators blocked)
      socket.on("toggle_media", (payload: { username: string; mediaType: "mic" | "video"; value: boolean }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const player = roomState.players[payload.username];
        if (!player) return;

        // Spectators do NOT have mic or video permissions!
        if (player.role === 'spectator') {
          return;
        }

        if (payload.mediaType === "mic") {
          if (!player.isMutedByAdmin) player.isMuted = payload.value;
        } else if (payload.mediaType === "video") {
          if (!player.isVideoOffByAdmin) player.isVideoOff = payload.value;
        }

        broadcastSanitizedRoomState(io, roomState);
      });

      // Chat Messages
      socket.on("send_chat", (payload: { senderUsername: string; channel: "global" | "team1" | "team2"; text: string }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const player = roomState.players[payload.senderUsername];
        if (!player) return;

        if ((player.role === "admin" || player.role === "spectator") && payload.channel !== "global") {
          socket.emit("chat_error", { message: "Admins and spectators can only post in Global Chat." });
          return;
        }

        if (player.role === "player" && payload.channel !== "global" && payload.channel !== player.team) {
          socket.emit("chat_error", { message: "You can only post in your assigned team channel or Global Chat." });
          return;
        }

        const msg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          senderId: player.username,
          senderName: player.username,
          senderRole: player.role,
          senderTeam: player.team,
          channel: payload.channel,
          text: payload.text.trim(),
          timestamp: Date.now()
        };

        roomState.chatMessages.push(msg);
        if (roomState.chatMessages.length > 200) roomState.chatMessages.shift();

        broadcastSanitizedRoomState(io, roomState);
      });

      // Secret Team Shared Notes Update (Team 1 or Team 2)
      socket.on("update_team_notes", (payload: { teamId: TeamId; title?: string; content?: string; username: string }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const player = roomState.players[payload.username];

        // Only players assigned to that team can edit their team notes!
        if (!player || player.role !== 'player' || player.team !== payload.teamId) {
          socket.emit("chat_error", { message: "Only team members can edit their team strategy notes." });
          return;
        }

        if (!roomState.teamNotes) {
          roomState.teamNotes = {
            team1: { teamId: "team1", title: "Team 1 Secret Strategy Pad", content: "", updatedAt: Date.now() },
            team2: { teamId: "team2", title: "Team 2 Secret Strategy Pad", content: "", updatedAt: Date.now() }
          };
        }

        const note = roomState.teamNotes[payload.teamId];
        if (note) {
          if (payload.title !== undefined) note.title = payload.title;
          if (payload.content !== undefined) note.content = payload.content;
          note.lastEditedBy = payload.username;
          note.updatedAt = Date.now();

          broadcastSanitizedRoomState(io, roomState);
        }
      });

      socket.on("admin_update_roster", (payload: { roster: { username: string; team: TeamId; personalizedTime?: number }[] }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        roomState.registeredRoster = payload.roster;
        broadcastSanitizedRoomState(io, roomState);
      });

      socket.on("admin_control_timer", (payload: { action: "start" | "pause" | "reset" | "switch_turn"; activeTeam?: TeamId; activePlayerId?: string; turnSeconds?: number; warningSeconds?: number; team1Time?: number; team2Time?: number }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const timer = roomState.timer;

        if (payload.action === "start") {
          timer.isRunning = true;
          timer.isWarningActive = false;
          timer.autoMutedTriggered = false;
          if (!timer.activePlayerId && roomState.registeredRoster && roomState.registeredRoster.length > 0) {
            const firstRosterPlayer = roomState.registeredRoster[0];
            timer.activePlayerId = firstRosterPlayer.username;
            timer.activeTeam = firstRosterPlayer.team;
            if (roomState.players[firstRosterPlayer.username]) {
              roomState.players[firstRosterPlayer.username].isMuted = false;
            }
          }
        } else if (payload.action === "pause") {
          timer.isRunning = false;
        } else if (payload.action === "reset") {
          timer.isRunning = false;
          timer.isWarningActive = false;
          timer.autoMutedTriggered = false;
          timer.team1TimeRemaining = payload.team1Time ?? roomState.team1TotalTime;
          timer.team2TimeRemaining = payload.team2Time ?? roomState.team2TotalTime;
          timer.turnTimeRemaining = payload.turnSeconds ?? 60;
        } else if (payload.action === "switch_turn") {
          if (payload.activeTeam) timer.activeTeam = payload.activeTeam;
          if (payload.activePlayerId) {
            timer.activePlayerId = payload.activePlayerId;
            if (roomState.players[payload.activePlayerId]) {
              roomState.players[payload.activePlayerId].isMuted = false;
            }
          }
          if (payload.turnSeconds) timer.turnTimeRemaining = payload.turnSeconds;
          timer.isWarningActive = false;
          timer.autoMutedTriggered = false;
        }

        if (payload.warningSeconds !== undefined) {
          timer.warningThresholdSeconds = payload.warningSeconds;
        }
        if (payload.team1Time !== undefined) {
          roomState.team1TotalTime = payload.team1Time;
        }
        if (payload.team2Time !== undefined) {
          roomState.team2TotalTime = payload.team2Time;
        }

        broadcastSanitizedRoomState(io, roomState);
      });

      // Admin update player / spectator
      socket.on("admin_update_player", (payload: { targetUsername: string; team?: TeamId; role?: 'player' | 'spectator'; isMutedByAdmin?: boolean; isVideoOffByAdmin?: boolean; personalizedTime?: number }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const player = roomState.players[payload.targetUsername];
        if (!player) return;

        if (payload.team) player.team = payload.team;
        if (payload.role) {
          const oldRole = player.role;
          player.role = payload.role;
          if (payload.role === 'spectator') {
            player.team = undefined;
            player.isMuted = true;
            player.isVideoOff = true;
            if (oldRole === 'player' || oldRole === 'admin') {
              io.to(currentRoomId).emit("player_toast_event", {
                message: `👋 @${payload.targetUsername} left the players roster.`
              });
            }
          } else if (payload.role === 'player') {
            io.to(currentRoomId).emit("player_toast_event", {
              message: `⚡ @${payload.targetUsername} added as Player (${payload.team?.toUpperCase() || ''})`
            });
          }
        }
        if (payload.isMutedByAdmin !== undefined) {
          player.isMutedByAdmin = payload.isMutedByAdmin;
          player.isMuted = payload.isMutedByAdmin;
        }
        if (payload.isVideoOffByAdmin !== undefined) {
          player.isVideoOffByAdmin = payload.isVideoOffByAdmin;
          player.isVideoOff = payload.isVideoOffByAdmin;
        }
        if (payload.personalizedTime !== undefined) {
          player.timeLimitSeconds = payload.personalizedTime;
          player.remainingSeconds = payload.personalizedTime;
        }

        updateSpectatorCount(roomState);
        broadcastSanitizedRoomState(io, roomState);
      });

      // Kick User (Player or Spectator)
      socket.on("admin_kick_user", (payload: { targetUsername: string }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const target = payload.targetUsername;

        if (roomState.players[target]) {
          delete roomState.players[target];
          updateSpectatorCount(roomState);

          roomState.chatMessages.push({
            id: `sys-kick-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            senderId: "system",
            senderName: "System",
            senderRole: "admin",
            channel: "global",
            text: `👢 @${target} was kicked from the lobby by admin.`,
            timestamp: Date.now(),
            isSystem: true
          });

          io.to(currentRoomId).emit("user_kicked_event", { targetUsername: target });
          broadcastSanitizedRoomState(io, roomState);
        }
      });

      // Ban User (Player or Spectator)
      socket.on("admin_ban_user", (payload: { targetUsername: string }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const target = payload.targetUsername;

        if (!roomState.bannedUsernames) roomState.bannedUsernames = [];
        if (!roomState.bannedUsernames.includes(target)) {
          roomState.bannedUsernames.push(target);
        }

        if (roomState.players[target]) {
          delete roomState.players[target];
          updateSpectatorCount(roomState);

          roomState.chatMessages.push({
            id: `sys-ban-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            senderId: "system",
            senderName: "System",
            senderRole: "admin",
            channel: "global",
            text: `⛔ @${target} was banned from the lobby by admin.`,
            timestamp: Date.now(),
            isSystem: true
          });

          io.to(currentRoomId).emit("user_banned_event", { targetUsername: target });
          broadcastSanitizedRoomState(io, roomState);
        }
      });

      // Unban User (Player or Spectator)
      socket.on("admin_unban_user", (payload: { targetUsername: string }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const target = payload.targetUsername;

        if (roomState.bannedUsernames && roomState.bannedUsernames.includes(target)) {
          roomState.bannedUsernames = roomState.bannedUsernames.filter(u => u !== target);

          roomState.chatMessages.push({
            id: `sys-unban-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            senderId: "system",
            senderName: "System",
            senderRole: "admin",
            channel: "global",
            text: `✅ @${target} was unbanned by admin and can now re-enter the lobby.`,
            timestamp: Date.now(),
            isSystem: true
          });

          io.to(currentRoomId).emit("player_toast_event", { message: `✅ @${target} was unbanned by admin.` });
          broadcastSanitizedRoomState(io, roomState);
        }
      });

      // Update team total time (Admin or Team click)
      socket.on("update_team_time", (payload: { team: TeamId; newTimeSeconds: number }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];

        if (roomState.timer.isRunning) {
          socket.emit("time_update_error", {
            message: "Cannot modify time while debate session is active. Please pause the session first!"
          });
          return;
        }

        const seconds = Math.max(10, Math.min(3600, payload.newTimeSeconds));
        if (payload.team === 'team1') {
          roomState.team1TotalTime = seconds;
          roomState.timer.team1TimeRemaining = seconds;
        } else if (payload.team === 'team2') {
          roomState.team2TotalTime = seconds;
          roomState.timer.team2TimeRemaining = seconds;
        }
        recalculateTeamEqualTime(roomState, payload.team);

        const teamLabel = payload.team === 'team1' ? 'Team 1 (Blue)' : 'Team 2 (Red)';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const formattedTime = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        io.to(currentRoomId).emit("team_time_prompt_event", {
          team: payload.team,
          message: `📢 ${teamLabel} total time updated to ${formattedTime}. Remaining time has been equally redistributed among active speakers.`
        });

        broadcastSanitizedRoomState(io, roomState);
      });

      // Update individual player time share (Only player themselves can adjust)
      socket.on("update_player_time", (payload: { username: string; newTimeSeconds: number }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];

        if (roomState.timer.isRunning) {
          socket.emit("time_update_error", {
            message: "Cannot adjust personal time while debate session is active. Please pause the session first!"
          });
          return;
        }

        if (payload.username !== currentUsername) return; // Strict: player can only update their own time
        const player = roomState.players[payload.username];
        if (!player) return;

        const seconds = Math.max(5, Math.min(1800, payload.newTimeSeconds));
        player.timeLimitSeconds = seconds;
        player.remainingSeconds = seconds;
        broadcastSanitizedRoomState(io, roomState);
      });

      // WebRTC Peer Signaling Relay
      socket.on("webrtc_offer", (data: { targetUsername: string; offer: any; senderUsername: string }) => {
        if (!currentRoomId) return;
        const target = (data.targetUsername || "").toLowerCase();
        const roomSockets = io.sockets.adapter.rooms.get(currentRoomId);
        if (!roomSockets) return;

        for (const socketId of roomSockets) {
          const s = io.sockets.sockets.get(socketId);
          if (s && ((s as any).currentUsername || "").toLowerCase() === target) {
            s.emit("webrtc_offer", { offer: data.offer, senderUsername: data.senderUsername });
          }
        }
      });

      socket.on("webrtc_answer", (data: { targetUsername: string; answer: any; senderUsername: string }) => {
        if (!currentRoomId) return;
        const target = (data.targetUsername || "").toLowerCase();
        const roomSockets = io.sockets.adapter.rooms.get(currentRoomId);
        if (!roomSockets) return;

        for (const socketId of roomSockets) {
          const s = io.sockets.sockets.get(socketId);
          if (s && ((s as any).currentUsername || "").toLowerCase() === target) {
            s.emit("webrtc_answer", { answer: data.answer, senderUsername: data.senderUsername });
          }
        }
      });

      socket.on("webrtc_ice_candidate", (data: { targetUsername: string; candidate: any; senderUsername: string }) => {
        if (!currentRoomId) return;
        const target = (data.targetUsername || "").toLowerCase();
        const roomSockets = io.sockets.adapter.rooms.get(currentRoomId);
        if (!roomSockets) return;

        for (const socketId of roomSockets) {
          const s = io.sockets.sockets.get(socketId);
          if (s && ((s as any).currentUsername || "").toLowerCase() === target) {
            s.emit("webrtc_ice_candidate", { candidate: data.candidate, senderUsername: data.senderUsername });
          }
        }
      });

      socket.on("webrtc_request_stream", (data: { targetUsername: string; senderUsername: string }) => {
        if (!currentRoomId) return;
        const target = (data.targetUsername || "").toLowerCase();
        if (target === "all") {
          socket.to(currentRoomId).emit("webrtc_request_stream", { senderUsername: data.senderUsername });
        } else {
          const roomSockets = io.sockets.adapter.rooms.get(currentRoomId);
          if (!roomSockets) return;
          for (const socketId of roomSockets) {
            const s = io.sockets.sockets.get(socketId);
            if (s && ((s as any).currentUsername || "").toLowerCase() === target) {
              s.emit("webrtc_request_stream", { senderUsername: data.senderUsername });
            }
          }
        }
      });

      // Admin End Session & Destroy Lobby
      socket.on("admin_end_session", () => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;

        io.to(currentRoomId).emit("session_ended_event", {
          message: "The Admin Host has ended the match session and destroyed the lobby."
        });

        // Completely delete room from memory so no traces remain
        delete activeRooms[currentRoomId];
      });

      socket.on("disconnect", () => {
        if (currentRoomId && currentUsername && activeRooms[currentRoomId]) {
          const roomState = activeRooms[currentRoomId];
          const leavingPlayer = roomState.players[currentUsername];
          if (leavingPlayer) {
            const wasPlayerOrAdmin = leavingPlayer.role === 'player' || leavingPlayer.role === 'admin';
            const leavingTeam = leavingPlayer.team;
            delete roomState.players[currentUsername];
            updateSpectatorCount(roomState);

            if (leavingTeam) {
              recalculateTeamEqualTime(roomState, leavingTeam);
            }

            if (wasPlayerOrAdmin) {
              io.to(currentRoomId).emit("player_toast_event", {
                message: `👋 @${currentUsername} left the game.`
              });
            }

            broadcastSanitizedRoomState(io, roomState);
          }
        }
      });
    });

    res.socket.server.io = io;
  }

  res.end();
};

export default ioHandler;
