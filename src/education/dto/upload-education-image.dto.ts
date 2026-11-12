import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UploadEducationImageDto {
  @IsString() @IsNotEmpty() @MaxLength(255)
  name!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  mimeType!: string;

  @IsString() @IsNotEmpty() @MaxLength(1_500_000)
  dataUrl!: string;
}
