import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  // 6-digit one-time code from the email.
  @IsString()
  @Length(6, 6)
  otp: string;

  @IsString()
  @MinLength(8)
  password: string;
}
