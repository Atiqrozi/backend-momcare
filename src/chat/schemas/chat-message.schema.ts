import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'chatMessages' })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: 'ChatConversation', required: true, index: true })
  conversationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  senderId?: Types.ObjectId;

  @Prop({ required: true, enum: ['PREGNANT_MOTHER', 'MIDWIFE', 'DOCTOR', 'ADMIN', 'ASSISTANT'] })
  senderRole!: string;

  @Prop({ required: true, trim: true, maxlength: 4000 })
  text!: string;

  @Prop({ enum: ['text', 'appointment_reminder', 'appointment_result'], default: 'text', index: true })
  messageType!: 'text' | 'appointment_reminder' | 'appointment_result';

  @Prop({ type: Object })
  payload?: Record<string, unknown>;

  @Prop({ trim: true, maxlength: 300 })
  eventKey?: string;
}

export type ChatMessageDocument = HydratedDocument<ChatMessage>;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ eventKey: 1 }, { unique: true, sparse: true });
