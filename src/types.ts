export type PlayerRole = 'admin' | 'player' | 'spectator';
export type TeamId = 'team1' | 'team2';
export type ChatChannel = 'global' | 'team1' | 'team2';

export interface Player {
  id: string; // unique identifier socket or username
  username: string;
  avatarUrl?: string;
  role: PlayerRole;
  team?: TeamId; // 'team1' or 'team2', null if spectator
  isMuted: boolean;
  isVideoOff: boolean;
  isMutedByAdmin: boolean;
  isVideoOffByAdmin: boolean;
  isOnline: boolean;
  timeLimitSeconds: number; // custom time personalized for player turn
  remainingSeconds: number; // current turn remaining time
  authProvider?: 'google' | 'discord' | 'direct';
  joinedAt?: number;
}

export interface SharedNotePage {
  teamId: TeamId; // 'team1' or 'team2'
  title: string;
  content: string;
  lastEditedBy?: string;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: PlayerRole;
  senderTeam?: TeamId;
  channel: ChatChannel;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface TimerState {
  activeTeam: TeamId | null;
  activePlayerId: string | null;
  isRunning: boolean;
  team1TimeRemaining: number; // total time left for team 1
  team2TimeRemaining: number; // total time left for team 2
  turnTimeRemaining: number;  // time left for active player turn
  warningThresholdSeconds: number; // admin set warning (e.g. 10s)
  isWarningActive: boolean;
  autoMutedTriggered: boolean;
}

export interface MatchRoomState {
  roomId: string;
  roomTitle: string;
  adminUsername: string;
  isPersonalLobby: boolean;
  players: Record<string, Player>; // username -> Player
  registeredRoster: {
    username: string;
    team: TeamId;
    personalizedTime?: number;
  }[];
  teamNotes: {
    team1: SharedNotePage;
    team2: SharedNotePage;
  };
  bannedUsernames: string[];
  chatMessages: ChatMessage[];
  timer: TimerState;
  spectatorCount: number;
  team1TotalTime: number; // total allocated team 1 time
  team2TotalTime: number; // total allocated team 2 time
}

// Socket event interfaces
export interface WebRTCMessagePayload {
  targetUsername: string;
  senderUsername: string;
  signal: any;
}
