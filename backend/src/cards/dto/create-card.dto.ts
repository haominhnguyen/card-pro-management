import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateCardDto {
  @IsNotEmpty()
  @IsString()
  bank: string;

  @IsNotEmpty()
  @IsString()
  cardName: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  creditLimit: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(31)
  statementDate: number;
}
