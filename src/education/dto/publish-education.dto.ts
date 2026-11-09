import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishEducationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceVersion?: string;
}
