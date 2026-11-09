import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum EducationContentStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Schema({ timestamps: true, collection: 'educationContents' })
export class EducationContent {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  summary!: string;

  @Prop({ required: true, maxlength: 20000 })
  body!: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  category!: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  sourceTitle!: string;

  @Prop({ trim: true, maxlength: 1000 })
  sourceUrl?: string;

  @Prop({ trim: true, maxlength: 100 })
  sourceVersion?: string;

  @Prop({ enum: EducationContentStatus, default: EducationContentStatus.DRAFT })
  status!: EducationContentStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop({ type: Date })
  publishedAt?: Date;

  @Prop({ trim: true, maxlength: 1000 })
  reviewNote?: string;
}

export type EducationContentDocument = HydratedDocument<EducationContent>;
export const EducationContentSchema = SchemaFactory.createForClass(EducationContent);
