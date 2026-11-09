import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum ChatKind { AI = 'AI', CARE_TEAM = 'CARE_TEAM' }

@Schema({ timestamps: true, collection: 'chatConversations' })
export class ChatConversation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  providerId?: Types.ObjectId;

  @Prop({ enum: ChatKind, required: true })
  kind!: ChatKind;

  @Prop({ trim: true, maxlength: 120 })
  title?: string;

  @Prop({ type: Date, default: Date.now, index: true })
  lastMessageAt!: Date;
}

export type ChatConversationDocument = HydratedDocument<ChatConversation>;
export const ChatConversationSchema = SchemaFactory.createForClass(ChatConversation);
