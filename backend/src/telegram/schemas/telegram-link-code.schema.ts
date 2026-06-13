import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TelegramLinkCodeDocument = TelegramLinkCode & Document;

@Schema({ timestamps: true })
export class TelegramLinkCode {
  // One-time code embedded in the t.me deep link (/start <code>).
  @Prop({ required: true, unique: true })
  code: string;

  // Web account that requested the link.
  @Prop({ required: true })
  userId: string;

  // Mongo TTL index below auto-removes the doc once this time passes.
  @Prop({ required: true })
  expiresAt: Date;
}

export const TelegramLinkCodeSchema = SchemaFactory.createForClass(TelegramLinkCode);

// Auto-expire codes exactly at expiresAt.
TelegramLinkCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
