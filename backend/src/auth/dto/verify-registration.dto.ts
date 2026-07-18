import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyRegistrationDto {
  @IsEmail()
  email: string;

  // 6-digit one-time code from the verification email.
  @IsString()
  @Length(6, 6)
  otp: string;
}
