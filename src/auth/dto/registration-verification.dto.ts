import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class RegistrationVerificationDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class PhoneRegistrationVerificationDto {
  @IsString()
  @MaxLength(30)
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ResendRegistrationVerificationDto {
  @IsEmail()
  email!: string;
}
