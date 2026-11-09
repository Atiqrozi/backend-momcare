import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { VaccinationStatus } from '../schemas/vaccination.schema';

export class CreateVaccinationDto {
  @IsOptional()
  @IsMongoId()
  patientId?: string;

  @IsMongoId()
  facilityId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  vaccineName!: string;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsDateString()
  administeredDate?: string;

  @IsOptional()
  @IsEnum(VaccinationStatus)
  status?: VaccinationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
