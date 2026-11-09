import { IsEnum, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChatKind } from '../schemas/chat-conversation.schema';

export class CreateConversationDto {
  @IsEnum(ChatKind)
  kind!: ChatKind;

  @IsOptional()
  @IsMongoId()
  participantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}
