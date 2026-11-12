import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Facility, FacilityDocument } from '../facilities/schemas/facility.schema';
import { AuditLog, AuditLogDocument } from '../users/schemas/audit-log.schema';
import { Role } from '../users/schemas/user.schema';
import { CreateJournalDto } from './dto/create-journal.dto';
import { CreateAncAppointmentDto } from './dto/create-anc-appointment.dto';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { VerifyMedicalRecordDto } from './dto/verify-medical-record.dto';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { VerifyVaccinationDto } from './dto/verify-vaccination.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { UpdateVaccinationDto } from './dto/update-vaccination.dto';
import { UpdateAncAppointmentDto } from './dto/update-anc-appointment.dto';
import { RescheduleAncAppointmentDto } from './dto/reschedule-anc-appointment.dto';
import { UpsertPregnancyProfileDto } from './dto/upsert-pregnancy-profile.dto';
import { CreateMedicationReminderDto } from './dto/create-medication-reminder.dto';
import { UpdateMedicationReminderDto } from './dto/update-medication-reminder.dto';
import { UpsertChildProfileDto } from './dto/upsert-child-profile.dto';
import { CreateChildGrowthRecordDto } from './dto/create-child-growth-record.dto';
import { CreateChildImmunizationDto } from './dto/create-child-immunization.dto';
import {
  MedicalRecord,
  MedicalRecordDocument,
  MedicalRecordVerificationStatus,
} from './schemas/medical-record.schema';
import {
  PregnancyProfile,
  PregnancyProfileDocument,
} from './schemas/pregnancy-profile.schema';
import { MedicationReminder, MedicationReminderDocument } from './schemas/medication-reminder.schema';
import { ChildProfile, ChildProfileDocument } from './schemas/child-profile.schema';
import { ChildGrowthRecord, ChildGrowthRecordDocument } from './schemas/child-growth-record.schema';
import { ChildImmunization, ChildImmunizationDocument, ChildImmunizationStatus } from './schemas/child-immunization.schema';
import { PregnancyJournal, PregnancyJournalDocument } from './schemas/pregnancy-journal.schema';
import {
  Vaccination,
  VaccinationDocument,
  VaccinationStatus,
} from './schemas/vaccination.schema';
import {
  AncAppointment,
  AncAppointmentDocument,
  AncAppointmentStatus,
} from './schemas/anc-appointment.schema';
import { getRequestId } from '../common/request-context';
import { calculateEstimatedDueDate } from '../common/estimated-due-date';
import { AppointmentSlotReservation, AppointmentSlotReservationDocument } from '../chat/schemas/appointment-slot-reservation.schema';
import { EncryptionService } from '../common/crypto/encryption.service';

@Injectable()
export class PregnancyService {
  constructor(
    @InjectModel(PregnancyProfile.name)
    private readonly profileModel: Model<PregnancyProfileDocument>,
    @InjectModel(MedicationReminder.name)
    private readonly medicationReminderModel: Model<MedicationReminderDocument>,
    @InjectModel(ChildProfile.name)
    private readonly childProfileModel: Model<ChildProfileDocument>,
    @InjectModel(ChildGrowthRecord.name)
    private readonly childGrowthModel: Model<ChildGrowthRecordDocument>,
    @InjectModel(ChildImmunization.name)
    private readonly childImmunizationModel: Model<ChildImmunizationDocument>,
    @InjectModel(PregnancyJournal.name)
    private readonly journalModel: Model<PregnancyJournalDocument>,
    @InjectModel(MedicalRecord.name)
    private readonly medicalRecordModel: Model<MedicalRecordDocument>,
    @InjectModel(Vaccination.name)
    private readonly vaccinationModel: Model<VaccinationDocument>,
    @InjectModel(AncAppointment.name)
    private readonly appointmentModel: Model<AncAppointmentDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Facility.name)
    private readonly facilityModel: Model<FacilityDocument>,
    @InjectModel(AppointmentSlotReservation.name)
    private readonly slotReservationModel: Model<AppointmentSlotReservationDocument>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async getProfile(userId: string) {
    const profile = await this.profileModel.findOne({ userId: this.objectId(userId) }).select('+nikEncrypted').lean();
    return this.decryptNik(profile);
  }

