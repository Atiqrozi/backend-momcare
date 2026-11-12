import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role, User, UserDocument } from '../users/schemas/user.schema';
import { AuditLog, AuditLogDocument } from '../users/schemas/audit-log.schema';
import {
  AncAppointment,
  AncAppointmentDocument,
  AncAppointmentStatus,
} from '../pregnancy/schemas/anc-appointment.schema';
import {
  PregnancyProfile,
  PregnancyProfileDocument,
} from '../pregnancy/schemas/pregnancy-profile.schema';
import { PregnancyJournal, PregnancyJournalDocument } from '../pregnancy/schemas/pregnancy-journal.schema';
import { MedicalRecord, MedicalRecordDocument } from '../pregnancy/schemas/medical-record.schema';
import { Vaccination, VaccinationDocument } from '../pregnancy/schemas/vaccination.schema';
import { RiskAssessment, RiskAssessmentDocument } from '../risk-assessments/schemas/risk-assessment.schema';
import { Facility, FacilityDocument } from '../facilities/schemas/facility.schema';
import { LaborBagDeliveryType, LaborBagEntry, LaborBagEntryDocument } from './schemas/labor-bag.schema';
import { calculateEstimatedDueDate } from '../common/estimated-due-date';
import { UpsertLaborBagDto } from './dto/upsert-labor-bag.dto';
import { EncryptionService } from '../common/crypto/encryption.service';

type DateRange = { $gte?: Date; $lte?: Date };

