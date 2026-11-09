import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertChildProfileDto {
  @IsString() @MinLength(1) @MaxLength(120)
  fullName!: string;

  @IsDateString()
  birthDate!: string;

  @IsOptional() @IsIn(['male', 'female', 'unspecified'])
  sex?: 'male' | 'female' | 'unspecified';

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}
