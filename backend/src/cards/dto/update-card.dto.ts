import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/** All fields optional — a partial update of an existing card. */
export class UpdateCardDto {
  @IsOptional()
  @IsString()
  bank?: string;

  @IsOptional()
  @IsString()
  cardName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  statementDate?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  paymentDueDate?: number;
}
