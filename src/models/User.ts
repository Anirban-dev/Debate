import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  oauthId: string;
  email?: string;
  username: string;
  createdAt: Date;
  lastLogin: Date;
}

const UserSchema = new Schema<IUser>({
  oauthId: { type: String, required: true, index: true },
  email: { type: String },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

export const UserModel: Model<IUser> = (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema);
export default UserModel;
