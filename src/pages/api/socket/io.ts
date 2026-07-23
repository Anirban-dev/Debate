import { Server as ServerIO } from 'socket.io';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as NetServer } from 'http';
import { activeRooms, createDefaultRoomState } from '@/lib/socketStore';
import { ChatMessage, MatchRoomState, Player, SharedNotePage, TeamId } from '@/types';

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
            id: `sys-warn-${Date.now()}`,
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

      if (timer.turnTimeRemaining <= 0 || 
         (timer.activeTeam === "team1" && timer.team1TimeRemaining <= 0) ||
         (timer.activeTeam === "team2" && timer.team2TimeRemaining <= 0)) {
        
        timer.isRunning = false;
        timer.autoMutedTriggered = true;

        if (timer.activePlayerId && roomState.players[timer.activePlayerId]) {
          const player = roomState.players[timer.activePlayerId];
          player.isMuted = true;
          roomState.chatMessages.push({
            id: `sys-mute-${Date.now()}`,
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
        io.to(roomState.roomId).emit("room_state_update", roomState);
      }
    });
  }, 1000);
}

const ioHandler = (req: NextApiRequest, res: NextApiResponse & { socket: { server: NetServer & { io?: ServerIO } } }) => {
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
          activeRooms[targetRoomId] = createDefaultRoomState(targetRoomId);
        }

        const roomState = activeRooms[targetRoomId];
        currentUsername = rawUsername;
        currentRoomId = targetRoomId;

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
          isMuted: existingPlayer ? existingPlayer.isMuted : false,
          isVideoOff: existingPlayer ? existingPlayer.isVideoOff : false,
          isMutedByAdmin: existingPlayer ? existingPlayer.isMutedByAdmin : false,
          isVideoOffByAdmin: existingPlayer ? existingPlayer.isVideoOffByAdmin : false,
          isOnline: true,
          timeLimitSeconds: personalizedTime,
          remainingSeconds: existingPlayer ? existingPlayer.remainingSeconds : personalizedTime,
          authProvider: (payload.provider as any) || "direct"
        };

        roomState.players[rawUsername] = playerObj;

        if (role === "player" && !roomState.timer.activePlayerId) {
          roomState.timer.activePlayerId = rawUsername;
          if (team) roomState.timer.activeTeam = team;
        }

        updateSpectatorCount(roomState);

        socket.emit("joined_room_ack", {
          roomState,
          assignedPlayer: playerObj
        });

        const joinMsg: ChatMessage = {
          id: `sys-join-${Date.now()}`,
          senderId: "system",
          senderName: "System",
          senderRole: "admin",
          channel: "global",
          text: `⚡ @${rawUsername} joined as ${role.toUpperCase()}${team ? ` (${team.toUpperCase()})` : ""}`,
          timestamp: Date.now(),
          isSystem: true
        };
        roomState.chatMessages.push(joinMsg);

        io.to(targetRoomId).emit("room_state_update", roomState);
      });

      socket.on("toggle_media", (payload: { username: string; mediaType: "mic" | "video"; value: boolean }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const player = roomState.players[payload.username];
        if (!player) return;

        if (payload.mediaType === "mic") {
          if (!player.isMutedByAdmin) player.isMuted = payload.value;
        } else if (payload.mediaType === "video") {
          if (!player.isVideoOffByAdmin) player.isVideoOff = payload.value;
        }

        io.to(currentRoomId).emit("room_state_update", roomState);
      });

      socket.on("send_chat", (payload: { senderUsername: string; channel: "global" | "team1" | "team2"; text: string }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const player = roomState.players[payload.senderUsername];
        if (!player) return;

        if (player.role === "spectator" && payload.channel !== "global") {
          socket.emit("chat_error", { message: "Spectators can only participate in Global Chat." });
          return;
        }

        if (player.role === "player" && payload.channel !== "global" && payload.channel !== player.team) {
          socket.emit("chat_error", { message: "You can only post in your assigned team channel or Global Chat." });
          return;
        }

        const msg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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

        io.to(currentRoomId).emit("room_state_update", roomState);
      });

      socket.on("update_note_page", (payload: { pageIndex: number; title?: string; content?: string; username: string }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        if (roomState.notesPages[payload.pageIndex]) {
          const page = roomState.notesPages[payload.pageIndex];
          if (payload.title !== undefined) page.title = payload.title;
          if (payload.content !== undefined) page.content = payload.content;
          page.lastEditedBy = payload.username;
          page.updatedAt = Date.now();

          io.to(currentRoomId).emit("room_state_update", roomState);
        }
      });

      socket.on("add_note_page", (payload: { username: string }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const newPageNum = roomState.notesPages.length + 1;
        const newPage: SharedNotePage = {
          pageNumber: newPageNum,
          title: `Page ${newPageNum}: Untitled Note`,
          content: `# Page ${newPageNum}\n\nStart typing shared match strategy here...`,
          lastEditedBy: payload.username,
          updatedAt: Date.now()
        };
        roomState.notesPages.push(newPage);
        roomState.activePageIndex = roomState.notesPages.length - 1;

        io.to(currentRoomId).emit("room_state_update", roomState);
      });

      socket.on("set_active_note_page", (pageIndex: number) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        if (pageIndex >= 0 && pageIndex < roomState.notesPages.length) {
          roomState.activePageIndex = pageIndex;
          io.to(currentRoomId).emit("room_state_update", roomState);
        }
      });

      socket.on("admin_update_roster", (payload: { roster: { username: string; team: TeamId; personalizedTime?: number }[] }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        roomState.registeredRoster = payload.roster;
        io.to(currentRoomId).emit("room_state_update", roomState);
      });

      socket.on("admin_control_timer", (payload: { action: "start" | "pause" | "reset" | "switch_turn"; activeTeam?: TeamId; activePlayerId?: string; turnSeconds?: number; warningSeconds?: number; team1Time?: number; team2Time?: number }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const timer = roomState.timer;

        if (payload.action === "start") {
          timer.isRunning = true;
          timer.isWarningActive = false;
          timer.autoMutedTriggered = false;
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

        io.to(currentRoomId).emit("room_state_update", roomState);
      });

      socket.on("admin_update_player", (payload: { targetUsername: string; team?: TeamId; role?: 'player' | 'spectator'; isMutedByAdmin?: boolean; isVideoOffByAdmin?: boolean; personalizedTime?: number }) => {
        if (!currentRoomId || !activeRooms[currentRoomId]) return;
        const roomState = activeRooms[currentRoomId];
        const player = roomState.players[payload.targetUsername];
        if (!player) return;

        if (payload.team) player.team = payload.team;
        if (payload.role) player.role = payload.role;
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
        io.to(currentRoomId).emit("room_state_update", roomState);
      });

      socket.on("disconnect", () => {
        if (currentRoomId && currentUsername && activeRooms[currentRoomId]) {
          const roomState = activeRooms[currentRoomId];
          if (roomState.players[currentUsername]) {
            roomState.players[currentUsername].isOnline = false;
            updateSpectatorCount(roomState);
            io.to(currentRoomId).emit("room_state_update", roomState);
          }
        }
      });
    });

    res.socket.server.io = io;
  }

  res.end();
};

export default ioHandler;
