import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'childProfiles' })
export class ChildProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  parentId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  fullName!: string;

  @Prop({ required: true, type: Date })
  birthDate!: Date;

  @Prop({ enum: ['male', 'female', 'unspecified'], default: 'unspecified' })
  sex!: 'male' | 'female' | 'unspecified';

  @Prop({ trim: true, maxlength: 500 })
  notes?: string;
}

export type ChildProfileDocument = HydratedDocument<ChildProfile>;
export const ChildProfileSchema = SchemaFactory.createForClass(ChildProfile);
