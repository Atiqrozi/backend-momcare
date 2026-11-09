import { IsDateString, IsEnum, IsIn, IsMongoId, IsOptional } from 'class-validator';
import { LaborBagDeliveryType } from '../schemas/labor-bag.schema';

export class UpsertLaborBagDto {
  @IsMongoId()
  patientId!: string;

  @IsDateString()
  examinationDate!: string;

  @IsOptional()
  @IsIn(['BPJS', 'UMUM'])
  insuranceType?: 'BPJS' | 'UMUM';

  @IsOptional()
  @IsDateString()
  estimatedDueDate?: string;

  @IsEnum(LaborBagDeliveryType)
  deliveryType!: LaborBagDeliveryType;

  @IsMongoId()
  providerId!: string;
}
