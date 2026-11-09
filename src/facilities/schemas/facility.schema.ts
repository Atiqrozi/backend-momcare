import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'facilities' })
export class Facility {
  @Prop({ required: true, trim: true, maxlength: 200 })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 100 })
  code!: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  address!: string;

  @Prop({ trim: true, maxlength: 30 })
  phone?: string;

  @Prop({ default: true })
  active!: boolean;
}

export type FacilityDocument = HydratedDocument<Facility>;
export const FacilitySchema = SchemaFactory.createForClass(Facility);
