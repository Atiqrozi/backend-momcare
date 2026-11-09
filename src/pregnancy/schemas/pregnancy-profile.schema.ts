import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum PregnancyStatus {
  ONGOING = 'ongoing',
  POSTPARTUM = 'postpartum',
  COMPLETED = 'completed',
}

@Schema({ timestamps: true, collection: 'pregnancyProfiles' })
export class PregnancyProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ trim: true, match: /^\d{16}$/ })
  nik?: string;

  @Prop({ enum: ['BPJS', 'UMUM'], default: 'BPJS' })
  insuranceType!: 'BPJS' | 'UMUM';

  @Prop({ trim: true, match: /^\d{13}$/ })
  bpjsNumber?: string;

  @Prop({ trim: true, maxlength: 100 })
  birthplace?: string;

  @Prop({ type: Date })
  birthDate?: Date;

  @Prop({ trim: true, maxlength: 20 })
  education?: string;

  @Prop({ trim: true, maxlength: 120 })
  occupation?: string;

  @Prop({ trim: true, maxlength: 500 })
  address?: string;

  @Prop({ enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] })
  bloodType?: string;

  @Prop({ trim: true, maxlength: 1000 })
  medicalHistory?: string;

  @Prop({ type: Date })
  lmpDate?: Date;

  @Prop({ type: Date })
  estimatedDueDate?: Date;

  @Prop({ enum: PregnancyStatus, default: PregnancyStatus.ONGOING })
  pregnancyStatus!: PregnancyStatus;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  assignedProviderIds!: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Facility' })
  facilityId?: Types.ObjectId;
}

export type PregnancyProfileDocument = HydratedDocument<PregnancyProfile>;
export const PregnancyProfileSchema = SchemaFactory.createForClass(PregnancyProfile);
