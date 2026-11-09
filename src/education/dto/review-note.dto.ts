import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReviewNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note!: string;
}
