import { IsMongoId, IsString, MaxLength } from 'class-validator';

export class SignMedicalAttachmentDto {
  @IsMongoId() recordId!: string;
  @IsString() @MaxLength(200) fileId!: string;
}
