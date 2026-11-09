import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { PregnancyStatus } from '../schemas/pregnancy-profile.schema';

export class UpsertPregnancyProfileDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{16}$/)
  nik?: string;

  @IsOptional()
  @IsIn(['BPJS', 'UMUM'])
  insuranceType?: 'BPJS' | 'UMUM';

  @ValidateIf((dto: UpsertPregnancyProfileDto) => dto.insuranceType === 'BPJS')
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{13}$/)
  bpjsNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  birthplace?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  education?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(A|B|AB|O)[+-]$/)
  bloodType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  medicalHistory?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  lmpDate?: string;

  @ApiPropertyOptional({ example: '2026-10-22' })
  @IsOptional()
  @IsDateString()
  estimatedDueDate?: string;

  @ApiPropertyOptional({ enum: PregnancyStatus })
  @IsOptional()
  @IsEnum(PregnancyStatus)
  pregnancyStatus?: PregnancyStatus;
}
