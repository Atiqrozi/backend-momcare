import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RescheduleAncAppointmentDto {
  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
