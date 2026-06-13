import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CardDocument = Card & Document;

@Schema({ timestamps: true })
export class Card {
  // Owner of this card (User._id). Scopes all reads/writes to the signed-in user.
  @Prop({ required: true, index: true })
  userId: string;

  // A bank can hold several cards; uniqueness is per (userId + bank + cardName) below.
  @Prop({ required: true })
  bank: string;

  @Prop({ required: true })
  cardName: string;

  @Prop({ required: true })
  creditLimit: number;

  @Prop({ required: true, min: 1, max: 31 })
  statementDate: number;
}

export const CardSchema = SchemaFactory.createForClass(Card);

// Allow multiple cards per bank, but block exact duplicates per user (bank + card type).
CardSchema.index({ userId: 1, bank: 1, cardName: 1 }, { unique: true });
