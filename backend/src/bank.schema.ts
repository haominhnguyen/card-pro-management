import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BankDocument = Bank & Document;

@Schema({ timestamps: true })
export class Bank {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  fullName: string;

  @Prop()
  logo: string;

  @Prop()
  color: string;

  @Prop()
  description: string;

  @Prop()
  website: string;

  @Prop()
  hotline: string;

  @Prop({ type: [String], default: [] })
  cardBrands: string[];

  // Credit-card product lines offered by this bank (e.g. "VPBank StepUp").
  @Prop({ type: [String], default: [] })
  creditCards: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const BankSchema = SchemaFactory.createForClass(Bank);
