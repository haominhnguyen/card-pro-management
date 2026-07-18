import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PasswordResetDocument = PasswordReset & Document;

/**
 * A pending password-reset request. One active doc per email (upserted) — a new
 * request overwrites the previous code. The OTP is stored ONLY as a bcrypt hash.
 */
@Schema({ timestamps: true })
export class PasswordReset {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // bcrypt hash of the 6-digit OTP — never store the plaintext code.
  @Prop({ required: true })
  codeHash: string;

  // Wrong-attempt counter; the code is burned once this hits the limit.
  @Prop({ default: 0 })
  attempts: number;

  // Mongo TTL index (below) auto-removes the doc once this time passes.
  @Prop({ required: true })
  expiresAt: Date;
}

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);

// Auto-expire the reset request exactly at expiresAt.
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
