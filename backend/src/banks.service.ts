import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bank, BankDocument } from './bank.schema';
import { CreateBankDto } from './create-bank.dto';
import { UpdateBankDto } from './update-bank.dto';
import { VIETNAMESE_BANKS } from './banks.seed';

@Injectable()
export class BanksService implements OnModuleInit {
  private readonly logger = new Logger(BanksService.name);

  constructor(@InjectModel(Bank.name) private bankModel: Model<BankDocument>) {}

  // Keep the bank catalogue in sync on every boot: upsert by code so new banks
  // and updated card lines / logos are applied without wiping user data.
  async onModuleInit(): Promise<void> {
    try {
      const ops = VIETNAMESE_BANKS.map((bank) => ({
        updateOne: {
          filter: { code: bank.code },
          update: { $set: { ...bank, isActive: true } },
          upsert: true,
        },
      }));
      const result = await this.bankModel.bulkWrite(ops);
      const upserted = result.upsertedCount ?? 0;
      const modified = result.modifiedCount ?? 0;

      // Prune stale entries no longer in the catalogue (e.g. renamed bank codes)
      // so the picker never shows duplicates.
      const codes = VIETNAMESE_BANKS.map((b) => b.code);
      const pruned = await this.bankModel.deleteMany({ code: { $nin: codes } }).exec();

      this.logger.log(
        `Bank catalogue synced: ${upserted} added, ${modified} updated, ${pruned.deletedCount ?? 0} pruned (${VIETNAMESE_BANKS.length} total)`,
      );
    } catch (error) {
      // Don't block app startup if the DB is unreachable at boot.
      this.logger.warn(
        `Bank auto-seed skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async create(createBankDto: CreateBankDto): Promise<Bank> {
    const created = new this.bankModel(createBankDto);
    return created.save();
  }

  async findAll(query?: { search?: string; cardBrand?: string }) {
    let find = this.bankModel.find({ isActive: true });

    if (query?.search) {
      find = find.or([
        { name: { $regex: query.search, $options: 'i' } },
        { fullName: { $regex: query.search, $options: 'i' } },
        { code: { $regex: query.search, $options: 'i' } },
      ]);
    }

    if (query?.cardBrand) {
      find = find.where('cardBrands').in([query.cardBrand]);
    }

    return find.sort({ name: 1 }).exec();
  }

  async findOne(code: string): Promise<Bank | null> {
    return this.bankModel.findOne({ code, isActive: true }).exec();
  }

  async update(code: string, updateBankDto: UpdateBankDto): Promise<Bank | null> {
    return this.bankModel
      .findOneAndUpdate({ code }, updateBankDto, { new: true })
      .exec();
  }

  async remove(code: string): Promise<void> {
    await this.bankModel.updateOne({ code }, { isActive: false }).exec();
  }

  async seed(banks: CreateBankDto[]): Promise<void> {
    await this.bankModel.insertMany(banks);
  }

  async getByCardBrand(cardBrand: string): Promise<Bank[]> {
    return this.bankModel
      .find({ cardBrands: cardBrand, isActive: true })
      .sort({ name: 1 })
      .exec();
  }
}
