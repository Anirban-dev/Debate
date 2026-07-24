import { MatchRoomState } from '../types';

declare global {
  var activeRooms: Record<string, MatchRoomState> | undefined;
}

if (!global.activeRooms) {
  global.activeRooms = {};
}

export function createDefaultRoomState(
  roomId = "main-lobby",
  roomTitle = "Grand Championship Match & Debate Lobby",
  adminUsername = "admin"
): MatchRoomState {
  const isPersonalLobby = roomId !== "main-lobby";

  return {
    roomId,
    roomTitle: isPersonalLobby ? `Personal Match Lobby #${roomId}` : roomTitle,
    adminUsername,
    isPersonalLobby,
    players: {},
    bannedUsernames: [],
    registeredRoster: [],
    teamNotes: {
      team1: {
        teamId: "team1",
        title: "Team 1 Secret Strategy Pad",
        content: "# Team 1 Confidential Strategy & Debate Notes\n\n- Key Arguments:\n  1. Main thesis statement\n  2. Rebuttal points for Team 2\n  3. Closing synthesis\n\n*(Private to Team 1 players. Hidden from Admin and Spectators)*",
        updatedAt: Date.now()
      },
      team2: {
        teamId: "team2",
        title: "Team 2 Secret Strategy Pad",
        content: "# Team 2 Confidential Strategy & Debate Notes\n\n- Key Arguments:\n  1. Counter-arguments & evidence\n  2. Key questions for Team 1\n  3. Summary points\n\n*(Private to Team 2 players. Hidden from Admin and Spectators)*",
        updatedAt: Date.now()
      }
    },
    chatMessages: [
      {
        id: "msg-1",
        senderId: "system",
        senderName: "System",
        senderRole: "admin",
        channel: "global",
        text: "👋 Welcome to MatchLobby! Connect as Admin Host, Player, or Spectator.",
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

export const activeRooms = global.activeRooms;
