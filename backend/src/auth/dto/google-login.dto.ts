import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  // The Google Identity Services ID token (JWT credential) from the frontend.
  @IsNotEmpty()
  @IsString()
  idToken: string;
}
