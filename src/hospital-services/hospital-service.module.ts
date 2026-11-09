import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HospitalServiceController } from './hospital-service.controller';
import { HospitalServiceService } from './hospital-service.service';
import { HospitalService, HospitalServiceSchema } from './schemas/hospital-service.schema';
import { AuditLog, AuditLogSchema } from '../users/schemas/audit-log.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: HospitalService.name, schema: HospitalServiceSchema },
    { name: AuditLog.name, schema: AuditLogSchema },
  ])],
  controllers: [HospitalServiceController],
  providers: [HospitalServiceService],
})
export class HospitalServiceModule {}
