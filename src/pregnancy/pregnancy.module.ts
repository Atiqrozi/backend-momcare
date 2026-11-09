import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationModule } from '../notifications/notification.module';
import { AuditLog, AuditLogSchema } from '../users/schemas/audit-log.schema';
import { PregnancyController } from './pregnancy.controller';
import { PregnancyService } from './pregnancy.service';
import {
  PregnancyProfile,
  PregnancyProfileSchema,
} from './schemas/pregnancy-profile.schema';
import {
  PregnancyJournal,
  PregnancyJournalSchema,
} from './schemas/pregnancy-journal.schema';
import {
  MedicalRecord,
  MedicalRecordSchema,
} from './schemas/medical-record.schema';
import { Vaccination, VaccinationSchema } from './schemas/vaccination.schema';
import {
  AncAppointment,
  AncAppointmentSchema,
} from './schemas/anc-appointment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Facility, FacilitySchema } from '../facilities/schemas/facility.schema';
import { LegacyPregnancyController } from './legacy.controller';
import { MedicationReminder, MedicationReminderSchema } from './schemas/medication-reminder.schema';
import { ChildProfile, ChildProfileSchema } from './schemas/child-profile.schema';
import { ChildGrowthRecord, ChildGrowthRecordSchema } from './schemas/child-growth-record.schema';
import { ChildImmunization, ChildImmunizationSchema } from './schemas/child-immunization.schema';
import { AppointmentSlotReservation, AppointmentSlotReservationSchema } from '../chat/schemas/appointment-slot-reservation.schema';

@Module({
  imports: [
    NotificationModule,
    MongooseModule.forFeature([
      { name: PregnancyProfile.name, schema: PregnancyProfileSchema },
      { name: PregnancyJournal.name, schema: PregnancyJournalSchema },
      { name: MedicalRecord.name, schema: MedicalRecordSchema },
      { name: Vaccination.name, schema: VaccinationSchema },
      { name: AncAppointment.name, schema: AncAppointmentSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: User.name, schema: UserSchema },
      { name: Facility.name, schema: FacilitySchema },
      { name: MedicationReminder.name, schema: MedicationReminderSchema },
      { name: ChildProfile.name, schema: ChildProfileSchema },
      { name: ChildGrowthRecord.name, schema: ChildGrowthRecordSchema },
      { name: ChildImmunization.name, schema: ChildImmunizationSchema },
      { name: AppointmentSlotReservation.name, schema: AppointmentSlotReservationSchema },
    ]),
  ],
  controllers: [PregnancyController, LegacyPregnancyController],
  providers: [PregnancyService],
})
export class PregnancyModule {}
