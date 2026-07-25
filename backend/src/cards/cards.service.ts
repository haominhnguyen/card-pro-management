import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Card, CardDocument } from './schemas/card.schema';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';

@Injectable()
export class CardsService implements OnModuleInit {
  private readonly logger = new Logger(CardsService.name);

  constructor(@InjectModel(Card.name) private cardModel: Model<CardDocument>) {}

  // Reconcile indexes so the obsolete unique index on `bank` (one-card-per-bank)
  // is dropped in favour of the (bank + cardName) compound unique index.
  async onModuleInit(): Promise<void> {
    try {
      await this.cardModel.syncIndexes();
      this.logger.log('Card indexes synced (multiple cards per bank enabled)');
    } catch (error) {
      this.logger.warn(
        `Card index sync skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async create(createCardDto: CreateCardDto, userId: string): Promise<Card> {
    try {
      const createdCard = new this.cardModel({ ...createCardDto, userId });
      return await createdCard.save();
    } catch (error: any) {
      // Duplicate (bank + cardName) — surface as 409 instead of a generic 500.
      if (error?.code === 11000) {
        throw new ConflictException(
          `Thẻ "${createCardDto.cardName}" của ${createCardDto.bank} đã tồn tại`,
        );
      }
      throw error;
    }
  }

  async findAll(userId: string): Promise<Card[]> {
    return this.cardModel.find({ userId }).exec();
  }

  async findById(id: string, userId: string): Promise<Card | null> {
    return this.cardModel.findOne({ _id: id, userId }).exec();
  }

  async findByBank(bank: string, userId: string): Promise<Card | null> {
    // case insensitive search
    return this.cardModel
      .findOne({ userId, bank: new RegExp('^' + bank + '$', 'i') })
      .exec();
  }

  async update(id: string, dto: UpdateCardDto, userId: string): Promise<Card> {
    try {
      const updated = await this.cardModel
        .findOneAndUpdate({ _id: id, userId }, { $set: dto }, { new: true, runValidators: true })
        .exec();
      if (!updated) {
        throw new NotFoundException('Không tìm thấy thẻ');
      }
      return updated;
    } catch (error: any) {
      // Duplicate (bank + cardName) after rename — surface as 409.
      if (error?.code === 11000) {
        throw new ConflictException(
          `Thẻ "${dto.cardName ?? ''}" của ${dto.bank ?? ''} đã tồn tại`,
        );
      }
      throw error;
    }
  }

  async deleteById(id: string, userId: string): Promise<Card | null> {
    return this.cardModel.findOneAndDelete({ _id: id, userId }).exec();
  }
}
