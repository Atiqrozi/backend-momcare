import { IsArray, IsIn, IsInt, IsMongoId, IsNumber, IsOptional, Max, Min } from 'class-validator';

export const MATERNAL_WARNING_SIGNS = [
  'severe_headache',
  'visual_changes',
  'upper_abdominal_pain',
  'shortness_of_breath',
] as const;

export class AssessRiskDto {
  @IsMongoId()
  patientId!: string;

  @IsNumber()
  @Min(40)
  @Max(300)
  systolicMmHg!: number;

  @IsNumber()
  @Min(20)
  @Max(200)
  diastolicMmHg!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  urineProteinPlus?: number;

  @IsOptional()
  @IsArray()
  @IsIn(MATERNAL_WARNING_SIGNS, { each: true })
  warningSigns?: string[];
}
