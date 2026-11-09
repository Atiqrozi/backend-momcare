import { Type } from 'class-transformer';
import { ArrayMaxSize, IsDateString, IsIn, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';

class UltrasoundDetailsDto {
  @IsOptional() @IsString() @MaxLength(100) bpdCm?: string;
  @IsOptional() @IsString() @MaxLength(100) abdominalCircumferenceCm?: string;
  @IsOptional() @IsString() @MaxLength(100) femurLengthCm?: string;
  @IsOptional() @IsString() @MaxLength(100) estimatedFetalWeightGrams?: string;
  @IsOptional() @IsString() @MaxLength(100) amnioticFluidIndexCm?: string;
  @IsOptional() @IsString() @MaxLength(200) placenta?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

class LaboratoryDetailsDto {
  @IsOptional() @IsString() @MaxLength(100) hemoglobin?: string;
  @IsOptional() @IsString() @MaxLength(100) urineProtein?: string;
  @IsOptional() @IsString() @MaxLength(30) urineReduction?: string;
  @IsOptional() @IsString() @MaxLength(100) glucose?: string;
  @IsOptional() @IsString() @MaxLength(300) tripleElimination?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

class TreatmentDetailsDto {
  @IsOptional() @IsString() @MaxLength(200) ironTablets?: string;
  @IsOptional() @IsString() @MaxLength(200) calcium?: string;
  @IsOptional() @IsString() @MaxLength(200) aspirin?: string;
  @IsOptional() @IsString() @MaxLength(500) referral?: string;
}

class MedicalAttachmentDto {
  @IsIn(['ultrasound', 'laboratory']) kind!: 'ultrasound' | 'laboratory';
  @IsString() @MaxLength(255) name!: string;
  @IsIn(['image/jpeg', 'image/png', 'application/pdf']) mimeType!: string;
  @IsUrl({ require_tld: true }) @MaxLength(2000) url!: string;
  @IsOptional() @IsString() @MaxLength(200) fileId?: string;
}

export class MedicalRecordDetailsDto {
  @IsOptional()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => MedicalAttachmentDto)
  attachments?: MedicalAttachmentDto[];
  @IsOptional() @ValidateNested() @Type(() => UltrasoundDetailsDto) ultrasound?: UltrasoundDetailsDto;
  @IsOptional() @ValidateNested() @Type(() => LaboratoryDetailsDto) laboratory?: LaboratoryDetailsDto;
  @IsOptional() @ValidateNested() @Type(() => TreatmentDetailsDto) treatment?: TreatmentDetailsDto;
  @IsOptional() @IsString() @MaxLength(500) deliveryRecommendation?: string;
  @IsOptional() @IsString() @MaxLength(1000) preeclampsiaAssessment?: string;
  @IsOptional() @IsString() @MaxLength(2000) consultationNote?: string;
  @IsOptional() @IsString() @MaxLength(2000) educationAdvice?: string;
  @IsOptional() @IsDateString() nextVisitDate?: string;
}
