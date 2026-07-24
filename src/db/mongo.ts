import mongoose, { Schema, Document, Model } from 'mongoose';
import { TeamId } from '../types';

export interface IUser extends Document {
  oauthId: string;
  email?: string;
  username?: string;
  authProvider: string;
  avatarUrl?: string;
  isProfileComplete: boolean;
  createdAt: Date;
  lastLogin: Date;
}

const UserSchema = new Schema<IUser>({
  oauthId: { type: String, required: true, unique: true, index: true },
  email: { type: String },
  username: { type: String, sparse: true, unique: true, lowercase: true, trim: true },
  authProvider: { type: String, required: true },
  avatarUrl: { type: String },
  isProfileComplete: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

export interface IRoom extends Document {
  roomId: string;
  roomTitle: string;
  adminUsername: string;
  team1TotalTime: number;
  team2TotalTime: number;
  warningThresholdSeconds: number;
  registeredRoster: {
    username: string;
    team: TeamId;
    personalizedTime?: number;
  }[];
  createdAt: Date;
}

const RoomSchema = new Schema<IRoom>({
  roomId: { type: String, required: true, unique: true, lowercase: true, trim: true },
  roomTitle: { type: String, required: true },
  adminUsername: { type: String, required: true },
  team1TotalTime: { type: Number, default: 300 },
  team2TotalTime: { type: Number, default: 300 },
  warningThresholdSeconds: { type: Number, default: 10 },
  registeredRoster: [{
    username: String,
    team: String,
    personalizedTime: Number
  }],
  createdAt: { type: Date, default: Date.now }
});

export const UserModel: Model<IUser> = (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema);
export const RoomModel: Model<IRoom> = (mongoose.models.Room as Model<IRoom>) || mongoose.model<IRoom>('Room', RoomSchema);

let isDbConnected = false;

// In-Memory fallback store when MongoDB is not connected
const memoryUsers = new Map<string, {
  oauthId: string;
  email?: string;
  username?: string;
  authProvider: string;
  avatarUrl?: string;
  isProfileComplete: boolean;
  lastLogin: Date;
}>();

export async function initMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('ℹ️ MONGODB_URI not provided. Operating with high-performance memory collections.');
    return false;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    isDbConnected = true;
    console.log('🍃 MongoDB connected successfully!');
    return true;
  } catch (err) {
    console.warn('⚠️ MongoDB connection timeout or error. Falling back to active memory store.', err);
    return false;
  }
}

export function isMongoConnected() {
  return isDbConnected;
}

export async function findUserByOAuthIdOrEmail(oauthId: string, email?: string) {
  if (isDbConnected) {
    const conditions: any[] = [{ oauthId }];
    if (email) conditions.push({ email });
    return UserModel.findOne({ $or: conditions });
  }

  if (memoryUsers.has(oauthId)) {
    return memoryUsers.get(oauthId);
  }
  if (email) {
    for (const user of memoryUsers.values()) {
      if (user.email && user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
  }
  return null;
}

export async function findUserByOAuthId(oauthId: string) {
  return findUserByOAuthIdOrEmail(oauthId);
}

export async function findUserByUsername(username: string) {
  const cleanUsername = username.trim().toLowerCase();
  if (isDbConnected) {
    return UserModel.findOne({ username: cleanUsername });
  }
  for (const user of memoryUsers.values()) {
    if (user.username && user.username.toLowerCase() === cleanUsername) {
      return user;
    }
  }
  return null;
}

export async function createOrUpdateOAuthUser(data: {
  oauthId: string;
  email?: string;
  authProvider: string;
  avatarUrl?: string;
}) {
  if (isDbConnected) {
    const conditions: any[] = [{ oauthId: data.oauthId }];
    if (data.email) conditions.push({ email: data.email });

    let user = await UserModel.findOne({ $or: conditions });
    if (!user) {
      user = new UserModel({
        oauthId: data.oauthId,
        email: data.email,
        authProvider: data.authProvider,
        avatarUrl: data.avatarUrl,
        isProfileComplete: false,
        createdAt: new Date(),
        lastLogin: new Date()
      });
      await user.save();
    } else {
      user.lastLogin = new Date();
      user.oauthId = data.oauthId;
      if (data.avatarUrl) user.avatarUrl = data.avatarUrl;
      if (data.email) user.email = data.email;
      await user.save();
    }
    return user;
  }

  let user = memoryUsers.get(data.oauthId);
  if (!user && data.email) {
    for (const u of memoryUsers.values()) {
      if (u.email && u.email.toLowerCase() === data.email.toLowerCase()) {
        user = u;
        break;
      }
    }
  }

  if (!user) {
    user = {
      oauthId: data.oauthId,
      email: data.email,
      authProvider: data.authProvider,
      avatarUrl: data.avatarUrl,
      isProfileComplete: false,
      lastLogin: new Date()
    };
    memoryUsers.set(data.oauthId, user);
  } else {
    user.lastLogin = new Date();
    user.oauthId = data.oauthId;
    if (data.avatarUrl) user.avatarUrl = data.avatarUrl;
    if (data.email) user.email = data.email;
    memoryUsers.set(data.oauthId, user);
  }
  return user;
}

export async function setUniqueUsername(oauthId: string, desiredUsername: string, email?: string) {
  const cleanUsername = desiredUsername.trim().toLowerCase();

  // Validate format: 3-20 characters, alphanumeric & underscores only
  if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
    throw new Error('Username must be 3-20 characters and contain only letters, numbers, or underscores.');
  }

  // Check if username is already claimed by another user
  const existingUser = await findUserByUsername(cleanUsername);
  if (existingUser && (existingUser as any).oauthId !== oauthId && (!email || (existingUser as any).email !== email)) {
    throw new Error(`The username "@${cleanUsername}" is already taken by another player. Please choose another one.`);
  }

  if (isDbConnected) {
    const conditions: any[] = [{ oauthId }];
    if (email) conditions.push({ email });

    let user = await UserModel.findOne({ $or: conditions });
    if (!user) throw new Error('OAuth user account not found');
    user.username = cleanUsername;
    user.isProfileComplete = true;
    user.oauthId = oauthId;
    await user.save();
    return user;
  }

  let user = memoryUsers.get(oauthId);
  if (!user && email) {
    for (const u of memoryUsers.values()) {
      if (u.email && u.email.toLowerCase() === email.toLowerCase()) {
        user = u;
        break;
      }
    }
  }

  if (!user) throw new Error('OAuth user account not found');
  user.username = cleanUsername;
  user.isProfileComplete = true;
  user.oauthId = oauthId;
  memoryUsers.set(oauthId, user);
  return user;
}

export async function upsertRoom(data: {
  roomId: string;
  roomTitle: string;
  adminUsername: string;
  team1TotalTime: number;
  team2TotalTime: number;
  warningThresholdSeconds: number;
  registeredRoster: { username: string; team: TeamId; personalizedTime?: number }[];
}) {
  if (!isDbConnected) return null;
  return RoomModel.findOneAndUpdate(
    { roomId: data.roomId },
    {
      roomTitle: data.roomTitle,
      adminUsername: data.adminUsername,
      team1TotalTime: data.team1TotalTime,
      team2TotalTime: data.team2TotalTime,
      warningThresholdSeconds: data.warningThresholdSeconds,
      registeredRoster: data.registeredRoster
    },
    { upsert: true, new: true }
  );
}
