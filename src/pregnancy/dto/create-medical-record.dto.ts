import { Type } from 'class-transformer';
import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MedicalMeasurementsDto } from './medical-measurements.dto';
import { MedicalRecordDetailsDto } from './medical-record-details.dto';

export class CreateMedicalRecordDto {
  @IsOptional()
  @IsMongoId()
  patientId?: string;

  @IsDateString()
  recordDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  recordType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  summary!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MedicalMeasurementsDto)
  measurements?: MedicalMeasurementsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MedicalRecordDetailsDto)
  details?: MedicalRecordDetailsDto;
}
