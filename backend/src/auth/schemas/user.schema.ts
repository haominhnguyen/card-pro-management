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
  @Prop({ required: true, select: false })
  passwordHash: string;

  // bcrypt hash of the currently-valid refresh token (rotation + revoke). Hidden by default.
  @Prop({ select: false })
  refreshTokenHash?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
