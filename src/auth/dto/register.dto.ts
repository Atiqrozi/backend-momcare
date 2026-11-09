import { IsBoolean, IsDateString, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MinLength, MaxLength, ValidateIf } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsBoolean()
  consentGranted!: boolean;

  @IsString()
  @Matches(/^\d{16}$/)
  nik!: string;

  @IsIn(['BPJS', 'UMUM'])
  insuranceType!: 'BPJS' | 'UMUM';

  @ValidateIf((dto: RegisterDto) => dto.insuranceType === 'BPJS')
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{13}$/)
  bpjsNumber?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  birthplace!: string;

  @IsDateString()
  birthDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  education?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(A|B|AB|O)[+-]$/)
  bloodType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  medicalHistory?: string;

  @IsOptional()
  @IsDateString()
  lmpDate?: string;
}
