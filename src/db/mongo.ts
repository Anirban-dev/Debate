import mongoose from 'mongoose';
import UserModel, { IUser } from '@/models/User';

export { UserModel, type IUser };

// Use a cached connection so serverless hot-reloads and multiple
// Next.js route handlers share the same underlying TCP connection.
// The flag is checked against the live Mongoose readyState so a
// stale process-level variable can never hide a real disconnection.
let connectionPromise: Promise<boolean> | null = null;

export async function initMongoDB(): Promise<boolean> {
  // Already connected and Mongoose agrees
  if (mongoose.connection.readyState === 1) return true;

  // If a connection attempt is already in flight, await it
  if (connectionPromise) return connectionPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI not provided. Set MONGODB_URI in environment variables.');
    return false;
  }

  connectionPromise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
    })
    .then(() => {
      console.log('🍃 MongoDB connected successfully!');
      return true as boolean;
    })
    .catch((err) => {
      console.error('❌ MongoDB connection failed:', err);
      return false as boolean;
    })
    .finally(() => {
      // Allow future calls to retry if connection failed
      if (mongoose.connection.readyState !== 1) {
        connectionPromise = null;
      }
    });

  return connectionPromise;
}

export function isMongoConnected() {
  return mongoose.connection.readyState === 1;
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
