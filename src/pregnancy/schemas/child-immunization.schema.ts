import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum ChildImmunizationStatus { PLANNED = 'planned', COMPLETED = 'completed' }

@Schema({ timestamps: true, collection: 'childImmunizations' })
export class ChildImmunization {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) parentId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'ChildProfile', required: true, index: true }) childId!: Types.ObjectId;
  @Prop({ required: true, trim: true, maxlength: 120 }) vaccineName!: string;
  @Prop({ type: Date }) scheduledDate?: Date;
  @Prop({ type: Date }) administeredDate?: Date;
  @Prop({ enum: ChildImmunizationStatus, default: ChildImmunizationStatus.PLANNED }) status!: ChildImmunizationStatus;
  @Prop({ trim: true, maxlength: 500 }) notes?: string;
}

export type ChildImmunizationDocument = HydratedDocument<ChildImmunization>;
export const ChildImmunizationSchema = SchemaFactory.createForClass(ChildImmunization);
