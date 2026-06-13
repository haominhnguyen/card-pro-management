import { Controller, Get, Post, Put, Delete, Param, Body, Query, Logger } from '@nestjs/common';
import { BanksService } from './banks.service';
import { CreateBankDto } from './create-bank.dto';
import { UpdateBankDto } from './update-bank.dto';

@Controller('banks')
export class BanksController {
  private logger = new Logger(BanksController.name);

  constructor(private banksService: BanksService) {}

  @Get()
  async findAll(@Query('search') search?: string, @Query('cardBrand') cardBrand?: string) {
    this.logger.debug(`Finding banks with search="${search}", cardBrand="${cardBrand}"`);
    return this.banksService.findAll({ search, cardBrand });
  }

  @Get('brand/:cardBrand')
  async getByCardBrand(@Param('cardBrand') cardBrand: string) {
    this.logger.debug(`Finding banks by card brand: ${cardBrand}`);
    return this.banksService.getByCardBrand(cardBrand);
  }

  @Get(':code')
  async findOne(@Param('code') code: string) {
    this.logger.debug(`Finding bank with code: ${code}`);
    return this.banksService.findOne(code);
  }

  @Post()
  async create(@Body() createBankDto: CreateBankDto) {
    this.logger.log(`Creating new bank: ${createBankDto.code}`);
    return this.banksService.create(createBankDto);
  }

  @Put(':code')
  async update(@Param('code') code: string, @Body() updateBankDto: UpdateBankDto) {
    this.logger.log(`Updating bank: ${code}`);
    return this.banksService.update(code, updateBankDto);
  }

  @Delete(':code')
  async remove(@Param('code') code: string) {
    this.logger.log(`Deleting bank: ${code}`);
    await this.banksService.remove(code);
    return { message: `Bank ${code} deleted` };
  }

  @Post('seed')
  async seed(@Body() banks: CreateBankDto[]) {
    this.logger.log(`Seeding ${banks.length} banks`);
    await this.banksService.seed(banks);
    return { message: `${banks.length} banks seeded` };
  }
}
