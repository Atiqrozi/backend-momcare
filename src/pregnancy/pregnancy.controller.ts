import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Put, UseGuards, BadGatewayException, BadRequestException, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateAncAppointmentDto } from './dto/create-anc-appointment.dto';
import { CreateJournalDto } from './dto/create-journal.dto';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { UploadMedicalAttachmentDto } from './dto/upload-medical-attachment.dto';
import { SignMedicalAttachmentDto } from './dto/sign-medical-attachment.dto';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { VerifyVaccinationDto } from './dto/verify-vaccination.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { VerifyMedicalRecordDto } from './dto/verify-medical-record.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { RescheduleAncAppointmentDto } from './dto/reschedule-anc-appointment.dto';
import { UpdateAncAppointmentDto } from './dto/update-anc-appointment.dto';
import { UpsertPregnancyProfileDto } from './dto/upsert-pregnancy-profile.dto';
import { CreateMedicationReminderDto } from './dto/create-medication-reminder.dto';
import { UpdateMedicationReminderDto } from './dto/update-medication-reminder.dto';
import { UpsertChildProfileDto } from './dto/upsert-child-profile.dto';
import { CreateChildGrowthRecordDto } from './dto/create-child-growth-record.dto';
import { CreateChildImmunizationDto } from './dto/create-child-immunization.dto';
import { PregnancyService } from './pregnancy.service';
import { AncAppointmentStatus } from './schemas/anc-appointment.schema';
import { MedicalRecordVerificationStatus } from './schemas/medical-record.schema';
import { VaccinationStatus } from './schemas/vaccination.schema';

@ApiTags('Pregnancy')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('pregnancy')
export class PregnancyController {
  constructor(private readonly pregnancyService: PregnancyService, private readonly config: ConfigService) {}

