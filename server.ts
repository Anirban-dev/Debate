import express from "express";
import http from "http";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import { ChatMessage, MatchRoomState, Player, SharedNotePage, TeamId } from "./src/types";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*" }
});

const PORT = 3000;

// Default initial state for demo room
let roomState: MatchRoomState = {
  roomId: "main-lobby",
  roomTitle: "Grand Championship Match & Debate Lobby",
  adminUsername: "admin",
  players: {},
  registeredRoster: [
    { username: "alex_blue", team: "team1", personalizedTime: 180 },
    { username: "jordan_blue", team: "team1", personalizedTime: 180 },
    { username: "sarah_red", team: "team2", personalizedTime: 180 },
    { username: "sam_red", team: "team2", personalizedTime: 180 }
  ],
  notesPages: [
    {
      pageNumber: 1,
      title: "Page 1: Match Rules & Strategy",
      content: "# Match Strategy & Key Rules\n\n- Team 1 (Blue) vs Team 2 (Red)\n- Active turn time: 30s - 180s per speaker\n- Admin warning threshold set at 10s\n- Auto-mute triggers upon timeout!",
      updatedAt: Date.now()
    },
    {
      pageNumber: 2,
      title: "Page 2: Team Notes & Arguments",
      content: "# Team Scratchpad\n\n- Key points for opening statement:\n  1. Main thesis\n  2. Supporting evidence\n  3. Rebuttal notes",
      updatedAt: Date.now()
    }
  ],
  activePageIndex: 0,
  chatMessages: [
    {
      id: "msg-1",
      senderId: "system",
      senderName: "System",
      senderRole: "admin",
      channel: "global",
      text: "👋 Welcome to MatchLobby! Connect as Admin, Player, or Spectator.",
      timestamp: Date.now(),
      isSystem: true
    }
  ],
  timer: {
    activeTeam: "team1",
    activePlayerId: null,
    isRunning: false,
    team1TimeRemaining: 300, // 5 mins total
    team2TimeRemaining: 300, // 5 mins total
    turnTimeRemaining: 60,   // 60s turn
    warningThresholdSeconds: 10,
    isWarningActive: false,
    autoMutedTriggered: false
  },
  spectatorCount: 0,
  team1TotalTime: 300,
  team2TotalTime: 300
};

// Timer loop running every 1 second
setInterval(() => {
  if (!roomState.timer.isRunning) return;

  const timer = roomState.timer;
  let stateChanged = false;

  if (timer.turnTimeRemaining > 0) {
    timer.turnTimeRemaining -= 1;
    stateChanged = true;

    // Check overall team time
    if (timer.activeTeam === "team1" && timer.team1TimeRemaining > 0) {
      timer.team1TimeRemaining -= 1;
    } else if (timer.activeTeam === "team2" && timer.team2TimeRemaining > 0) {
      timer.team2TimeRemaining -= 1;
    }

    // Check individual active player personal time
    if (timer.activePlayerId && roomState.players[timer.activePlayerId]) {
      const activePlayer = roomState.players[timer.activePlayerId];
      if (activePlayer.remainingSeconds > 0) {
        activePlayer.remainingSeconds -= 1;
      }
    }

    // Warning trigger
    if (timer.turnTimeRemaining <= timer.warningThresholdSeconds && !timer.isWarningActive) {
      timer.isWarningActive = true;
      roomState.chatMessages.push({
        id: `sys-warn-${Date.now()}`,
        senderId: "system",
        senderName: "System",
        senderRole: "admin",
        channel: "global",
        text: `⚠️ WARNING: Only ${timer.turnTimeRemaining} seconds remaining for active speaker!`,
        timestamp: Date.now(),
        isSystem: true
      });
    }
  }

  // Check timeout trigger
  if (timer.turnTimeRemaining <= 0 || 
     (timer.activeTeam === "team1" && timer.team1TimeRemaining <= 0) ||
     (timer.activeTeam === "team2" && timer.team2TimeRemaining <= 0)) {
    
    timer.isRunning = false;
    timer.autoMutedTriggered = true;

    // Auto mute active player
    if (timer.activePlayerId && roomState.players[timer.activePlayerId]) {
      const player = roomState.players[timer.activePlayerId];
      player.isMuted = true;
      roomState.chatMessages.push({
        id: `sys-mute-${Date.now()}`,
        senderId: "system",
        senderName: "System",
        senderRole: "admin",
        channel: "global",
        text: `⏰ Time's up! Active player @${player.username} has been automatically muted.`,
        timestamp: Date.now(),
        isSystem: true
      });
    }

    stateChanged = true;
  }

  if (stateChanged) {
    io.emit("room_state_update", roomState);
  }
}, 1000);

// Helper to count online spectators
function updateSpectatorCount() {
  let count = 0;
  Object.values(roomState.players).forEach(p => {
    if (p.role === "spectator" && p.isOnline) {
      count++;
    }
  });
  roomState.spectatorCount = count;
}

