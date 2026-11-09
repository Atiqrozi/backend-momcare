import { IsEmail, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '../schemas/user.schema';

export class CreateStaffUserDto {
  @IsString() @IsNotEmpty() @MaxLength(120) fullName!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsEnum(Role) role!: Exclude<Role, Role.PREGNANT_MOTHER>;
  @IsOptional() @IsMongoId() facilityId?: string;
}