  @Post('medical-record-attachments')
  @ApiOperation({ summary: 'Upload a clinical image or PDF to ImageKit' })
  async uploadMedicalAttachment(@Body() dto: UploadMedicalAttachmentDto) {
    const { publicKey, privateKey, urlEndpoint } = this.config.get<{ publicKey?: string; privateKey?: string; urlEndpoint?: string }>('imageKit', {});
    if (!publicKey || !privateKey || !urlEndpoint) throw new ServiceUnavailableException('ImageKit belum dikonfigurasi.');
    const [header, encoded] = dto.dataUrl.split(',');
    const file = Buffer.from(encoded, 'base64');
    if (!file.length || file.length > 1_000_000) throw new BadRequestException('Ukuran berkas maksimal 1 MB.');
    const detectedMime = header.match(/^data:([^;]+);base64$/)?.[1];
    if (detectedMime !== dto.mimeType) throw new BadRequestException('Tipe berkas tidak sesuai.');
    const body = new FormData();
    body.append('file', new Blob([file], { type: dto.mimeType }), dto.name);
    body.append('fileName', `anc-${dto.kind}-${Date.now()}-${dto.name}`);
    body.append('folder', '/moment-ai/anc');
    body.append('isPrivateFile', 'true');
    let response: Response;
    try {
      response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}` },
        body,
      });
    } catch {
      throw new BadGatewayException('ImageKit tidak dapat dijangkau.');
    }
    const result = await response.json().catch(() => null) as { url?: string; fileId?: string } | null;
    if (!response.ok || !result?.url || !result.fileId) throw new BadGatewayException('Berkas gagal diunggah ke ImageKit.');
    return { kind: dto.kind, name: dto.name, mimeType: dto.mimeType, url: result.url, fileId: result.fileId };
  }

  @Post('medical-record-attachments/access')
  @ApiOperation({ summary: 'Create a short-lived URL for an ANC attachment' })
  async signMedicalAttachment(@CurrentUser() user: AuthenticatedUser, @Body() dto: SignMedicalAttachmentDto) {
    const { privateKey, urlEndpoint } = this.config.get<{ privateKey?: string; urlEndpoint?: string }>('imageKit', {});
    if (!privateKey || !urlEndpoint) throw new ServiceUnavailableException('ImageKit belum dikonfigurasi.');
    const record = await this.pregnancyService.getMedicalRecord(user, dto.recordId);
    const attachment = record.details?.attachments?.find((item) => item.fileId === dto.fileId);
    if (!attachment) throw new BadRequestException('Lampiran tidak terhubung dengan rekam medis ini.');
    const original = new URL(attachment.url);
    const endpoint = new URL(urlEndpoint);
    if (original.origin !== endpoint.origin || !original.pathname.startsWith(`${endpoint.pathname.replace(/\/$/, '')}/moment-ai/anc/`)) {
      throw new BadRequestException('Lampiran ANC tidak valid.');
    }
    const expiry = Math.floor(Date.now() / 1000) + 300;
    const path = original.toString().slice(endpoint.toString().replace(/\/$/, '').length + 1).split('?')[0];
    const signature = createHmac('sha1', privateKey).update(`${path}${expiry}`).digest('hex');
    original.searchParams.set('ik-t', String(expiry));
    original.searchParams.set('ik-s', signature);
    return { url: original.toString(), expiresAt: new Date(expiry * 1000).toISOString() };
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get the authenticated pregnancy profile' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.pregnancyService.getProfile(user.userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Create or update the pregnancy profile' })
  upsertProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertPregnancyProfileDto) {
    return this.pregnancyService.upsertProfile(user.userId, dto);
  }

  @Get('medication-reminders')
  @ApiOperation({ summary: 'List medication and vitamin reminders for the authenticated mother' })
  listMedicationReminders(@CurrentUser() user: AuthenticatedUser) {
    return this.pregnancyService.listMedicationReminders(user);
  }

  @Post('medication-reminders')
  @ApiOperation({ summary: 'Create a medication or vitamin reminder' })
  createMedicationReminder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMedicationReminderDto) {
    return this.pregnancyService.createMedicationReminder(user, dto);
  }

  @Patch('medication-reminders/:id')
  @ApiOperation({ summary: 'Update a medication or vitamin reminder' })
  updateMedicationReminder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateMedicationReminderDto) {
    return this.pregnancyService.updateMedicationReminder(user, id, dto);
  }

  @Delete('medication-reminders/:id')
  @ApiOperation({ summary: 'Delete a medication or vitamin reminder' })
  deleteMedicationReminder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pregnancyService.deleteMedicationReminder(user, id);
  }

  @Get('children/profile')
  @ApiOperation({ summary: 'Get the authenticated mother’s child profile for 1000 HPK' })
  getChildProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.pregnancyService.getChildProfile(user);
  }

  @Put('children/profile')
  @ApiOperation({ summary: 'Create or update the authenticated mother’s child profile' })
  upsertChildProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertChildProfileDto) {
    return this.pregnancyService.upsertChildProfile(user, dto);
  }

  @Get('children/growth')
  @ApiOperation({ summary: 'List child growth measurements recorded by the authenticated mother' })
  listChildGrowth(@CurrentUser() user: AuthenticatedUser) {
    return this.pregnancyService.listChildGrowth(user);
  }

  @Post('children/growth')
  @ApiOperation({ summary: 'Record a child growth measurement' })
  createChildGrowth(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateChildGrowthRecordDto) {
    return this.pregnancyService.createChildGrowth(user, dto);
  }

  @Get('children/immunizations')
  @ApiOperation({ summary: 'List child immunizations recorded by the authenticated mother' })
  listChildImmunizations(@CurrentUser() user: AuthenticatedUser) {
    return this.pregnancyService.listChildImmunizations(user);
  }

  @Post('children/immunizations')
  @ApiOperation({ summary: 'Record a child immunization or upcoming immunization schedule' })
  createChildImmunization(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateChildImmunizationDto) {
    return this.pregnancyService.createChildImmunization(user, dto);
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Get the pregnancy timeline' })
  @ApiQuery({ name: 'patientId', required: false })
  getTimeline(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId?: string) {
    return this.pregnancyService.getTimeline(user, patientId);
  }

  @Get('journals')
  @ApiOperation({ summary: 'List pregnancy journals' })
  listJournals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.pregnancyService.listJournals(
      user,
      Math.max(page, 1),
      Math.min(Math.max(limit, 1), 100),
      from,
      to,
      patientId,
    );
  }

  @Post('journals')
  @ApiOperation({ summary: 'Create a pregnancy journal' })
  createJournal(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateJournalDto) {
    return this.pregnancyService.createJournal(user.userId, dto);
  }

  @Get('journals/:id')
  @ApiOperation({ summary: 'Get a pregnancy journal' })
  getJournal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.pregnancyService.getJournal(user, id, patientId);
  }

  @Patch('journals/:id')
  @ApiOperation({ summary: 'Update a pregnancy journal' })
  updateJournal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateJournalDto,
  ) {
    return this.pregnancyService.updateJournal(user.userId, id, dto);
  }

  @Delete('journals/:id')
  @ApiOperation({ summary: 'Delete a pregnancy journal' })
  deleteJournal(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pregnancyService.deleteJournal(user.userId, id);
  }

  @Get('medical-records')
  @ApiOperation({ summary: 'List medical records' })
  listMedicalRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Query('patientId') patientId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('verificationStatus') verificationStatus?: MedicalRecordVerificationStatus,
    @Query('recordType') recordType?: string,
  ) {
    return this.pregnancyService.listMedicalRecords(
      user,
      patientId,
      Math.max(page, 1),
      Math.min(Math.max(limit, 1), 100),
      from,
      to,
      verificationStatus,
      recordType,
    );
  }

  @Post('medical-records')
  @ApiOperation({ summary: 'Create a medical record' })
  createMedicalRecord(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMedicalRecordDto) {
    return this.pregnancyService.createMedicalRecord(user, dto);
  }

  @Get('medical-records/:id')
  @ApiOperation({ summary: 'Get a medical record' })
  getMedicalRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.pregnancyService.getMedicalRecord(user, id, patientId);
  }

  @Patch('medical-records/:id')
  @ApiOperation({ summary: 'Update a medical record' })
  updateMedicalRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMedicalRecordDto,
  ) {
    return this.pregnancyService.updateMedicalRecord(user, id, dto);
  }

  @Post('medical-records/:id/verify')
  @ApiOperation({ summary: 'Verify a medical record' })
  verifyMedicalRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VerifyMedicalRecordDto,
  ) {
    return this.pregnancyService.verifyMedicalRecord(user, id, dto);
  }

  @Delete('medical-records/:id')
  @ApiOperation({ summary: 'Delete a medical record' })
  deleteMedicalRecord(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pregnancyService.deleteMedicalRecord(user, id);
  }

  @Get('vaccinations')
  @ApiOperation({ summary: 'List vaccinations' })
  listVaccinations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('patientId') patientId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('status') status?: VaccinationStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.pregnancyService.listVaccinations(
      user,
      patientId,
      facilityId,
      status,
      from,
      to,
      Math.max(page, 1),
      Math.min(Math.max(limit, 1), 100),
    );
  }

  @Post('vaccinations')
  @ApiOperation({ summary: 'Create a vaccination record' })
  createVaccination(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVaccinationDto) {
    return this.pregnancyService.createVaccination(user, dto);
  }

  @Patch('vaccinations/:id')
  @ApiOperation({ summary: 'Update a vaccination record' })
  updateVaccination(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateVaccinationDto,
  ) {
    return this.pregnancyService.updateVaccination(user, id, dto);
  }

  @Get('vaccinations/:id')
  @ApiOperation({ summary: 'Get a vaccination record' })
  getVaccination(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.pregnancyService.getVaccination(user, id, patientId);
  }

  @Post('vaccinations/:id/verify')
  @ApiOperation({ summary: 'Verify a vaccination record' })
  verifyVaccination(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VerifyVaccinationDto,
  ) {
    return this.pregnancyService.verifyVaccination(user, id, dto);
  }

  @Delete('vaccinations/:id')
  @ApiOperation({ summary: 'Delete a vaccination record' })
  deleteVaccination(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pregnancyService.deleteVaccination(user, id);
  }

  @Get('anc-appointments')
  @ApiOperation({ summary: 'List ANC appointments' })
  listAppointments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('patientId') patientId?: string,
    @Query('status') status?: AncAppointmentStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.pregnancyService.listAppointments(
      user,
      patientId,
      status,
      from,
      to,
      Math.max(page, 1),
      Math.min(Math.max(limit, 1), 100),
    );
  }

  @Post('anc-appointments')
  @ApiOperation({ summary: 'Create an ANC appointment' })
  createAppointment(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAncAppointmentDto) {
    return this.pregnancyService.createAppointment(user, dto);
  }

  @Get('anc-appointments/:id')
  @ApiOperation({ summary: 'Get an ANC appointment' })
  getAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.pregnancyService.getAppointment(user, id, patientId);
  }

  @Patch('anc-appointments/:id')
  @ApiOperation({ summary: 'Update an ANC appointment' })
  updateAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAncAppointmentDto,
  ) {
    return this.pregnancyService.updateAppointment(user, id, dto);
  }

  @Post('anc-appointments/:id/cancel')
  @ApiOperation({ summary: 'Cancel an ANC appointment' })
  cancelAppointment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pregnancyService.cancelAppointment(user, id);
  }

  @Post('anc-appointments/:id/reschedule')
  @ApiOperation({ summary: 'Reschedule an ANC appointment' })
  rescheduleAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RescheduleAncAppointmentDto,
  ) {
    return this.pregnancyService.rescheduleAppointment(user, id, dto);
  }
}
