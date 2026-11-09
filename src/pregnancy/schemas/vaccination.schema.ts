import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum VaccinationStatus {
  PLANNED = 'planned',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true, collection: 'vaccinations' })
export class Vaccination {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  vaccineName!: string;

  @Prop({ type: Date })
  scheduledDate?: Date;

  @Prop({ type: Date })
  administeredDate?: Date;

  @Prop({ enum: VaccinationStatus, required: true, default: VaccinationStatus.PLANNED })
  status!: VaccinationStatus;

  @Prop({ trim: true, maxlength: 1000 })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recordedBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Facility', required: true, index: true })
  facilityId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  verifiedBy?: Types.ObjectId;

  @Prop({ type: Date })
  verifiedAt?: Date;

  @Prop({ trim: true, maxlength: 1000 })
  verificationNote?: string;
}

export type VaccinationDocument = HydratedDocument<Vaccination>;
export const VaccinationSchema = SchemaFactory.createForClass(Vaccination);
