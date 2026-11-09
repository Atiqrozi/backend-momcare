import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum Role {
  PREGNANT_MOTHER = 'PREGNANT_MOTHER',
  MIDWIFE = 'MIDWIFE',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN',
  CONTENT_EDITOR = 'CONTENT_EDITOR',
  CLINICAL_REVIEWER = 'CLINICAL_REVIEWER',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true, maxlength: 120 })
  fullName!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ trim: true, maxlength: 30 })
  phone?: string;

  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop({ default: false })
  phoneVerified!: boolean;

  @Prop({ required: true, default: 'v1' })
  consentVersion!: string;

  @Prop({ trim: true, select: false })
  emailVerificationTokenHash?: string;

  @Prop({ type: Date, select: false })
  emailVerificationExpiresAt?: Date;

  @Prop({ trim: true, select: false })
  phoneVerificationTokenHash?: string;

  @Prop({ type: Date, select: false })
  phoneVerificationExpiresAt?: Date;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ enum: Role, required: true, default: Role.PREGNANT_MOTHER })
  role!: Role;

  @Prop({ enum: AccountStatus, required: true, default: AccountStatus.ACTIVE })
  status!: AccountStatus;

  @Prop({ type: Types.ObjectId, ref: 'Facility', index: true })
  facilityId?: Types.ObjectId;

  @Prop({ required: true, default: false })
  consentGranted!: boolean;

  @Prop({ type: Date })
  consentGrantedAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
