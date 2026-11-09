import { IsDateString, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateChildGrowthRecordDto {
  @IsDateString()
  measuredAt!: string;

  @IsNumber() @Min(0.3) @Max(80)
  weightKg!: number;

  @IsNumber() @Min(20) @Max(150)
  heightCm!: number;

  @IsOptional() @IsNumber() @Min(15) @Max(70)
  headCircumferenceCm?: number;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}
