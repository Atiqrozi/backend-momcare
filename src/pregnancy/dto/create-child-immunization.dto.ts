import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ChildImmunizationStatus } from '../schemas/child-immunization.schema';

export class CreateChildImmunizationDto {
  @IsString() @MinLength(1) @MaxLength(120) vaccineName!: string;
  @IsOptional() @IsDateString() scheduledDate?: string;
  @IsOptional() @IsDateString() administeredDate?: string;
  @IsOptional() @IsEnum(ChildImmunizationStatus) status?: ChildImmunizationStatus;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
