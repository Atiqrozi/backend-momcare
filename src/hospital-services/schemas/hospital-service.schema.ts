import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum HospitalServiceStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Schema({ timestamps: true, collection: 'hospitalServices' })
export class HospitalService {
  @Prop({ required: true, trim: true, maxlength: 200 })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  description!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  department!: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  addressOrLocation!: string;

  @Prop({ trim: true, maxlength: 30 })
  contactPhone?: string;

  @Prop({ trim: true, maxlength: 1000 })
  operatingHours?: string;

  @Prop({ trim: true, maxlength: 2000 })
  instructions?: string;

  @Prop({ enum: HospitalServiceStatus, default: HospitalServiceStatus.DRAFT })
  status!: HospitalServiceStatus;

  @Prop({ type: String, ref: 'User', required: true })
  updatedBy!: string;
}

export type HospitalServiceDocument = HydratedDocument<HospitalService>;
export const HospitalServiceSchema = SchemaFactory.createForClass(HospitalService);
