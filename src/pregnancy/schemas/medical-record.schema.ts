import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum MedicalRecordVerificationStatus {
  PATIENT_REPORTED = 'patient_reported',
  PENDING_REVIEW = 'pending_review',
  VERIFIED = 'verified',
}

@Schema({ _id: false })
export class MedicalMeasurements {
  @Prop({ min: 40, max: 250 })
  heightCm?: number;

  @Prop({ min: 0, max: 500 })
  weightKg?: number;

  @Prop({ min: 40, max: 300 })
  systolicMmHg?: number;

  @Prop({ min: 20, max: 200 })
  diastolicMmHg?: number;

  @Prop({ min: 20, max: 250 })
  pulseBpm?: number;

  @Prop({ min: 5, max: 100 })
  lilaCm?: number;

  @Prop({ min: 0, max: 100 })
  tfuCm?: number;

  @Prop({ min: 40, max: 300 })
  fetalHeartRateBpm?: number;

  @Prop({ trim: true, maxlength: 100 })
  nutritionStatus?: string;

  @Prop({ trim: true, maxlength: 100 })
  tetanusStatus?: string;

  @Prop({ trim: true, maxlength: 100 })
  fetalPresentation?: string;

  @Prop({ trim: true, maxlength: 100 })
  fetalMovement?: string;

  @Prop({ trim: true, maxlength: 100 })
  edema?: string;

  @Prop({ trim: true, maxlength: 100 })
  conjunctiva?: string;
}

@Schema({ _id: false })
export class MedicalRecordDetails {
  @Prop({ type: [Object], default: [] })
  attachments?: Array<{ kind: string; name: string; mimeType: string; url: string; fileId?: string }>;

  @Prop({ type: Object })
  ultrasound?: { bpdCm?: string; abdominalCircumferenceCm?: string; femurLengthCm?: string; estimatedFetalWeightGrams?: string; amnioticFluidIndexCm?: string; placenta?: string; note?: string };

  @Prop({ type: Object })
  laboratory?: { hemoglobin?: string; urineProtein?: string; urineReduction?: string; glucose?: string; tripleElimination?: string; note?: string };

  @Prop({ type: Object })
  treatment?: { ironTablets?: string; calcium?: string; aspirin?: string; referral?: string };

  @Prop({ trim: true, maxlength: 500 })
  deliveryRecommendation?: string;

  @Prop({ trim: true, maxlength: 1000 })
  preeclampsiaAssessment?: string;

  @Prop({ trim: true, maxlength: 2000 })
  consultationNote?: string;

  @Prop({ trim: true, maxlength: 2000 })
  educationAdvice?: string;

  @Prop({ type: Date })
  nextVisitDate?: Date;
}

@Schema({ timestamps: true, collection: 'medicalRecords' })
export class MedicalRecord {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ required: true, type: Date, index: true })
  recordDate!: Date;

  @Prop({ required: true, trim: true, maxlength: 100 })
  recordType!: string;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  summary!: string;

  @Prop({ type: MedicalMeasurements })
  measurements?: MedicalMeasurements;

  @Prop({ type: MedicalRecordDetails })
  details?: MedicalRecordDetails;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recordedBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  verifiedBy?: Types.ObjectId;

  @Prop({ type: Date })
  verifiedAt?: Date;

  @Prop({ trim: true, maxlength: 1000 })
  verificationNote?: string;

  @Prop({ enum: MedicalRecordVerificationStatus, required: true })
  verificationStatus!: MedicalRecordVerificationStatus;
}

export type MedicalRecordDocument = HydratedDocument<MedicalRecord>;
export const MedicalRecordSchema = SchemaFactory.createForClass(MedicalRecord);
