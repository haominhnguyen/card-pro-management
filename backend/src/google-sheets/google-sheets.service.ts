import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private sheets: any;
  private spreadsheetId: string | undefined;
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    this.spreadsheetId = this.configService.get<string>('GOOGLE_SPREADSHEET_ID');
    const credentialsPath = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
    
    // Only initialize if credentials are configured
    if (credentialsPath) {
      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: credentialsPath,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        this.sheets = google.sheets({ version: 'v4', auth });
        this.isConfigured = true;
        this.logger.log('Google Sheets integration enabled');
      } catch (error) {
        this.logger.warn('Google Sheets Auth initialization failed. Google Sheets sync disabled.', error.message);
        this.isConfigured = false;
      }
    } else {
      this.logger.warn('GOOGLE_APPLICATION_CREDENTIALS not set. Google Sheets sync disabled.');
      this.isConfigured = false;
    }
  }

  async appendRow(transaction: any) {
    if (!this.isConfigured || !this.sheets || !this.spreadsheetId) {
      this.logger.debug('Google Sheets is not configured. Skipping appendRow.');
      return;
    }

    try {
      const values = [
        [
          new Date(transaction.date).toLocaleString('vi-VN'),
          transaction.amount,
          transaction.bank,
          transaction.category,
          transaction.description,
          transaction.type,
        ],
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Sheet1!A:F',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
      this.logger.log('Row appended to Google Sheets successfully.');
    } catch (error) {
      this.logger.error('Error appending row to Google Sheets:', error.message);
    }
  }
}