  async getTimeline(user: AuthenticatedUser, requestedPatientId?: string) {
    const patientId = await this.resolvePatientId(user, requestedPatientId);
    const profile = await this.profileModel.findOne({ userId: patientId }).select('+nikEncrypted').lean();
    const decryptedProfile = this.decryptNik(profile);
    if (!decryptedProfile) return { profile: null, currentWeek: null, events: [] };

    const [journals, medicalRecords, vaccinations, appointments] = await Promise.all([
      this.journalModel.find({ patientId }).sort({ entryDate: 1 }).lean(),
      this.medicalRecordModel.find({ patientId }).sort({ recordDate: 1 }).lean(),
      this.vaccinationModel.find({ patientId }).sort({ scheduledDate: 1 }).lean(),
      this.appointmentModel.find({ patientId }).sort({ scheduledAt: 1 }).lean(),
    ]);
    const currentWeek = decryptedProfile.lmpDate
      ? Math.max(0, Math.floor((Date.now() - decryptedProfile.lmpDate.getTime()) / (7 * 24 * 60 * 60 * 1000)))
      : null;
    const events = [
      ...journals.map((item) => ({ type: 'journal', date: item.entryDate, data: item })),
      ...medicalRecords.map((item) => ({ type: 'medical_record', date: item.recordDate, data: item })),
      ...vaccinations
        .filter((item) => item.scheduledDate || item.administeredDate)
        .map((item) => ({
          type: 'vaccination',
          date: item.administeredDate ?? item.scheduledDate!,
          data: item,
        })),
      ...appointments.map((item) => ({ type: 'anc_appointment', date: item.scheduledAt, data: item })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    return { profile: decryptedProfile, currentWeek, events };
  }

  async upsertProfile(userId: string, dto: UpsertPregnancyProfileDto) {
    const update: Record<string, unknown> = { ...dto };
    if (dto.nik !== undefined) {
      update.nikEncrypted = this.encryptionService.encrypt(dto.nik);
      delete update.nik;
    }
    const profile = await this.profileModel.findOneAndUpdate(
      { userId: this.objectId(userId) },
      {
        $set: {
          ...update,
          ...(dto.lmpDate ? { lmpDate: new Date(dto.lmpDate) } : {}),
          ...(dto.estimatedDueDate
            ? { estimatedDueDate: new Date(dto.estimatedDueDate) }
            : dto.lmpDate
              ? { estimatedDueDate: calculateEstimatedDueDate(dto.lmpDate) }
              : {}),
          ...(dto.birthDate ? { birthDate: new Date(dto.birthDate) } : {}),
        },
        ...(dto.insuranceType === 'UMUM' ? { $unset: { bpjsNumber: 1 } } : {}),
        $setOnInsert: { userId: this.objectId(userId) },
      },
      { new: true, upsert: true, runValidators: true },
    );
    return profile;
  }

  async listMedicationReminders(user: AuthenticatedUser) {
    this.requireMotherRole(user);
    return this.medicationReminderModel.find({ patientId: this.objectId(user.userId) }).sort({ time: 1, createdAt: -1 }).lean();
  }

  async createMedicationReminder(user: AuthenticatedUser, dto: CreateMedicationReminderDto) {
    this.requireMotherRole(user);
    return this.medicationReminderModel.create({ ...dto, patientId: this.objectId(user.userId) });
  }

  async updateMedicationReminder(user: AuthenticatedUser, id: string, dto: UpdateMedicationReminderDto) {
    this.requireMotherRole(user);
    const reminder = await this.medicationReminderModel.findOneAndUpdate(
      { _id: this.objectId(id), patientId: this.objectId(user.userId) },
      { $set: dto },
      { new: true, runValidators: true },
    ).lean();
    if (!reminder) throw new NotFoundException('Pengingat obat tidak ditemukan');
    return reminder;
  }

  async deleteMedicationReminder(user: AuthenticatedUser, id: string) {
    this.requireMotherRole(user);
    const result = await this.medicationReminderModel.deleteOne({ _id: this.objectId(id), patientId: this.objectId(user.userId) });
    if (!result.deletedCount) throw new NotFoundException('Pengingat obat tidak ditemukan');
    return { deleted: true };
  }

  async getChildProfile(user: AuthenticatedUser) {
    this.requireMotherRole(user);
    return this.childProfileModel.findOne({ parentId: this.objectId(user.userId) }).lean();
  }

  async upsertChildProfile(user: AuthenticatedUser, dto: UpsertChildProfileDto) {
    this.requireMotherRole(user);
    const parentId = this.objectId(user.userId);
    return this.childProfileModel.findOneAndUpdate(
      { parentId },
      { $set: { ...dto, birthDate: new Date(dto.birthDate) }, $setOnInsert: { parentId } },
      { new: true, upsert: true, runValidators: true },
    ).lean();
  }

  async listChildGrowth(user: AuthenticatedUser) {
    this.requireMotherRole(user);
    const parentId = this.objectId(user.userId);
    const child = await this.childProfileModel.findOne({ parentId }).select('_id').lean();
    if (!child) return { child: null, data: [] };
    const data = await this.childGrowthModel.find({ parentId, childId: child._id }).sort({ measuredAt: -1 }).limit(100).lean();
    return { child, data };
  }

  async createChildGrowth(user: AuthenticatedUser, dto: CreateChildGrowthRecordDto) {
    this.requireMotherRole(user);
    const parentId = this.objectId(user.userId);
    const child = await this.childProfileModel.findOne({ parentId }).select('_id birthDate').lean();
    if (!child) throw new BadRequestException('Buat profil anak terlebih dahulu sebelum mencatat pertumbuhan');
    const measuredAt = this.dateValue(dto.measuredAt, 'measuredAt');
    if (measuredAt < child.birthDate) throw new BadRequestException('Tanggal pengukuran tidak boleh sebelum tanggal lahir anak');
    return this.childGrowthModel.create({ ...dto, parentId, childId: child._id, measuredAt });
  }

  async listChildImmunizations(user: AuthenticatedUser) {
    this.requireMotherRole(user);
    const parentId = this.objectId(user.userId);
    const child = await this.childProfileModel.findOne({ parentId }).select('_id').lean();
    if (!child) return [];
    return this.childImmunizationModel.find({ parentId, childId: child._id }).sort({ scheduledDate: 1, administeredDate: -1 }).limit(100).lean();
  }

  async createChildImmunization(user: AuthenticatedUser, dto: CreateChildImmunizationDto) {
    this.requireMotherRole(user);
    const parentId = this.objectId(user.userId);
    const child = await this.childProfileModel.findOne({ parentId }).select('_id').lean();
    if (!child) throw new BadRequestException('Buat profil anak terlebih dahulu sebelum mencatat imunisasi');
    const administeredDate = dto.administeredDate ? this.dateValue(dto.administeredDate, 'administeredDate') : undefined;
    const scheduledDate = dto.scheduledDate ? this.dateValue(dto.scheduledDate, 'scheduledDate') : undefined;
    if (administeredDate && scheduledDate && administeredDate < scheduledDate) throw new BadRequestException('Tanggal pemberian tidak boleh sebelum tanggal jadwal');
    return this.childImmunizationModel.create({ ...dto, parentId, childId: child._id, scheduledDate, administeredDate, status: administeredDate ? ChildImmunizationStatus.COMPLETED : dto.status ?? ChildImmunizationStatus.PLANNED });
  }

  async listJournals(
    user: AuthenticatedUser,
    page = 1,
    limit = 20,
    from?: string,
    to?: string,
    requestedPatientId?: string,
  ) {
    const patientId = await this.resolvePatientId(user, requestedPatientId);
    const entryDate: { $gte?: Date; $lte?: Date } = {};
    if (from) entryDate.$gte = this.dateValue(from, 'from');
    if (to) entryDate.$lte = this.dateValue(to, 'to');
    const filter = { patientId, ...(Object.keys(entryDate).length ? { entryDate } : {}) };
    const [data, total] = await Promise.all([
      this.journalModel.find(filter).sort({ entryDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.journalModel.countDocuments(filter),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getJournal(user: AuthenticatedUser, id: string, requestedPatientId?: string) {
    const journal = await this.journalModel.findOne({
      _id: this.objectId(id),
      patientId: await this.resolvePatientId(user, requestedPatientId),
    }).lean();
    if (!journal) throw new NotFoundException('Jurnal tidak ditemukan');
    return journal;
  }

  async createJournal(userId: string, dto: CreateJournalDto) {
    return this.journalModel.create({
      ...dto,
      patientId: this.objectId(userId),
      entryDate: new Date(dto.entryDate),
    });
  }

  async updateJournal(userId: string, id: string, dto: UpdateJournalDto) {
    const journal = await this.journalModel.findOneAndUpdate(
      { _id: this.objectId(id), patientId: this.objectId(userId) },
      {
        $set: {
          ...dto,
          ...(dto.entryDate ? { entryDate: new Date(dto.entryDate) } : {}),
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!journal) throw new NotFoundException('Jurnal tidak ditemukan');
    return journal;
  }

  async deleteJournal(userId: string, id: string) {
    const result = await this.journalModel.deleteOne({
      _id: this.objectId(id),
      patientId: this.objectId(userId),
    });
    if (!result.deletedCount) throw new NotFoundException('Jurnal tidak ditemukan');
    return { deleted: true };
  }

  async listMedicalRecords(
    user: AuthenticatedUser,
    patientId?: string,
    page = 1,
    limit = 20,
    from?: string,
    to?: string,
    verificationStatus?: MedicalRecordVerificationStatus,
    recordType?: string,
  ) {
    const recordDate: { $gte?: Date; $lte?: Date } = {};
    if (from) recordDate.$gte = this.dateValue(from, 'from');
    if (to) recordDate.$lte = this.dateValue(to, 'to');
    const filter = {
      patientId: await this.resolvePatientId(user, patientId),
      ...(verificationStatus ? { verificationStatus } : {}),
      ...(recordType ? { recordType } : {}),
      ...(Object.keys(recordDate).length ? { recordDate } : {}),
    };
    const [data, total] = await Promise.all([
      this.medicalRecordModel.find(filter).sort({ recordDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.medicalRecordModel.countDocuments(filter),
    ]);
    await this.audit(user, 'medical_record.listed', undefined, filter.patientId.toString());
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getMedicalRecord(user: AuthenticatedUser, id: string, patientId?: string) {
    const record = await this.medicalRecordModel.findById(this.objectId(id)).lean();
    if (!record) throw new NotFoundException('Riwayat pemeriksaan tidak ditemukan');
    await this.resolvePatientId(user, patientId ?? record.patientId.toString());
    await this.audit(user, 'medical_record.accessed', id, record.patientId.toString());
    return record;
  }

  async createMedicalRecord(user: AuthenticatedUser, dto: CreateMedicalRecordDto) {
    const isMother = user.role === Role.PREGNANT_MOTHER;
    const resolvedPatientId = await this.resolvePatientId(user, dto.patientId);
    const record = await this.medicalRecordModel.create({
      ...dto,
      patientId: resolvedPatientId,
      recordedBy: this.objectId(user.userId),
      recordDate: new Date(dto.recordDate),
      verificationStatus: isMother
        ? MedicalRecordVerificationStatus.PATIENT_REPORTED
        : MedicalRecordVerificationStatus.VERIFIED,
      ...(isMother ? {} : {
        verifiedBy: this.objectId(user.userId),
        verifiedAt: new Date(),
      }),
    });
    await this.audit(user, 'medical_record.created', record._id.toString(), record.patientId.toString());
    return record;
  }

  async updateMedicalRecord(user: AuthenticatedUser, id: string, dto: UpdateMedicalRecordDto) {
    this.requireClinicalRole(user);
    const existing = await this.medicalRecordModel.findById(this.objectId(id)).select('patientId').lean();
    if (!existing) throw new NotFoundException('Riwayat pemeriksaan tidak ditemukan');
    await this.resolvePatientId(user, existing.patientId.toString());
    const record = await this.medicalRecordModel.findOneAndUpdate(
      { _id: this.objectId(id) },
      {
        $set: {
          ...dto,
          ...(dto.recordDate ? { recordDate: new Date(dto.recordDate) } : {}),
          recordedBy: this.objectId(user.userId),
          verificationStatus: MedicalRecordVerificationStatus.VERIFIED,
          verifiedBy: this.objectId(user.userId),
          verifiedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!record) throw new NotFoundException('Riwayat pemeriksaan tidak ditemukan');
    await this.audit(user, 'medical_record.updated', id, record.patientId.toString());
    return record;
  }

  async verifyMedicalRecord(user: AuthenticatedUser, id: string, dto: VerifyMedicalRecordDto) {
    this.requireClinicalRole(user);
    const existing = await this.medicalRecordModel.findById(this.objectId(id)).lean();
    if (!existing) throw new NotFoundException('Riwayat pemeriksaan tidak ditemukan');
    await this.resolvePatientId(user, existing.patientId.toString());
    const record = await this.medicalRecordModel.findByIdAndUpdate(
      this.objectId(id),
      {
        $set: {
          verificationStatus: MedicalRecordVerificationStatus.VERIFIED,
          verifiedBy: this.objectId(user.userId),
          verifiedAt: new Date(),
          ...(dto.note ? { verificationNote: dto.note } : {}),
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!record) throw new NotFoundException('Riwayat pemeriksaan tidak ditemukan');
    await this.audit(user, 'medical_record.verified', id, record.patientId.toString());
    return record;
  }

  async deleteMedicalRecord(user: AuthenticatedUser, id: string) {
    this.requireClinicalRole(user);
    const existing = await this.medicalRecordModel.findById(this.objectId(id)).lean();
    if (!existing) throw new NotFoundException('Riwayat pemeriksaan tidak ditemukan');
    await this.resolvePatientId(user, existing.patientId.toString());
    const result = await this.medicalRecordModel.deleteOne({ _id: this.objectId(id) });
    if (!result.deletedCount) throw new NotFoundException('Riwayat pemeriksaan tidak ditemukan');
    await this.audit(user, 'medical_record.deleted', id, existing.patientId.toString());
    return { deleted: true };
  }

  async listVaccinations(
    user: AuthenticatedUser,
    patientId?: string,
    facilityId?: string,
    status?: VaccinationStatus,
    from?: string,
    to?: string,
    page = 1,
    limit = 20,
  ) {
    const scheduledDate: { $gte?: Date; $lte?: Date } = {};
    if (from) scheduledDate.$gte = this.dateValue(from, 'from');
    if (to) scheduledDate.$lte = this.dateValue(to, 'to');
    const filter = {
      patientId: await this.resolvePatientId(user, patientId),
      ...(facilityId ? { facilityId: this.objectId(facilityId) } : {}),
      ...(status ? { status } : {}),
      ...(Object.keys(scheduledDate).length ? { scheduledDate } : {}),
    };
    const [data, total] = await Promise.all([
      this.vaccinationModel.find(filter).sort({ scheduledDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.vaccinationModel.countDocuments(filter),
    ]);
    await this.audit(user, 'vaccination.listed', undefined, filter.patientId.toString());
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createVaccination(user: AuthenticatedUser, dto: CreateVaccinationDto) {
    const resolvedPatientId = await this.resolvePatientId(user, dto.patientId);
    const status = dto.status ?? (
      dto.administeredDate
        ? VaccinationStatus.COMPLETED
        : dto.scheduledDate
          ? VaccinationStatus.SCHEDULED
          : VaccinationStatus.PLANNED
    );
    this.validateVaccinationDates(status, dto.scheduledDate, dto.administeredDate);
    await this.validateVaccinationFacility(user, resolvedPatientId, dto.facilityId);
    if (status === VaccinationStatus.COMPLETED && user.role === Role.PREGNANT_MOTHER) {
      throw new ForbiddenException('Vaksin completed harus dicatat tenaga kesehatan');
    }
    const vaccination = await this.vaccinationModel.create({
      ...dto,
      patientId: resolvedPatientId,
      recordedBy: this.objectId(user.userId),
      facilityId: this.objectId(dto.facilityId),
      status,
      ...(dto.scheduledDate ? { scheduledDate: new Date(dto.scheduledDate) } : {}),
      ...(dto.administeredDate ? { administeredDate: new Date(dto.administeredDate) } : {}),
    });
    if (status === VaccinationStatus.COMPLETED) {
      vaccination.verifiedBy = this.objectId(user.userId);
      vaccination.verifiedAt = new Date();
      await vaccination.save();
    }
    await this.audit(user, 'vaccination.created', vaccination._id.toString(), resolvedPatientId.toString());
    return vaccination;
  }

  async updateVaccination(user: AuthenticatedUser, id: string, dto: UpdateVaccinationDto) {
    this.requireClinicalRole(user);
    const existing = await this.vaccinationModel
      .findById(this.objectId(id))
      .select('patientId facilityId status scheduledDate administeredDate')
      .lean();
    if (!existing) throw new NotFoundException('Data vaksinasi tidak ditemukan');
    await this.resolvePatientId(user, existing.patientId.toString());
    const status = dto.status ?? existing.status;
    const scheduledDate = dto.scheduledDate ?? existing.scheduledDate?.toISOString();
    const administeredDate = dto.administeredDate ?? existing.administeredDate?.toISOString();
    this.validateVaccinationDates(status, scheduledDate, administeredDate);
    await this.validateVaccinationFacility(
      user,
      existing.patientId,
      dto.facilityId ?? existing.facilityId.toString(),
    );
    if (status === VaccinationStatus.COMPLETED && user.role === Role.PREGNANT_MOTHER) {
      throw new ForbiddenException('Vaksin completed harus dicatat tenaga kesehatan');
    }
    const vaccination = await this.vaccinationModel.findOneAndUpdate(
      { _id: this.objectId(id) },
      {
        $set: {
          ...dto,
          ...(dto.scheduledDate ? { scheduledDate: new Date(dto.scheduledDate) } : {}),
          ...(dto.administeredDate ? { administeredDate: new Date(dto.administeredDate) } : {}),
          ...(dto.facilityId ? { facilityId: this.objectId(dto.facilityId) } : {}),
          recordedBy: this.objectId(user.userId),
          ...(status === VaccinationStatus.COMPLETED
            ? { verifiedBy: this.objectId(user.userId), verifiedAt: new Date() }
            : {}),
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!vaccination) throw new NotFoundException('Data vaksinasi tidak ditemukan');
    await this.audit(user, 'vaccination.updated', id, vaccination.patientId.toString());
    return vaccination;
  }

  async getVaccination(user: AuthenticatedUser, id: string, patientId?: string) {
    const vaccination = await this.vaccinationModel.findById(this.objectId(id)).lean();
    if (!vaccination) throw new NotFoundException('Data vaksinasi tidak ditemukan');
    await this.resolvePatientId(user, patientId ?? vaccination.patientId.toString());
    await this.audit(user, 'vaccination.accessed', id, vaccination.patientId.toString());
    return vaccination;
  }

  async verifyVaccination(user: AuthenticatedUser, id: string, dto: VerifyVaccinationDto) {
    this.requireClinicalRole(user);
    const existing = await this.vaccinationModel.findById(this.objectId(id)).lean();
    if (!existing) throw new NotFoundException('Data vaksinasi tidak ditemukan');
    await this.resolvePatientId(user, existing.patientId.toString());
    if (!existing.administeredDate) {
      throw new BadRequestException('administeredDate wajib diisi sebelum vaksin diverifikasi');
    }
    const vaccination = await this.vaccinationModel.findByIdAndUpdate(
      this.objectId(id),
      {
        $set: {
          status: VaccinationStatus.COMPLETED,
          verifiedBy: this.objectId(user.userId),
          verifiedAt: new Date(),
          ...(dto.note ? { verificationNote: dto.note } : {}),
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!vaccination) throw new NotFoundException('Data vaksinasi tidak ditemukan');
    await this.audit(user, 'vaccination.verified', id, vaccination.patientId.toString());
    return vaccination;
  }

  async deleteVaccination(user: AuthenticatedUser, id: string) {
    this.requireClinicalRole(user);
    const existing = await this.vaccinationModel.findById(this.objectId(id)).select('patientId').lean();
    if (!existing) throw new NotFoundException('Data vaksinasi tidak ditemukan');
    await this.resolvePatientId(user, existing.patientId.toString());
    const result = await this.vaccinationModel.deleteOne({
      _id: this.objectId(id),
    });
    if (!result.deletedCount) throw new NotFoundException('Data vaksinasi tidak ditemukan');
    await this.audit(user, 'vaccination.deleted', id, existing.patientId.toString());
    return { deleted: true };
  }

  async listAppointments(
    user: AuthenticatedUser,
    patientId?: string,
    status?: AncAppointmentStatus,
    from?: string,
    to?: string,
    page = 1,
    limit = 20,
  ) {
    const resolvedPatientId = await this.resolvePatientId(user, patientId);
    const scheduledAt: { $gte?: Date; $lte?: Date } = {};
    if (from) scheduledAt.$gte = this.dateValue(from, 'from');
    if (to) scheduledAt.$lte = this.dateValue(to, 'to');
    const filter = {
      patientId: resolvedPatientId,
      ...(status ? { status } : {}),
      ...(Object.keys(scheduledAt).length ? { scheduledAt } : {}),
    };
    const [data, total] = await Promise.all([
      this.appointmentModel.find(filter).sort({ scheduledAt: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.appointmentModel.countDocuments(filter),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getAppointment(user: AuthenticatedUser, id: string, patientId?: string) {
    const appointment = await this.appointmentModel.findById(this.objectId(id)).lean();
    if (!appointment) throw new NotFoundException('Jadwal ANC tidak ditemukan');
    await this.resolvePatientId(user, patientId ?? appointment.patientId.toString());
    return appointment;
  }

  async createAppointment(user: AuthenticatedUser, dto: CreateAncAppointmentDto) {
    if (![Role.PREGNANT_MOTHER, Role.MIDWIFE, Role.DOCTOR, Role.ADMIN].includes(user.role)) {
      throw new ForbiddenException('Role tidak memiliki izin membuat jadwal ANC');
    }
    const patientId = await this.resolvePatientId(user, dto.patientId);
    const scheduledAt = this.dateValue(dto.scheduledAt, 'scheduledAt');
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('scheduledAt harus berada di masa depan');
    }
    await this.validateAppointmentScope(user, patientId, dto.providerId, dto.facilityId);
    if (dto.providerId) {
      await this.validateAppointmentCapacity(dto.providerId, scheduledAt);
    }
    const patientProfile = await this.profileModel.findOne({ userId: patientId }).select('insuranceType').lean();
    const appointment = await this.appointmentModel.create({
      ...dto,
      insuranceType: dto.insuranceType ?? patientProfile?.insuranceType,
      patientId,
      providerId: dto.providerId ? this.objectId(dto.providerId) : undefined,
      facilityId: this.objectId(dto.facilityId),
      scheduledAt,
      createdBy: this.objectId(user.userId),
      status: AncAppointmentStatus.SCHEDULED,
    });
    return appointment;
  }

  async updateAppointment(user: AuthenticatedUser, id: string, dto: UpdateAncAppointmentDto) {
    this.requireClinicalRole(user);
    const existing = await this.appointmentModel.findById(this.objectId(id)).lean();
    if (!existing) throw new NotFoundException('Jadwal ANC tidak ditemukan');
    await this.resolvePatientId(user, existing.patientId.toString());
    const update: Record<string, unknown> = { ...dto };
    if (dto.scheduledAt) {
      const scheduledAt = this.dateValue(dto.scheduledAt, 'scheduledAt');
      if (scheduledAt <= new Date()) throw new BadRequestException('scheduledAt harus berada di masa depan');
      update.scheduledAt = scheduledAt;
    }
    if (dto.providerId) update.providerId = this.objectId(dto.providerId);
    if (dto.facilityId) update.facilityId = this.objectId(dto.facilityId);
    if (dto.providerId || dto.facilityId) {
      await this.validateAppointmentScope(
        user,
        existing.patientId,
        dto.providerId ?? existing.providerId?.toString(),
        dto.facilityId ?? existing.facilityId.toString(),
      );
    }
    const nextProviderId = dto.providerId ?? existing.providerId?.toString();
    const nextScheduledAt = (update.scheduledAt as Date | undefined) ?? existing.scheduledAt;
    if (nextProviderId && (dto.providerId || dto.scheduledAt)) {
      await this.validateAppointmentCapacity(nextProviderId, nextScheduledAt, id);
    }
    const appointment = await this.appointmentModel.findByIdAndUpdate(
      this.objectId(id),
      { $set: update },
      { new: true, runValidators: true },
    ).lean();
    if (!appointment) throw new NotFoundException('Jadwal ANC tidak ditemukan');
    if (dto.scheduledAt || dto.providerId) await this.slotReservationModel.deleteMany({ appointmentId: appointment._id });
    return appointment;
  }

  async cancelAppointment(user: AuthenticatedUser, id: string) {
    const existing = await this.appointmentModel.findById(this.objectId(id)).lean();
    if (!existing) throw new NotFoundException('Jadwal ANC tidak ditemukan');
    await this.resolvePatientId(user, existing.patientId.toString());
    if (![Role.PREGNANT_MOTHER, Role.MIDWIFE, Role.DOCTOR, Role.ADMIN].includes(user.role)) {
      throw new ForbiddenException('Role tidak memiliki izin membatalkan jadwal');
    }
    if ([AncAppointmentStatus.COMPLETED, AncAppointmentStatus.CANCELLED].includes(existing.status)) {
      throw new BadRequestException('Jadwal tidak dapat dibatalkan pada status saat ini');
    }
    const cancelled = await this.appointmentModel.findByIdAndUpdate(
      this.objectId(id),
      { $set: { status: AncAppointmentStatus.CANCELLED } },
      { new: true, runValidators: true },
    ).lean();
    await this.slotReservationModel.deleteMany({ appointmentId: this.objectId(id) });
    return cancelled;
  }

  async rescheduleAppointment(
    user: AuthenticatedUser,
    id: string,
    dto: RescheduleAncAppointmentDto,
  ) {
    const existing = await this.appointmentModel.findById(this.objectId(id)).lean();
    if (!existing) throw new NotFoundException('Jadwal ANC tidak ditemukan');
    await this.resolvePatientId(user, existing.patientId.toString());
    if (![Role.PREGNANT_MOTHER, Role.MIDWIFE, Role.DOCTOR, Role.ADMIN].includes(user.role)) {
      throw new ForbiddenException('Role tidak memiliki izin mengubah jadwal');
    }
    const scheduledAt = this.dateValue(dto.scheduledAt, 'scheduledAt');
    if (scheduledAt <= new Date()) throw new BadRequestException('scheduledAt harus berada di masa depan');
    if ([AncAppointmentStatus.COMPLETED, AncAppointmentStatus.CANCELLED].includes(existing.status)) {
      throw new BadRequestException('Jadwal tidak dapat di-reschedule pada status saat ini');
    }
    if (existing.providerId) {
      await this.validateAppointmentCapacity(existing.providerId.toString(), scheduledAt, id);
    }
    const rescheduled = await this.appointmentModel.findByIdAndUpdate(
      this.objectId(id),
      {
        $set: {
          scheduledAt,
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          status: AncAppointmentStatus.RESCHEDULED,
        },
      },
      { new: true, runValidators: true },
    ).lean();
    await this.slotReservationModel.deleteMany({ appointmentId: this.objectId(id) });
    return rescheduled;
  }

  private objectId(value: string) {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException('ID tidak valid');
    return new Types.ObjectId(value);
  }

  private async validateAppointmentCapacity(providerId: string, scheduledAt: Date, exceptId?: string) {
    const jakartaDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(scheduledAt);
    const dayStart = new Date(`${jakartaDate}T00:00:00+07:00`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const activeStatuses = [AncAppointmentStatus.SCHEDULED, AncAppointmentStatus.CONFIRMED, AncAppointmentStatus.RESCHEDULED];
    const commonFilter = {
      providerId: this.objectId(providerId),
      status: { $in: activeStatuses },
      scheduledAt: { $gte: dayStart, $lt: dayEnd },
      ...(exceptId ? { _id: { $ne: this.objectId(exceptId) } } : {}),
    };
    const [dailyCount, overlapping] = await Promise.all([
      this.appointmentModel.countDocuments(commonFilter),
      this.appointmentModel.exists({
        ...commonFilter,
        scheduledAt: {
          $gte: new Date(scheduledAt.getTime() - 15 * 60 * 1000),
          $lt: new Date(scheduledAt.getTime() + 15 * 60 * 1000),
        },
      }),
    ]);
    if (dailyCount >= 10) throw new BadRequestException('Kuota dokter untuk tanggal ini sudah mencapai 10 pasien');
    if (overlapping) throw new BadRequestException('Waktu konsultasi dokter bertabrakan dengan jadwal pasien lain');
  }

  private requireMotherRole(user: AuthenticatedUser) {
    if (user.role !== Role.PREGNANT_MOTHER) throw new ForbiddenException('Fitur ini hanya tersedia untuk akun ibu hamil');
  }

  private dateValue(value: string, field: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} harus berupa tanggal ISO 8601 yang valid`);
    }
    return date;
  }

  private requireClinicalRole(user: AuthenticatedUser) {
    if (![Role.MIDWIFE, Role.DOCTOR, Role.ADMIN].includes(user.role)) {
      throw new ForbiddenException('Role tidak memiliki izin untuk mengubah data klinis');
    }
  }

  private async validateAppointmentScope(
    user: AuthenticatedUser,
    patientId: Types.ObjectId,
    providerId?: string,
    facilityId?: string,
  ) {
    const facility = await this.facilityModel.findOne({
      _id: this.objectId(facilityId ?? ''),
      active: true,
    }).select('_id').lean();
    if (!facility) throw new BadRequestException('Fasilitas aktif tidak ditemukan');
    const profile = await this.profileModel.findOne({ userId: patientId })
      .select('facilityId assignedProviderIds').lean();
    if (!profile) throw new NotFoundException('Profil kehamilan pasien tidak ditemukan');
    if (profile.facilityId && profile.facilityId.toString() !== facilityId && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Fasilitas tidak sesuai dengan pasien');
    }
    if (providerId) {
      const provider = await this.userModel.findOne({
        _id: this.objectId(providerId),
        role: { $in: [Role.DOCTOR, Role.MIDWIFE] },
        status: 'ACTIVE',
      }).select('_id facilityId').lean();
      if (!provider) throw new BadRequestException('Provider aktif tidak ditemukan');
      if (user.role !== Role.ADMIN && !profile.assignedProviderIds.some((id) => id.toString() === providerId)) {
        throw new ForbiddenException('Provider tidak ditugaskan ke pasien');
      }
      if (provider.facilityId && provider.facilityId.toString() !== facilityId) {
        throw new ForbiddenException('Provider tidak berada pada fasilitas tersebut');
      }
    }
  }

  private async resolvePatientId(user: AuthenticatedUser, requestedPatientId?: string) {
    if (user.role === Role.PREGNANT_MOTHER) {
      if (requestedPatientId && requestedPatientId !== user.userId) {
        throw new ForbiddenException('Tidak dapat mengakses data pasien lain');
      }
      return this.objectId(user.userId);
    }
    if (!requestedPatientId) {
      throw new BadRequestException('patientId wajib diisi untuk role tenaga kesehatan');
    }
    const patientId = this.objectId(requestedPatientId);
    if (user.role === Role.ADMIN) return patientId;
    const profile = await this.profileModel.findOne({
      userId: patientId,
      assignedProviderIds: this.objectId(user.userId),
    }).select('_id').lean();
    if (!profile) throw new ForbiddenException('Pasien tidak berada dalam cakupan akses Anda');
    return patientId;
  }

  private validateVaccinationDates(
    status?: VaccinationStatus,
    scheduledDate?: string,
    administeredDate?: string,
  ) {
    if (status === VaccinationStatus.COMPLETED && !administeredDate) {
      throw new BadRequestException('administeredDate wajib diisi untuk vaksin yang completed');
    }
    if (
      [VaccinationStatus.PLANNED, VaccinationStatus.SCHEDULED].includes(status as VaccinationStatus) &&
      administeredDate
    ) {
      throw new BadRequestException('administeredDate hanya boleh diisi untuk vaksin yang completed');
    }
    if (
      [VaccinationStatus.SKIPPED, VaccinationStatus.CANCELLED].includes(status as VaccinationStatus) &&
      administeredDate
    ) {
      throw new BadRequestException('Vaksin skipped atau cancelled tidak boleh memiliki administeredDate');
    }
    if (administeredDate && scheduledDate) {
      const administered = this.dateValue(administeredDate, 'administeredDate');
      const scheduled = this.dateValue(scheduledDate, 'scheduledDate');
      if (administered < scheduled) {
        throw new BadRequestException('administeredDate tidak boleh sebelum scheduledDate');
      }
    }
  }

  private async validateVaccinationFacility(
    user: AuthenticatedUser,
    patientId: Types.ObjectId,
    facilityId: string,
  ) {
    const profile = await this.profileModel.findOne({ userId: patientId }).select('facilityId').lean();
    if (
      profile?.facilityId &&
      profile.facilityId.toString() !== facilityId &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Fasilitas vaksinasi tidak sesuai dengan fasilitas pasien');
    }
  }

  private async audit(
    actor: AuthenticatedUser,
    action: string,
    resourceId: string | undefined,
    patientId: string,
  ) {
    await this.auditModel.create({
      actorId: this.objectId(actor.userId),
      action,
      resourceType: action.startsWith('vaccination.') ? 'vaccination' : 'medical_record',
      resourceId,
      timestamp: new Date(),
      requestId: getRequestId(),
      metadata: { patientId },
    });
  }

  private decryptNik<T extends { nikEncrypted?: string; _decryptedNik?: string; nik?: string }>(profile: T | null): T | null {
    if (profile && profile.nikEncrypted) {
      try {
        profile._decryptedNik = this.encryptionService.decrypt(profile.nikEncrypted);
        profile.nik = profile._decryptedNik;
      } catch {
        profile._decryptedNik = '[DEKRIPSI GAGAL]';
        profile.nik = profile._decryptedNik;
      }
    }
    return profile;
  }
}
