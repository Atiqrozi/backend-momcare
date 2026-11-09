import { IsMongoId } from 'class-validator';

export class AssignFacilityDto {
  @IsMongoId()
  facilityId!: string;
}
