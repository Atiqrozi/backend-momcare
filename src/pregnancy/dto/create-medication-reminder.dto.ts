import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateMedicationReminderDto {
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @IsString() @MinLength(1) @MaxLength(160)
  dosage!: string;

  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time!: string;

  @IsOptional() @IsString() @MaxLength(240)
  notes?: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}
