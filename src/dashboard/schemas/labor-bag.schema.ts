import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum LaborBagDeliveryType {
  SC = 'SC',
  SPONTAN = 'SPONTAN',
}

@Schema({ timestamps: true, collection: 'laborBags' })
export class LaborBagEntry {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  examinationDate!: Date;

  @Prop({ enum: ['BPJS', 'UMUM'], required: true })
  insuranceType!: 'BPJS' | 'UMUM';

  @Prop({ type: Date, required: true })
  estimatedDueDate!: Date;

  @Prop({ enum: LaborBagDeliveryType, required: true })
  deliveryType!: LaborBagDeliveryType;

  @Prop({ min: 0, max: 45 })
  gestationalWeeks?: number;

  @Prop({ min: 0, max: 6 })
  gestationalDays?: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  providerId!: Types.ObjectId;
}

export type LaborBagEntryDocument = HydratedDocument<LaborBagEntry>;
export const LaborBagEntrySchema = SchemaFactory.createForClass(LaborBagEntry);
