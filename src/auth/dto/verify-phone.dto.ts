import { IsString, Length } from 'class-validator';

export class VerifyPhoneDto {
  @IsString()
  @Length(32, 128)
  token!: string;
}
