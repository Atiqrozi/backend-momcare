import { IsMongoId } from 'class-validator';

export class AssignProviderDto {
  @IsMongoId()
  providerId!: string;
}
