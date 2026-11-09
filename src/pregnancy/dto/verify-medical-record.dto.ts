import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyMedicalRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
