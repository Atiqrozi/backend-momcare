import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  refreshToken!: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  refreshToken?: string;
}