// Socket IO Handler
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  let currentUsername: string | null = null;

  socket.on("join_room", (payload: { username: string; provider?: string; isAdminRequest?: boolean }) => {
    const rawUsername = (payload.username || "").trim();
    if (!rawUsername) return;

    currentUsername = rawUsername;
    socket.join("main-lobby");

    // Check username against admin / roster auto detection
    let role: 'admin' | 'player' | 'spectator' = 'spectator';
    let team: TeamId | undefined = undefined;
    let personalizedTime = 60;

    if (payload.isAdminRequest || rawUsername.toLowerCase() === roomState.adminUsername.toLowerCase()) {
      role = "admin";
    } else {
      const rosterEntry = roomState.registeredRoster.find(
        r => r.username.toLowerCase() === rawUsername.toLowerCase()
      );

      if (rosterEntry) {
        role = "player";
        team = rosterEntry.team;
        personalizedTime = rosterEntry.personalizedTime || 60;
      } else {
        // SPECTATOR (join): If username not detected in players, auto shift to spectator
        role = "spectator";
      }
    }

    // Avatar default generator based on username
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

    // Default set first player as active if none set
    if (role === "player" && !roomState.timer.activePlayerId) {
      roomState.timer.activePlayerId = rawUsername;
      if (team) roomState.timer.activeTeam = team;
    }

    updateSpectatorCount();

    // Send ACK to joining client
    socket.emit("joined_room_ack", {
      roomState,
      assignedPlayer: playerObj
    });

    // Notify channel
    const joinMsg: ChatMessage = {
      id: `sys-join-${Date.now()}`,
      senderId: "system",
      senderName: "System",
      senderRole: "admin",
      channel: "global",
      text: `⚡ ${rawUsername} joined as ${role.toUpperCase()}${team ? ` (${team.toUpperCase()})` : ""}`,
      timestamp: Date.now(),
      isSystem: true
    };
    roomState.chatMessages.push(joinMsg);

    io.emit("room_state_update", roomState);
  });

  // Toggle Media (Mic / Camera)
  socket.on("toggle_media", (payload: { username: string; mediaType: "mic" | "video"; value: boolean }) => {
    const player = roomState.players[payload.username];
    if (!player) return;

    if (payload.mediaType === "mic") {
      // Don't allow unmuting if muted by admin
      if (!player.isMutedByAdmin) {
        player.isMuted = payload.value;
      }
    } else if (payload.mediaType === "video") {
      if (!player.isVideoOffByAdmin) {
        player.isVideoOff = payload.value;
      }
    }

    io.emit("room_state_update", roomState);
  });

  // Chat Message
  socket.on("send_chat", (payload: { senderUsername: string; channel: "global" | "team1" | "team2"; text: string }) => {
    const player = roomState.players[payload.senderUsername];
    if (!player) return;

    // Spectator security check
    if (player.role === "spectator" && payload.channel !== "global") {
      socket.emit("chat_error", { message: "Spectators can only participate in Global Chat." });
      return;
    }

    // Team channel security check
    if (player.role === "player" && payload.channel !== "global" && payload.channel !== player.team) {
      socket.emit("chat_error", { message: "You can only post in your own team channel or Global Chat." });
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
    // Keep max 200 messages
    if (roomState.chatMessages.length > 200) {
      roomState.chatMessages.shift();
    }

    io.emit("room_state_update", roomState);
  });

  // Shared Notes update
  socket.on("update_note_page", (payload: { pageIndex: number; title?: string; content?: string; username: string }) => {
    if (roomState.notesPages[payload.pageIndex]) {
      const page = roomState.notesPages[payload.pageIndex];
      if (payload.title !== undefined) page.title = payload.title;
      if (payload.content !== undefined) page.content = payload.content;
      page.lastEditedBy = payload.username;
      page.updatedAt = Date.now();

      io.emit("room_state_update", roomState);
    }
  });

  socket.on("add_note_page", (payload: { username: string }) => {
    const newPageNum = roomState.notesPages.length + 1;
    const newPage: SharedNotePage = {
      pageNumber: newPageNum,
      title: `Page ${newPageNum}: Untitled Note`,
      content: `# Page ${newPageNum}\n\nStart typing shared team notes here...`,
      lastEditedBy: payload.username,
      updatedAt: Date.now()
    };
    roomState.notesPages.push(newPage);
    roomState.activePageIndex = roomState.notesPages.length - 1;

    io.emit("room_state_update", roomState);
  });

  socket.on("set_active_note_page", (pageIndex: number) => {
    if (pageIndex >= 0 && pageIndex < roomState.notesPages.length) {
      roomState.activePageIndex = pageIndex;
      io.emit("room_state_update", roomState);
    }
  });

  // Admin Controls
  socket.on("admin_update_roster", (payload: { roster: { username: string; team: TeamId; personalizedTime?: number }[] }) => {
    roomState.registeredRoster = payload.roster;
    io.emit("room_state_update", roomState);
  });

  socket.on("admin_control_timer", (payload: { action: "start" | "pause" | "reset" | "switch_turn"; activeTeam?: TeamId; activePlayerId?: string; turnSeconds?: number; warningSeconds?: number; team1Time?: number; team2Time?: number }) => {
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
        // Unmute player when turn starts
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

    io.emit("room_state_update", roomState);
  });

  socket.on("admin_update_player", (payload: { targetUsername: string; team?: TeamId; role?: 'player' | 'spectator'; isMutedByAdmin?: boolean; isVideoOffByAdmin?: boolean; personalizedTime?: number }) => {
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

    updateSpectatorCount();
    io.emit("room_state_update", roomState);
  });

  // WebRTC Peer signaling relay
  socket.on("webrtc_signal", (data: { targetUsername: string; signal: any; senderUsername: string }) => {
    io.emit(`webrtc_signal_${data.targetUsername}`, {
      senderUsername: data.senderUsername,
      signal: data.signal
    });
  });

  socket.on("disconnect", () => {
    if (currentUsername && roomState.players[currentUsername]) {
      roomState.players[currentUsername].isOnline = false;
      updateSpectatorCount();
      io.emit("room_state_update", roomState);
    }
  });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 MatchLobby server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
