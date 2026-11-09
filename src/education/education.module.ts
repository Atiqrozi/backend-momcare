import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EducationController } from './education.controller';
import { EducationService } from './education.service';
import { EducationContent, EducationContentSchema } from './schemas/education-content.schema';
import { AuditLog, AuditLogSchema } from '../users/schemas/audit-log.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: EducationContent.name, schema: EducationContentSchema },
    { name: AuditLog.name, schema: AuditLogSchema },
  ])],
  controllers: [EducationController],
  providers: [EducationService],
})
export class EducationModule {}
