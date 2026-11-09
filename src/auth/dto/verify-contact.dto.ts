import { IsString, Length } from 'class-validator';

export class VerifyContactDto {
  @IsString()
  @Length(32, 128)
  token!: string;
}
