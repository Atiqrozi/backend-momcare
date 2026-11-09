import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum NotificationChannel {
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
  IN_APP = 'in_app',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AncAppointment', required: true, index: true })
  appointmentId!: Types.ObjectId;

  @Prop({ enum: NotificationChannel, required: true, default: NotificationChannel.WHATSAPP })
  channel!: NotificationChannel;

  @Prop({ required: true, type: Date, index: true })
  scheduledAt!: Date;

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ enum: NotificationStatus, required: true, default: NotificationStatus.PENDING })
  status!: NotificationStatus;

  @Prop({ maxlength: 200 })
  providerMessageId?: string;

  @Prop({ required: true, default: 0 })
  attemptCount!: number;

  @Prop({ maxlength: 500 })
  lastError?: string;

  @Prop({ required: true, unique: true, index: true })
  idempotencyKey!: string;

  @Prop({ required: true, maxlength: 500 })
  message!: string;

  @Prop({ required: true, trim: true, maxlength: 30 })
  recipientPhone!: string;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
