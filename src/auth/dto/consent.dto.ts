import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class ConsentDto {
  @IsBoolean()
  granted!: boolean;

  @IsString()
  @MaxLength(50)
  version!: string;
}
