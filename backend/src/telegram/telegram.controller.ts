import { Controller, Delete, Get, Post } from '@nestjs/common';
import { TelegramLinkService } from './telegram-link.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly linkService: TelegramLinkService) {}

  @Post('link-code')
  async createLinkCode(@CurrentUser('userId') userId: string) {
    return this.linkService.createLinkCode(userId);
  }

  @Get('status')
  async status(@CurrentUser('userId') userId: string) {
    return this.linkService.getStatus(userId);
  }

  @Delete('link')
  async unlink(@CurrentUser('userId') userId: string) {
    await this.linkService.unlink(userId);
    return { success: true };
  }
}
