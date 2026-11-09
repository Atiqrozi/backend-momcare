import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RetryNotificationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxAttempts?: number;
}
