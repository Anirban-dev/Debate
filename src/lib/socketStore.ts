import { MatchRoomState } from '../types';

declare global {
  var activeRooms: Record<string, MatchRoomState> | undefined;
}

if (!global.activeRooms) {
  global.activeRooms = {};
}

export function createDefaultRoomState(roomId = "main-lobby", roomTitle = "Grand Championship Match & Debate Lobby", adminUsername = "admin"): MatchRoomState {
  return {
    roomId,
    roomTitle,
    adminUsername,
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
        text: "👋 Welcome to MatchLobby Next.js! Connect as Admin Host, Player, or Spectator.",
        timestamp: Date.now(),
        isSystem: true
      }
    ],
    timer: {
      activeTeam: "team1",
      activePlayerId: null,
      isRunning: false,
      team1TimeRemaining: 300,
      team2TimeRemaining: 300,
      turnTimeRemaining: 60,
      warningThresholdSeconds: 10,
      isWarningActive: false,
      autoMutedTriggered: false
    },
    spectatorCount: 0,
    team1TotalTime: 300,
    team2TotalTime: 300
  };
}

if (!global.activeRooms["main-lobby"]) {
  global.activeRooms["main-lobby"] = createDefaultRoomState();
}

export const activeRooms = global.activeRooms;
