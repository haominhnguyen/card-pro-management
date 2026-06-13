import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TelegramLinkDocument = TelegramLink & Document;

@Schema({ timestamps: true })
export class TelegramLink {
  // Telegram user/chat id (from ctx.from.id). One chat links to exactly one web user.
  @Prop({ required: true, unique: true })
  telegramId: number;

  // Owning web account (User._id).
  @Prop({ required: true, index: true })
  userId: string;

  // Display name captured at link time (ctx.from.first_name) — for the web UI.
  @Prop()
  telegramName?: string;
}

export const TelegramLinkSchema = SchemaFactory.createForClass(TelegramLink);
