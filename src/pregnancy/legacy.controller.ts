import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PregnancyService } from './pregnancy.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { VerifyMedicalRecordDto } from './dto/verify-medical-record.dto';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { VerifyVaccinationDto } from './dto/verify-vaccination.dto';
import { CreateAncAppointmentDto } from './dto/create-anc-appointment.dto';
import { UpdateAncAppointmentDto } from './dto/update-anc-appointment.dto';
import { RescheduleAncAppointmentDto } from './dto/reschedule-anc-appointment.dto';
import { MedicalRecordVerificationStatus } from './schemas/medical-record.schema';
import { VaccinationStatus } from './schemas/vaccination.schema';
import { AncAppointmentStatus } from './schemas/anc-appointment.schema';

@ApiTags('Medical Records, Vaccinations and ANC')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class LegacyPregnancyController {
  constructor(private readonly service: PregnancyService) {}

  @Get('medical-records')
  medicalRecords(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId?: string, @Query('page') page = 1, @Query('limit') limit = 20, @Query('from') from?: string, @Query('to') to?: string, @Query('verificationStatus') status?: MedicalRecordVerificationStatus, @Query('recordType') recordType?: string) {
    return this.service.listMedicalRecords(user, patientId, Number(page), Number(limit), from, to, status, recordType);
  }

  @Post('medical-records')
  createMedicalRecord(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMedicalRecordDto) {
    return this.service.createMedicalRecord(user, dto);
  }

  @Get('medical-records/:id')
  getMedicalRecord(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('patientId') patientId?: string) {
    return this.service.getMedicalRecord(user, id, patientId);
  }

  @Patch('medical-records/:id')
  updateMedicalRecord(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateMedicalRecordDto) {
    return this.service.updateMedicalRecord(user, id, dto);
  }

  @Post('medical-records/:id/verify')
  verifyMedicalRecord(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: VerifyMedicalRecordDto) {
    return this.service.verifyMedicalRecord(user, id, dto);
  }

  @Delete('medical-records/:id')
  deleteMedicalRecord(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteMedicalRecord(user, id);
  }

  @Get('vaccinations')
  vaccinations(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId?: string, @Query('facilityId') facilityId?: string, @Query('status') status?: VaccinationStatus, @Query('from') from?: string, @Query('to') to?: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.service.listVaccinations(user, patientId, facilityId, status, from, to, Number(page), Number(limit));
  }

  @Post('vaccinations')
  createVaccination(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVaccinationDto) {
    return this.service.createVaccination(user, dto);
  }

  @Get('vaccinations/:id')
  getVaccination(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('patientId') patientId?: string) {
    return this.service.getVaccination(user, id, patientId);
  }

  @Patch('vaccinations/:id')
  updateVaccination(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateVaccinationDto) {
    return this.service.updateVaccination(user, id, dto);
  }

  @Post('vaccinations/:id/verify')
  verifyVaccination(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: VerifyVaccinationDto) {
    return this.service.verifyVaccination(user, id, dto);
  }

  @Delete('vaccinations/:id')
  deleteVaccination(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteVaccination(user, id);
  }

  @Get('anc-appointments')
  appointments(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId?: string, @Query('status') status?: AncAppointmentStatus, @Query('from') from?: string, @Query('to') to?: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.service.listAppointments(user, patientId, status, from, to, Number(page), Number(limit));
  }

  @Post('anc-appointments')
  createAppointment(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAncAppointmentDto) {
    return this.service.createAppointment(user, dto);
  }

  @Get('anc-appointments/:id')
  getAppointment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('patientId') patientId?: string) {
    return this.service.getAppointment(user, id, patientId);
  }

  @Patch('anc-appointments/:id')
  updateAppointment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateAncAppointmentDto) {
    return this.service.updateAppointment(user, id, dto);
  }

  @Post('anc-appointments/:id/cancel')
  cancelAppointment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.cancelAppointment(user, id);
  }

  @Post('anc-appointments/:id/reschedule')
  rescheduleAppointment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RescheduleAncAppointmentDto) {
    return this.service.rescheduleAppointment(user, id, dto);
  }
}
