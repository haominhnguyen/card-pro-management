import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async create(
    @Body() createTransactionDto: CreateTransactionDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.transactionsService.create(createTransactionDto, userId);
  }

  @Get()
  async findAll(@CurrentUser('userId') userId: string, @Query('bank') bank?: string) {
    return this.transactionsService.findAll(userId, bank);
  }

  @Get('stats')
  async getStats(@CurrentUser('userId') userId: string, @Query('bank') bank?: string) {
    return this.transactionsService.getStats(userId, bank);
  }

  @Get('stats/by-category')
  async getByCategory(@CurrentUser('userId') userId: string) {
    return this.transactionsService.getByCategory(userId);
  }

  @Get('stats/monthly')
  async getMonthly(@CurrentUser('userId') userId: string, @Query('months') months?: string) {
    return this.transactionsService.getMonthly(userId, months ? parseInt(months, 10) : 6);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.transactionsService.update(id, dto, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.transactionsService.remove(id, userId);
  }
}
