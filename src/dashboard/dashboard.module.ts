import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PregnancyJournal, PregnancyJournalSchema } from '../pregnancy/schemas/pregnancy-journal.schema';
import { MedicalRecord, MedicalRecordSchema } from '../pregnancy/schemas/medical-record.schema';
import { Vaccination, VaccinationSchema } from '../pregnancy/schemas/vaccination.schema';
import { AncAppointment, AncAppointmentSchema } from '../pregnancy/schemas/anc-appointment.schema';
import { PregnancyProfile, PregnancyProfileSchema } from '../pregnancy/schemas/pregnancy-profile.schema';
import { AuditLog, AuditLogSchema } from '../users/schemas/audit-log.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { RiskAssessment, RiskAssessmentSchema } from '../risk-assessments/schemas/risk-assessment.schema';
import { LaborBagEntry, LaborBagEntrySchema } from './schemas/labor-bag.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { CryptoModule } from '../common/crypto/crypto.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: PregnancyProfile.name, schema: PregnancyProfileSchema },
      { name: PregnancyJournal.name, schema: PregnancyJournalSchema },
      { name: MedicalRecord.name, schema: MedicalRecordSchema },
      { name: Vaccination.name, schema: VaccinationSchema },
      { name: AncAppointment.name, schema: AncAppointmentSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: RiskAssessment.name, schema: RiskAssessmentSchema },
      { name: LaborBagEntry.name, schema: LaborBagEntrySchema },
    ]),
    CryptoModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
