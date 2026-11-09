import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '../users/schemas/audit-log.schema';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesService } from './facilities.service';
import { Facility, FacilitySchema } from './schemas/facility.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Facility.name, schema: FacilitySchema },
    { name: AuditLog.name, schema: AuditLogSchema },
  ])],
  controllers: [FacilitiesController],
  providers: [FacilitiesService],
})
export class FacilitiesModule {}
