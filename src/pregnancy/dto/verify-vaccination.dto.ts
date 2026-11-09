import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyVaccinationDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
