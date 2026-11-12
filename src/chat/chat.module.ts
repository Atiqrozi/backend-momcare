import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CryptoModule } from '../common/crypto/crypto.module';
import { PregnancyProfile, PregnancyProfileSchema } from '../pregnancy/schemas/pregnancy-profile.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AuditLog, AuditLogSchema } from '../users/schemas/audit-log.schema';
import { AncAppointment, AncAppointmentSchema } from '../pregnancy/schemas/anc-appointment.schema';
import { Facility, FacilitySchema } from '../facilities/schemas/facility.schema';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { DoctorScheduleService } from './doctor-schedule.service';
import { ChatConversation, ChatConversationSchema } from './schemas/chat-conversation.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { AppointmentSlotReservation, AppointmentSlotReservationSchema } from './schemas/appointment-slot-reservation.schema';

@Module({
  imports: [ConfigModule, CryptoModule, MongooseModule.forFeature([
    { name: ChatConversation.name, schema: ChatConversationSchema },
    { name: ChatMessage.name, schema: ChatMessageSchema },
    { name: PregnancyProfile.name, schema: PregnancyProfileSchema },
    { name: User.name, schema: UserSchema },
    { name: AuditLog.name, schema: AuditLogSchema },
    { name: AncAppointment.name, schema: AncAppointmentSchema },
    { name: Facility.name, schema: FacilitySchema },
    { name: AppointmentSlotReservation.name, schema: AppointmentSlotReservationSchema },
  ])],
  controllers: [ChatController],
  providers: [ChatService, DoctorScheduleService],
})
export class ChatModule {}
