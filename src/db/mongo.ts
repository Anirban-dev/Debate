import mongoose, { Schema, Document, Model } from 'mongoose';
import { TeamId } from '../types';

export interface IUser extends Document {
  username: string;
  authProvider: string;
  createdAt: Date;
  lastLogin: Date;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  authProvider: { type: String, default: 'direct' },
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

export async function initMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('ℹ️ MONGODB_URI not provided. Operating with high-performance MongoDB memory collections.');
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

export async function upsertUser(username: string, authProvider: string) {
  if (!isDbConnected) return null;
  return UserModel.findOneAndUpdate(
    { username },
    { authProvider, lastLogin: new Date() },
    { upsert: true, new: true }
  );
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
