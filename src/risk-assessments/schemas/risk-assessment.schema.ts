import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum RiskLevel {
  NO_FLAG = 'no_flag',
  FOLLOW_UP = 'follow_up',
  ELEVATED = 'elevated',
  URGENT = 'urgent',
}

@Schema({ timestamps: true, collection: 'riskAssessments' })
export class RiskAssessment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  assessedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  assessedAt!: Date;

  @Prop({ required: true, min: 40, max: 300 })
  systolicMmHg!: number;

  @Prop({ required: true, min: 20, max: 200 })
  diastolicMmHg!: number;

  @Prop({ min: 0, max: 4 })
  urineProteinPlus?: number;

  @Prop({ type: [String], default: [] })
  warningSigns!: string[];

  @Prop({ required: true, min: 0 })
  mapMmHg!: number;

  @Prop({ enum: RiskLevel, required: true })
  level!: RiskLevel;

  @Prop({ type: [String], default: [] })
  reasons!: string[];

  @Prop({ required: true, default: 'maternal-screen-v1' })
  algorithmVersion!: string;

  @Prop({ required: true, default: 'screening_only' })
  intendedUse!: string;
}

export type RiskAssessmentDocument = HydratedDocument<RiskAssessment>;
export const RiskAssessmentSchema = SchemaFactory.createForClass(RiskAssessment);
