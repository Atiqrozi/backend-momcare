import { IsDateString, IsMongoId, Matches } from 'class-validator';

export class AppointmentChatActionDto {
  @IsMongoId()
  appointmentId!: string;

  @IsMongoId()
  reminderMessageId!: string;
}

export class AppointmentSlotOptionsDto extends AppointmentChatActionDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
}

export class RescheduleAppointmentChatDto extends AppointmentChatActionDto {
  @IsDateString()
  scheduledAt!: string;
}
