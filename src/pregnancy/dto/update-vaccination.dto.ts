import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateVaccinationDto } from './create-vaccination.dto';

export class UpdateVaccinationDto extends PartialType(
  OmitType(CreateVaccinationDto, ['patientId'] as const),
) {}
