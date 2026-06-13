import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getStatus() {
    return {
      status: 'ok',
      message: 'Credit Card Management System API',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: 'http://localhost:3000/health',
        root: 'http://localhost:3000/api',
        cards: 'http://localhost:3000/api/cards',
        transactions: 'http://localhost:3000/api/transactions',
        stats: 'http://localhost:3000/api/transactions/stats',
      },
    };
  }
}
