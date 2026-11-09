import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'appointmentSlotReservations' })
export class AppointmentSlotReservation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  providerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  patientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AncAppointment', required: true, index: true })
  appointmentId!: Types.ObjectId;

  @Prop({ required: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  localDate!: string;

  @Prop({ required: true, min: 0, max: 9 })
  seatIndex!: number;

  @Prop({ type: Date, required: true })
  slotStart!: Date;
}

export type AppointmentSlotReservationDocument = HydratedDocument<AppointmentSlotReservation>;
export const AppointmentSlotReservationSchema = SchemaFactory.createForClass(AppointmentSlotReservation);
AppointmentSlotReservationSchema.index({ providerId: 1, slotStart: 1 }, { unique: true });
AppointmentSlotReservationSchema.index({ providerId: 1, localDate: 1, seatIndex: 1 }, { unique: true });
