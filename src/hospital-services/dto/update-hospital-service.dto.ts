import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateHospitalServiceDto } from './create-hospital-service.dto';

export class UpdateHospitalServiceDto extends PartialType(
  OmitType(CreateHospitalServiceDto, ['slug'] as const),
) {}
