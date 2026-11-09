import { OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateAncAppointmentDto } from './create-anc-appointment.dto';
import { AncAppointmentStatus } from '../schemas/anc-appointment.schema';

export class UpdateAncAppointmentDto extends PartialType(
  OmitType(CreateAncAppointmentDto, ['patientId'] as const),
) {
  @IsOptional()
  @IsEnum(AncAppointmentStatus)
  status?: AncAppointmentStatus;
}
