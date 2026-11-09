import { IsEnum } from 'class-validator';
import { HospitalServiceStatus } from '../schemas/hospital-service.schema';

export class PublishHospitalServiceDto {
  @IsEnum(HospitalServiceStatus)
  status!: HospitalServiceStatus;
}
