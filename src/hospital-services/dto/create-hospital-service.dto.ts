import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateHospitalServiceDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) slug!: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) description!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) department!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) addressOrLocation!: string;
  @IsOptional() @IsString() @MaxLength(30) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(1000) operatingHours?: string;
  @IsOptional() @IsString() @MaxLength(2000) instructions?: string;
}
