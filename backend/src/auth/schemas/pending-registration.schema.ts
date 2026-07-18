import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PendingRegistrationDocument = PendingRegistration & Document;

/**
 * A sign-up awaiting email verification. The real User is NOT created until the
 * OTP is confirmed — so an unverified email never occupies a real account and can
 * always be re-registered. One doc per email (upserted); auto-expires via TTL.
 */
@Schema({ timestamps: true })
export class PendingRegistration {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  name: string;

  // Password is already bcrypt-hashed before being parked here.
  @Prop({ required: true })
  passwordHash: string;

  // bcrypt hash of the 6-digit OTP — never store the plaintext code.
  @Prop({ required: true })
  codeHash: string;

  // Wrong-attempt counter; the pending sign-up is burned once this hits the limit.
  @Prop({ default: 0 })
  attempts: number;

  // Mongo TTL index (below) auto-removes the doc once this time passes.
  @Prop({ required: true })
  expiresAt: Date;
}

export const PendingRegistrationSchema = SchemaFactory.createForClass(PendingRegistration);

// Auto-expire the pending sign-up exactly at expiresAt.
PendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
