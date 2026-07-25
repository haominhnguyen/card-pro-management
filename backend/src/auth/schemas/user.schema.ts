import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  name: string;

  // Never returned by default — explicitly .select('+passwordHash') when needed.
  // Optional: OAuth-only accounts (Google) have no password.
  @Prop({ select: false })
  passwordHash?: string;

  // Google account id (sub) for accounts linked to / created via Google SSO.
  @Prop({ index: true, sparse: true })
  googleId?: string;

  // Profile picture URL from the OAuth provider (optional).
  @Prop()
  avatarUrl?: string;

  // bcrypt hash of the currently-valid refresh token (rotation + revoke). Hidden by default.
  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
