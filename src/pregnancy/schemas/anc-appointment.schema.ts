import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum AncAppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  MISSED = 'missed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled',
}

@Schema({ timestamps: true, collection: 'ancAppointments' })
export class AncAppointment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  providerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Facility', required: true })
  facilityId!: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  scheduledAt!: Date;

  @Prop({ required: true, default: 1440, min: 5, max: 10080 })
  reminderMinutesBefore!: number;

  @Prop({ type: Date, index: true })
  chatReminderFor?: Date;

  @Prop({ enum: AncAppointmentStatus, required: true, default: AncAppointmentStatus.SCHEDULED })
  status!: AncAppointmentStatus;

  @Prop({ trim: true, maxlength: 100 })
  visitType?: string;

  @Prop({ enum: ['BPJS', 'UMUM'] })
  insuranceType?: 'BPJS' | 'UMUM';

  @Prop({ trim: true, maxlength: 1000 })
  notes?: string;

  @Prop({ type: [Object], default: [] })
  rescheduleHistory?: Array<{ previousScheduledAt: Date; scheduledAt: Date; changedAt: Date; changedBy: Types.ObjectId; source: string }>;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;
}

export type AncAppointmentDocument = HydratedDocument<AncAppointment>;
export const AncAppointmentSchema = SchemaFactory.createForClass(AncAppointment);
