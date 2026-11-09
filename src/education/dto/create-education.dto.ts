import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateEducationDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) slug!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) summary!: string;
  @IsString() @IsNotEmpty() @MaxLength(20000) body!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) category!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) sourceTitle!: string;
  @IsOptional() @IsUrl() @MaxLength(1000) sourceUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) sourceVersion?: string;
}
