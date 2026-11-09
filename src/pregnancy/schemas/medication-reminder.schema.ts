import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'medicationReminders' })
export class MedicationReminder {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, trim: true, maxlength: 160 })
  dosage!: string;

  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  time!: string;

  @Prop({ trim: true, maxlength: 240 })
  notes?: string;

  @Prop({ default: true })
  active!: boolean;
}

export type MedicationReminderDocument = HydratedDocument<MedicationReminder>;
export const MedicationReminderSchema = SchemaFactory.createForClass(MedicationReminder);
