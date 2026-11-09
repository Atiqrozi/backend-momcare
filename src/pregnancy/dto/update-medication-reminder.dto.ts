import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateMedicationReminderDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(160)
  dosage?: string;

  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time?: string;

  @IsOptional() @IsString() @MaxLength(240)
  notes?: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}
