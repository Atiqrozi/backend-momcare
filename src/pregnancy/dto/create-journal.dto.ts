import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsOptional, IsString, MaxLength, ArrayMaxSize } from 'class-validator';

export class CreateJournalDto {
  @IsDateString()
  entryDate!: string;

  @ApiPropertyOptional({ example: 'Baik' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mood?: string;

  @ApiPropertyOptional({ example: ['mual', 'lelah'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  symptoms?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
