import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class MedicalMeasurementsDto {
  @ApiPropertyOptional({ minimum: 40, maximum: 250 })
  @IsOptional()
  @IsNumber()
  @Min(40)
  @Max(250)
  heightCm?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  weightKg?: number;

  @ApiPropertyOptional({ minimum: 40, maximum: 300 })
  @IsOptional()
  @IsNumber()
  @Min(40)
  @Max(300)
  systolicMmHg?: number;

  @ApiPropertyOptional({ minimum: 20, maximum: 200 })
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(200)
  diastolicMmHg?: number;

  @ApiPropertyOptional({ minimum: 20, maximum: 250 })
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(250)
  pulseBpm?: number;

  @ApiPropertyOptional({ minimum: 5, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(100)
  lilaCm?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tfuCm?: number;

  @ApiPropertyOptional({ minimum: 40, maximum: 300 })
  @IsOptional()
  @IsNumber()
  @Min(40)
  @Max(300)
  fetalHeartRateBpm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nutritionStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tetanusStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fetalPresentation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fetalMovement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  edema?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  conjunctiva?: string;
}
