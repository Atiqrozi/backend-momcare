import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'auditLogs' })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorId?: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100 })
  action!: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  resourceType!: string;

  @Prop({ trim: true, maxlength: 100 })
  resourceId?: string;

  @Prop({ required: true, type: Date, index: true })
  timestamp!: Date;

  @Prop({ required: true, trim: true, maxlength: 100 })
  requestId!: string;

  @Prop({ type: Object })
  metadata?: Record<string, string>;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
