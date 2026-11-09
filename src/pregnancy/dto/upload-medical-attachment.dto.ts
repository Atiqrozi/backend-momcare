import { IsIn, IsString, MaxLength, Matches } from 'class-validator';

export class UploadMedicalAttachmentDto {
  @IsIn(['ultrasound', 'laboratory']) kind!: 'ultrasound' | 'laboratory';
  @IsString() @MaxLength(255) name!: string;
  @IsIn(['image/jpeg', 'image/png', 'application/pdf']) mimeType!: string;
  @IsString() @MaxLength(1_500_000)
  @Matches(/^data:(image\/jpeg|image\/png|application\/pdf);base64,[A-Za-z0-9+/]+=*$/)
  dataUrl!: string;
}
