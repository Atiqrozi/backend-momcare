import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '../users/schemas/audit-log.schema';
import { PregnancyProfile, PregnancyProfileSchema } from '../pregnancy/schemas/pregnancy-profile.schema';
import { RiskAssessment, RiskAssessmentSchema } from './schemas/risk-assessment.schema';
import { RiskAssessmentsController } from './risk-assessments.controller';
import { RiskAssessmentsService } from './risk-assessments.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: RiskAssessment.name, schema: RiskAssessmentSchema },
    { name: PregnancyProfile.name, schema: PregnancyProfileSchema },
    { name: AuditLog.name, schema: AuditLogSchema },
  ])],
  controllers: [RiskAssessmentsController],
  providers: [RiskAssessmentsService],
})
export class RiskAssessmentsModule {}
