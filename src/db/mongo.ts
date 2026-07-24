import mongoose from 'mongoose';
import UserModel, { IUser } from '@/models/User';

export { UserModel, type IUser };

let isDbConnected = false;

export async function initMongoDB() {
  if (isDbConnected) return true;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI not provided. Set MONGODB_URI in environment variables.');
    return false;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    isDbConnected = true;
    console.log('🍃 MongoDB connected successfully!');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    return false;
  }
}

export function isMongoConnected() {
  return isDbConnected;
}

export async function findUserByOAuthIdOrEmail(oauthId: string, email?: string) {
  const conditions: any[] = [{ oauthId }];
  if (email) conditions.push({ email });
  return UserModel.findOne({ $or: conditions });
}

export async function findUserByUsername(username: string) {
  const cleanUsername = username.trim().toLowerCase();
  return UserModel.findOne({ username: cleanUsername });
}

export async function saveCompleteUser(oauthId: string, desiredUsername: string, email?: string) {
  const cleanUsername = desiredUsername.trim().toLowerCase();

  // Validate format: 3-20 characters, alphanumeric & underscores only
  if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
    throw new Error('Username must be 3-20 characters and contain only letters, numbers, or underscores.');
  }

  // Check if username is already claimed by another user
  const existingUser = await findUserByUsername(cleanUsername);
  if (existingUser && existingUser.oauthId !== oauthId && (!email || existingUser.email !== email)) {
    throw new Error(`The username "@${cleanUsername}" is already taken by another player. Please choose another one.`);
  }

  const conditions: any[] = [{ oauthId }];
  if (email) conditions.push({ email });

  let user = await UserModel.findOne({ $or: conditions });
  if (!user) {
    user = new UserModel({
      oauthId,
      email,
      username: cleanUsername,
      createdAt: new Date(),
      lastLogin: new Date()
    });
  } else {
    user.username = cleanUsername;
    user.oauthId = oauthId;
    if (email) user.email = email;
    user.lastLogin = new Date();
  }

  await user.save();
  return user;
}
