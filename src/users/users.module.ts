import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PregnancyProfile, PregnancyProfileSchema } from '../pregnancy/schemas/pregnancy-profile.schema';
import { Facility, FacilitySchema } from '../facilities/schemas/facility.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: User.name, schema: UserSchema },
    { name: AuditLog.name, schema: AuditLogSchema },
    { name: PregnancyProfile.name, schema: PregnancyProfileSchema },
    { name: Facility.name, schema: FacilitySchema },
  ])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
