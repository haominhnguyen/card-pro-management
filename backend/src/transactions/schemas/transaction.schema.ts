import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TransactionDocument = Transaction & Document;

@Schema({ timestamps: true })
export class Transaction {
  // Owner of this transaction (User._id). Scopes all reads/writes to the signed-in user.
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  bank: string;

  // Specific card this transaction belongs to (optional; bot omits it).
  @Prop()
  cardName: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, default: Date.now })
  date: Date;

  @Prop({ required: true, enum: ['expense', 'income'], default: 'expense' })
  type: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

