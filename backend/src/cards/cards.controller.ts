import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  async create(@Body() createCardDto: CreateCardDto, @CurrentUser('userId') userId: string) {
    return this.cardsService.create(createCardDto, userId);
  }

  @Get()
  async findAll(@CurrentUser('userId') userId: string) {
    return this.cardsService.findAll(userId);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.cardsService.findById(id, userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCardDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.cardsService.update(id, dto, userId);
  }

  @Delete(':id')
  async deleteById(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.cardsService.deleteById(id, userId);
  }
}