export type LaborBagProviderOption = { id: string; fullName: string };
export type LaborBagPatientOption = {
  patientId: string;
  fullName: string;
  nik?: string;
  bpjsNumber?: string;
  insuranceType: 'BPJS' | 'UMUM';
  estimatedDueDate?: Date;
  lmpDate?: Date;
  assignedProviders: LaborBagProviderOption[];
};
export type LaborBagRow = {
  _id: string;
  patientId: string;
  providerId: string;
  patientName: string;
  providerName: string;
  examinationDate: Date;
  insuranceType: 'BPJS' | 'UMUM';
  estimatedDueDate: Date;
  deliveryType: LaborBagDeliveryType;
  gestationalWeeks?: number;
  gestationalDays?: number;
};
export type LaborBagResponse = {
  entries: LaborBagRow[];
  patients: LaborBagPatientOption[];
  providers: LaborBagProviderOption[];
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(PregnancyProfile.name)
    private readonly profileModel: Model<PregnancyProfileDocument>,
    @InjectModel(AncAppointment.name)
    private readonly appointmentModel: Model<AncAppointmentDocument>,
    @InjectModel(PregnancyJournal.name)
    private readonly journalModel: Model<PregnancyJournalDocument>,
    @InjectModel(MedicalRecord.name)
    private readonly medicalRecordModel: Model<MedicalRecordDocument>,
    @InjectModel(Vaccination.name)
    private readonly vaccinationModel: Model<VaccinationDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
    @InjectModel(RiskAssessment.name) private readonly riskAssessmentModel: Model<RiskAssessmentDocument>,
    @InjectModel(LaborBagEntry.name) private readonly laborBagModel: Model<LaborBagEntryDocument>,
    @InjectModel(Facility.name) private readonly facilityModel: Model<FacilityDocument>,
    private readonly encryptionService: EncryptionService,
  ) {}

  async laborBag(user: AuthenticatedUser): Promise<LaborBagResponse> {
    const patientIds = await this.getPatientIds(user);
    const [entries, profiles, patients, providers] = await Promise.all([
      this.laborBagModel.find({ patientId: { $in: patientIds } }).sort({ estimatedDueDate: 1 }).lean(),
      this.profileModel.find({ userId: { $in: patientIds } }).select('+nikEncrypted').lean(),
      this.userModel.find({ _id: { $in: patientIds }, role: Role.PREGNANT_MOTHER }).select('_id +fullName fullNameEncrypted +legacyFullName').lean(),
      this.userModel.find({ role: Role.DOCTOR, status: 'ACTIVE' }).select('_id +fullName fullNameEncrypted +legacyFullName').sort({ fullName: 1 }).lean(),
    ]);

    // Prefer the stored plaintext fullName; otherwise fall back to legacy data or ciphertext.
    const decryptedPatients = patients.map(p => ({
      ...p,
      fullName: p.fullName ?? p.legacyFullName ?? this.decryptStoredValue(p.fullNameEncrypted) ?? '',
    }));

    const decryptedProviders = providers.map(p => ({
      ...p,
      fullName: p.fullName ?? p.legacyFullName ?? this.decryptStoredValue(p.fullNameEncrypted) ?? '',
    }));

    // Decrypt NIK in profiles
    const decryptedProfiles = profiles.map(p => ({
      ...p,
      nik: p.nikEncrypted ? this.encryptionService.decrypt(p.nikEncrypted) : undefined
    }));

    const patientMap = new Map(decryptedPatients.map((patient) => [patient._id.toString(), patient]));
    const candidates = decryptedPatients.map((person) => {
      const profile = decryptedProfiles.find((item) => item.userId.equals(person._id));
      return {
        patientId: person._id.toString(),
        fullName: person.fullName,
        nik: profile?.nik,
        bpjsNumber: profile?.bpjsNumber,
        insuranceType: profile?.insuranceType ?? 'BPJS',
        estimatedDueDate: profile?.estimatedDueDate,
        lmpDate: profile?.lmpDate,
        assignedProviders: decryptedProviders.map((provider) => ({ id: provider._id.toString(), fullName: provider.fullName })),
      };
    });
    return {
      entries: entries.map((entry) => ({
        ...entry,
        _id: entry._id.toString(),
        patientId: entry.patientId.toString(),
        providerId: entry.providerId.toString(),
        patientName: patientMap.get(entry.patientId.toString())?.fullName ?? 'Pasien',
        providerName: decryptedProviders.find((provider) => provider._id.equals(entry.providerId))?.fullName ?? 'Dokter tidak tersedia',
      })),
      patients: candidates,
      providers: decryptedProviders.map((provider) => ({ id: provider._id.toString(), fullName: provider.fullName })),
    };
  }

  async upsertLaborBag(user: AuthenticatedUser, dto: UpsertLaborBagDto) {
    const patientObjectId = this.objectId(dto.patientId);
    const patientIds = await this.getPatientIds(user);
    if (!patientIds.some((id) => id.equals(patientObjectId))) throw new ForbiddenException('Pasien tidak berada dalam cakupan akses Anda');
    const [pregnantPatient, profile, provider] = await Promise.all([
      this.userModel.findOne({ _id: patientObjectId, role: Role.PREGNANT_MOTHER }).select('_id').lean(),
      this.profileModel.findOne({ userId: patientObjectId }).select('+nikEncrypted').lean(),
      this.userModel.findOne({ _id: this.objectId(dto.providerId), role: Role.DOCTOR, status: 'ACTIVE' }).select('_id').lean(),
    ]);
    if (!pregnantPatient) throw new NotFoundException('Akun ibu hamil tidak ditemukan');
    if (!provider) throw new BadRequestException('DPJP harus dokter aktif yang terdaftar');
    const examinationDate = new Date(dto.examinationDate);
    const estimatedDueDate = dto.estimatedDueDate ? new Date(dto.estimatedDueDate) : profile?.estimatedDueDate ?? (profile?.lmpDate ? calculateEstimatedDueDate(profile.lmpDate.toISOString()) : undefined);
    if (!estimatedDueDate) throw new BadRequestException('HPL belum tersedia pada profil pasien');
    let gestationalWeeks: number | undefined;
    let gestationalDays: number | undefined;
    if (profile?.lmpDate) {
      const start = Date.UTC(profile.lmpDate.getUTCFullYear(), profile.lmpDate.getUTCMonth(), profile.lmpDate.getUTCDate());
      const end = Date.UTC(examinationDate.getUTCFullYear(), examinationDate.getUTCMonth(), examinationDate.getUTCDate());
      const days = Math.floor((end - start) / 86_400_000);
      if (days >= 0) {
        gestationalWeeks = Math.floor(days / 7);
        gestationalDays = days % 7;
      }
    }
    return this.laborBagModel.findOneAndUpdate(
      { patientId: patientObjectId },
      {
        patientId: patientObjectId,
        examinationDate,
        insuranceType: dto.insuranceType ?? profile?.insuranceType ?? 'BPJS',
        estimatedDueDate,
        deliveryType: dto.deliveryType,
        gestationalWeeks,
        gestationalDays,
        providerId: provider._id,
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
  }

  async removeLaborBag(user: AuthenticatedUser, patientId: string) {
    const patientObjectId = this.objectId(patientId);
    const patientIds = await this.getPatientIds(user);
    if (!patientIds.some((id) => id.equals(patientObjectId))) throw new ForbiddenException('Pasien tidak berada dalam cakupan akses Anda');
    await this.laborBagModel.deleteOne({ patientId: patientObjectId });
    return { success: true };
  }

  async summary(
    user: AuthenticatedUser,
    from?: string,
    to?: string,
    providerId?: string,
    facilityId?: string,
  ) {
    const patientIds = await this.getPatientIds(user, providerId, facilityId);
    const dateRange = this.dateRange(from, to);
    const now = new Date();
    const appointmentFilter = {
      patientId: { $in: patientIds },
      ...(providerId ? { providerId: this.objectId(providerId) } : {}),
      ...(facilityId ? { facilityId: this.objectId(facilityId) } : {}),
      ...(dateRange ? { scheduledAt: dateRange } : {}),
    };
    const jakartaNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const monthStartUtc = Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth(), 1) - 7 * 60 * 60 * 1000;
    const todayStart = new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth(), jakartaNow.getUTCDate()) - 7 * 60 * 60 * 1000);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const trendStart = new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth() - 5, 1) - 7 * 60 * 60 * 1000);
    const [patientCount, profiles, totalAppointments, upcomingAppointments, completedAppointments, missedAppointments, todayAppointments, recentAppointments, riskRows] =
      await Promise.all([
        this.profileModel.countDocuments({ userId: { $in: patientIds } }),
        this.profileModel.find({ userId: { $in: patientIds } }).select('userId lmpDate').lean(),
        this.appointmentModel.countDocuments(appointmentFilter),
        this.appointmentModel.countDocuments({
          ...appointmentFilter,
          scheduledAt: { ...(dateRange ?? {}), $gte: now },
          status: { $in: [AncAppointmentStatus.SCHEDULED, AncAppointmentStatus.CONFIRMED, AncAppointmentStatus.RESCHEDULED] },
        }),
        this.appointmentModel.countDocuments({
          ...appointmentFilter,
          status: AncAppointmentStatus.COMPLETED,
        }),
        this.missedFilter(patientIds, dateRange),
        this.appointmentModel.countDocuments({ ...appointmentFilter, scheduledAt: { $gte: todayStart, $lt: todayEnd }, status: { $in: [AncAppointmentStatus.SCHEDULED, AncAppointmentStatus.CONFIRMED, AncAppointmentStatus.RESCHEDULED, AncAppointmentStatus.COMPLETED] } }),
        this.appointmentModel.find({ patientId: { $in: patientIds }, scheduledAt: { $gte: trendStart, $lte: now }, status: { $ne: AncAppointmentStatus.CANCELLED } }).select('scheduledAt status').lean(),
        this.riskAssessmentModel.find({ patientId: { $in: patientIds } }).sort({ assessedAt: -1 }).select('patientId level').lean(),
      ]);

    const latestRiskByPatient = new Map<string, string>();
    for (const risk of riskRows) if (!latestRiskByPatient.has(risk.patientId.toString())) latestRiskByPatient.set(risk.patientId.toString(), risk.level);
    const riskSummary = { elevated: 0, followUp: 0, awaitingAssessment: Math.max(patientCount - latestRiskByPatient.size, 0) };
    for (const level of latestRiskByPatient.values()) {
      if (level === 'urgent' || level === 'elevated') riskSummary.elevated += 1;
      else if (level === 'follow_up') riskSummary.followUp += 1;
    }
    const trimesterDistribution = { trimester1: 0, trimester2: 0, trimester3: 0, unknown: 0 };
    for (const profile of profiles) {
      if (!profile.lmpDate) { trimesterDistribution.unknown += 1; continue; }
      const week = Math.max(0, Math.floor((now.getTime() - profile.lmpDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
      if (week <= 13) trimesterDistribution.trimester1 += 1;
      else if (week <= 27) trimesterDistribution.trimester2 += 1;
      else trimesterDistribution.trimester3 += 1;
    }
    const monthlyAppointments = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth() - 5 + index, 1));
      const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const monthAppointments = recentAppointments.filter((item) => {
        const itemDate = new Date(item.scheduledAt.getTime() + 7 * 60 * 60 * 1000);
        return itemDate.getUTCFullYear() === date.getUTCFullYear() && itemDate.getUTCMonth() === date.getUTCMonth();
      });
      return { month, total: monthAppointments.length, completed: monthAppointments.filter((item) => item.status === AncAppointmentStatus.COMPLETED).length };
    });

    return {
      patients: patientCount,
      appointments: {
        total: totalAppointments,
        today: todayAppointments,
        upcoming: upcomingAppointments,
        completed: completedAppointments,
        missed: missedAppointments,
      },
      risk: riskSummary,
      trimesterDistribution,
      monthlyAppointments,
      generatedAt: now,
    };
  }

  async appointments(
    user: AuthenticatedUser,
    from?: string,
    to?: string,
    status?: AncAppointmentStatus,
    patientId?: string,
    providerId?: string,
    facilityId?: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: Array<Record<string, unknown>>;
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const patientIds = await this.getPatientIds(user, providerId, facilityId);
    const resolvedPatientId = this.filterPatientId(patientId, patientIds);
    const scheduledAt = this.dateRange(from, to);
    const [currentUser, patientFacilityIds] = user.role === Role.ADMIN
      ? [null, [] as Types.ObjectId[]]
      : await Promise.all([
          this.userModel.findById(user.userId).select('facilityId').lean(),
          this.profileModel.find({ userId: { $in: patientIds }, facilityId: { $exists: true } }).distinct('facilityId'),
        ]);
    const scopedFacilityIds = [...new Set([
      ...(currentUser?.facilityId ? [currentUser.facilityId.toString()] : []),
      ...patientFacilityIds.map((id) => id.toString()),
    ])].map((id) => this.objectId(id));
    const scopeFilter = user.role === Role.ADMIN
      ? (resolvedPatientId ? { patientId: resolvedPatientId } : {})
      : resolvedPatientId
        ? { patientId: resolvedPatientId }
      : {
          $or: [
            { patientId: { $in: patientIds } },
            { providerId: this.objectId(user.userId) },
            { createdBy: this.objectId(user.userId) },
            ...(scopedFacilityIds.length ? [{ facilityId: { $in: scopedFacilityIds } }] : []),
          ],
        };
    const filter = {
      ...scopeFilter,
      ...(providerId ? { providerId: this.objectId(providerId) } : {}),
      ...(facilityId ? { facilityId: this.objectId(facilityId) } : {}),
      ...(status ? { status } : {}),
      ...(scheduledAt ? { scheduledAt } : {}),
    };
    const [appointments, total] = await Promise.all([
      this.appointmentModel.find(filter).sort({ scheduledAt: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.appointmentModel.countDocuments(filter),
    ]);
    const relatedUserIds = [...new Set(appointments.flatMap((item) => [item.patientId.toString(), ...(item.providerId ? [item.providerId.toString()] : [])]))]
      .map((id) => this.objectId(id));
    const facilityIds = [...new Set(appointments.map((item) => item.facilityId.toString()))].map((id) => this.objectId(id));
    const [users, facilities] = await Promise.all([
      this.userModel.find({ _id: { $in: relatedUserIds } }).select('_id +fullName +fullNameEncrypted +legacyFullName').lean(),
      this.facilityModel.find({ _id: { $in: facilityIds } }).select('_id name address').lean(),
    ]);
    const userNames = new Map(users.map((item) => [item._id.toString(), item.fullName ?? item.legacyFullName ?? this.decryptStoredValue(item.fullNameEncrypted) ?? '']));
    const facilityMap = new Map(facilities.map((item) => [item._id.toString(), item]));
    const data = appointments.map((item) => ({
      ...item,
      patientName: userNames.get(item.patientId.toString()) ?? 'Pasien',
      providerName: item.providerId ? userNames.get(item.providerId.toString()) ?? 'Dokter belum ditentukan' : 'Dokter belum ditentukan',
      facilityName: facilityMap.get(item.facilityId.toString())?.name ?? 'Fasilitas tidak tersedia',
      facilityAddress: facilityMap.get(item.facilityId.toString())?.address ?? '',
    }));
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async missedAppointments(
    user: AuthenticatedUser,
    from?: string,
    to?: string,
    providerId?: string,
    facilityId?: string,
    page = 1,
    limit = 20,
  ) {
    const patientIds = await this.getPatientIds(user, providerId, facilityId);
    const scheduledAt = this.dateRange(from, to);
    const missed = {
      patientId: { $in: patientIds },
      ...(providerId ? { providerId: this.objectId(providerId) } : {}),
      ...(facilityId ? { facilityId: this.objectId(facilityId) } : {}),
      ...(scheduledAt ? { scheduledAt } : {}),
      $or: [
        { status: AncAppointmentStatus.MISSED },
        {
          status: { $in: [AncAppointmentStatus.SCHEDULED, AncAppointmentStatus.CONFIRMED] },
          scheduledAt: { ...(scheduledAt ?? {}), $lt: new Date() },
        },
      ],
    };
    const [data, total] = await Promise.all([
      this.appointmentModel.find(missed).sort({ scheduledAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.appointmentModel.countDocuments(missed),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async patients(
    user: AuthenticatedUser,
    search?: string,
    pregnancyStatus?: string,
    providerId?: string,
    facilityId?: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: unknown[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const patientIds = await this.getPatientIds(user, providerId, facilityId);
    const userFilter = { _id: { $in: patientIds }, role: Role.PREGNANT_MOTHER };
    let users = await this.userModel.find(userFilter).select('_id +fullName fullNameEncrypted +legacyFullName email phone status role').sort({ updatedAt: -1 }).lean();
    const profiles = await this.profileModel.find({
      userId: { $in: patientIds },
      ...(pregnancyStatus ? { pregnancyStatus } : {}),
    }).select('+nikEncrypted').sort({ updatedAt: -1 }).lean();
    const profileMap = new Map(profiles.map((profile) => [profile.userId.toString(), profile]));
    users = users.map((item) => ({
      ...item,
      fullName: item.fullName ?? item.legacyFullName ?? this.decryptStoredValue(item.fullNameEncrypted) ?? '',
    }));
    if (pregnancyStatus) {
      const usersWithMatchingProfile = new Set(profiles.map((profile) => profile.userId.toString()));
      users = users.filter((item) => usersWithMatchingProfile.has(item._id.toString()));
    }
    if (search) {
      const term = search.toLocaleLowerCase('id-ID');
      users = users.filter((item) => {
        const profile = profileMap.get(item._id.toString());
        const nik = this.decryptStoredValue(profile?.nikEncrypted);
        return (item.fullName ?? '').toLocaleLowerCase('id-ID').includes(term)
          || (nik?.includes(search) ?? false)
          || (profile?.bpjsNumber?.includes(search) ?? false);
      });
    }
    const total = users.length;
    const pageUsers = users.slice((page - 1) * limit, page * limit);
    const pagePatientIds = pageUsers.map((item) => item._id);
    const [records, riskAssessments] = await Promise.all([
      this.medicalRecordModel.find({ patientId: { $in: pagePatientIds } }).sort({ recordDate: -1 }).lean(),
      this.riskAssessmentModel.find({ patientId: { $in: pagePatientIds } }).sort({ assessedAt: -1 }).lean(),
    ]);
    const latestRecords = new Map<string, (typeof records)[number]>();
    for (const record of records) if (!latestRecords.has(record.patientId.toString())) latestRecords.set(record.patientId.toString(), record);
    const latestRisks = new Map<string, (typeof riskAssessments)[number]>();
    for (const assessment of riskAssessments) if (!latestRisks.has(assessment.patientId.toString())) latestRisks.set(assessment.patientId.toString(), assessment);
    const data = pageUsers.map((patient) => ({
      ...(profileMap.get(patient._id.toString()) ?? {}),
      userId: patient._id,
      patient,
      latestMedicalRecord: latestRecords.get(patient._id.toString()) ?? null,
      latestRiskAssessment: latestRisks.get(patient._id.toString()) ?? null,
    }));
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async patientDetail(user: AuthenticatedUser, patientId: string): Promise<unknown> {
    const patientObjectId = this.objectId(patientId);
    const patientIds = await this.getPatientIds(user);
    if (!patientIds.some((id) => id.equals(patientObjectId))) {
      throw new ForbiddenException('Pasien tidak berada dalam cakupan akses Anda');
    }
    const [patient, profile, appointments, medicalRecords, vaccinations, journals, latestRiskAssessment] = await Promise.all([
      this.userModel.findById(patientObjectId).select('_id +fullName fullNameEncrypted +legacyFullName email phone status role').lean(),
      this.profileModel.findOne({ userId: patientObjectId }).select('+nikEncrypted').lean(),
      this.appointmentModel.find({ patientId: patientObjectId }).sort({ scheduledAt: -1 }).limit(20).lean(),
      this.medicalRecordModel.find({ patientId: patientObjectId }).sort({ recordDate: -1 }).limit(20).lean(),
      this.vaccinationModel.find({ patientId: patientObjectId }).sort({ scheduledDate: -1 }).limit(20).lean(),
      this.journalModel.find({ patientId: patientObjectId }).sort({ entryDate: -1 }).limit(10).lean(),
      this.riskAssessmentModel.findOne({ patientId: patientObjectId }).sort({ assessedAt: -1 }).lean(),
    ]);
    if (!patient || !profile) throw new NotFoundException('Pasien tidak ditemukan');
    const decryptedPatient = {
      ...patient,
      fullName: patient.fullName ?? patient.legacyFullName ?? this.decryptStoredValue(patient.fullNameEncrypted) ?? '',
    };
    const decryptedProfile = {
      ...profile,
      nik: this.decryptStoredValue(profile.nikEncrypted),
    };
    return { patient: decryptedPatient, profile: decryptedProfile, appointments, medicalRecords, vaccinations, journals, latestRiskAssessment };
  }

  async patientProviders(user: AuthenticatedUser, patientId: string) {
    const patientObjectId = this.objectId(patientId);
    const patientIds = await this.getPatientIds(user);
    if (!patientIds.some((id) => id.equals(patientObjectId))) {
      throw new ForbiddenException('Pasien tidak berada dalam cakupan akses Anda');
    }
    const profile = await this.profileModel.findOne({ userId: patientObjectId })
      .select('assignedProviderIds').lean();
    const ids = profile?.assignedProviderIds ?? [];
    const providers = await this.userModel.find({
      ...(user.role === Role.ADMIN ? {} : { _id: { $in: ids } }),
      role: { $in: [Role.DOCTOR, Role.MIDWIFE] },
      status: 'ACTIVE',
    }).select('_id +fullName fullNameEncrypted +legacyFullName facilityId').sort({ fullName: 1 }).lean();
    return providers.map((provider) => ({
      _id: provider._id.toString(),
      fullName: provider.fullName ?? provider.legacyFullName ?? this.decryptStoredValue(provider.fullNameEncrypted) ?? '',
      facilityId: provider.facilityId?.toString(),
    }));
  }

  private decryptStoredValue(value?: string): string | undefined {
    if (!value) return undefined;
    try {
      return this.encryptionService.decrypt(value);
    } catch {
      return '[DEKRIPSI GAGAL]';
    }
  }

  async auditLogs(
    user: AuthenticatedUser,
    action?: string,
    resourceType?: string,
    from?: string,
    to?: string,
    page = 1,
    limit = 20,
  ) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Hanya admin yang dapat mengakses audit log');
    }
    const timestamp = this.dateRange(from, to);
    const filter = {
      ...(action ? { action } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(timestamp ? { timestamp } : {}),
    };
    const [data, total] = await Promise.all([
      this.auditModel.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.auditModel.countDocuments(filter),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async getPatientIds(
    user: AuthenticatedUser,
    requestedProviderId?: string,
    requestedFacilityId?: string,
  ): Promise<Types.ObjectId[]> {
    if (user.role === Role.ADMIN) {
      if (!requestedProviderId && !requestedFacilityId) {
        return this.userModel.find({ role: Role.PREGNANT_MOTHER }).distinct('_id');
      }
      return this.profileModel.find({
        ...(requestedProviderId
          ? { assignedProviderIds: this.objectId(requestedProviderId) }
          : {}),
        ...(requestedFacilityId ? { facilityId: this.objectId(requestedFacilityId) } : {}),
      }).distinct('userId');
    }
    if (![Role.MIDWIFE, Role.DOCTOR].includes(user.role)) {
      throw new ForbiddenException('Role tidak memiliki akses ke dashboard provider');
    }
    const providerId = this.objectId(user.userId);
    if (requestedProviderId && requestedProviderId !== user.userId) {
      throw new ForbiddenException('Provider tidak berada dalam cakupan akses Anda');
    }
    return this.profileModel.find({
      assignedProviderIds: providerId,
      ...(requestedFacilityId ? { facilityId: this.objectId(requestedFacilityId) } : {}),
    }).distinct('userId');
  }

  private async missedFilter(patientIds: Types.ObjectId[], dateRange?: DateRange) {
    return this.appointmentModel.countDocuments({
      patientId: { $in: patientIds },
      ...(dateRange ? { scheduledAt: dateRange } : {}),
      $or: [
        { status: AncAppointmentStatus.MISSED },
        {
          status: { $in: [AncAppointmentStatus.SCHEDULED, AncAppointmentStatus.CONFIRMED] },
          scheduledAt: { ...(dateRange ?? {}), $lt: new Date() },
        },
      ],
    });
  }

  private filterPatientId(value: string | undefined, patientIds: Types.ObjectId[]) {
    if (!value) return undefined;
    const patientId = this.objectId(value);
    if (!patientIds.some((id) => id.equals(patientId))) {
      throw new ForbiddenException('Pasien tidak berada dalam cakupan akses Anda');
    }
    return patientId;
  }

  private dateRange(from?: string, to?: string): DateRange | undefined {
    if (!from && !to) return undefined;
    const range: DateRange = {};
    if (from) range.$gte = this.dateValue(from, 'from');
    if (to) range.$lte = this.dateValue(to, 'to');
    if (range.$gte && range.$lte && range.$gte > range.$lte) {
      throw new BadRequestException('from tidak boleh setelah to');
    }
    return range;
  }

  private dateValue(value: string, field: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} harus berupa tanggal ISO 8601 yang valid`);
    }
    return date;
  }

  private objectId(value: string) {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException('ID pasien tidak valid');
    return new Types.ObjectId(value);
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
