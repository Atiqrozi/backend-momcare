import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { AccountStatus, Role } from '../schemas/user.schema';

export class UpdateUserAdminDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @IsOptional()
  @IsMongoId()
  facilityId?: string;
}
