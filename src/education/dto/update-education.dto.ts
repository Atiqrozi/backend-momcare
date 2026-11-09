import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateEducationDto } from './create-education.dto';

export class UpdateEducationDto extends PartialType(
  OmitType(CreateEducationDto, ['slug'] as const),
) {}
