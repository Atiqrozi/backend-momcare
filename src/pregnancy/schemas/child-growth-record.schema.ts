import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'childGrowthRecords' })
export class ChildGrowthRecord {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  parentId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ChildProfile', required: true, index: true })
  childId!: Types.ObjectId;

  @Prop({ required: true, type: Date })
  measuredAt!: Date;

  @Prop({ min: 0.3, max: 80, required: true })
  weightKg!: number;

  @Prop({ min: 20, max: 150, required: true })
  heightCm!: number;

  @Prop({ min: 15, max: 70 })
  headCircumferenceCm?: number;

  @Prop({ trim: true, maxlength: 500 })
  notes?: string;
}

export type ChildGrowthRecordDocument = HydratedDocument<ChildGrowthRecord>;
export const ChildGrowthRecordSchema = SchemaFactory.createForClass(ChildGrowthRecord);
