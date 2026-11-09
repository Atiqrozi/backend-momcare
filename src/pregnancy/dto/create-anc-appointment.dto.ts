import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  IsIn,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAncAppointmentDto {
  @IsMongoId()
  patientId!: string;

  @IsOptional()
  @IsMongoId()
  providerId?: string;

  @IsMongoId()
  facilityId!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(10080)
  reminderMinutesBefore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  visitType?: string;

  @IsOptional()
  @IsIn(['BPJS', 'UMUM'])
  insuranceType?: 'BPJS' | 'UMUM';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
