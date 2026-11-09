import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AccountStatus, Role, User, UserDocument } from './schemas/user.schema';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { getRequestId } from '../common/request-context';
import { PregnancyProfile, PregnancyProfileDocument } from '../pregnancy/schemas/pregnancy-profile.schema';
import { Facility, FacilityDocument } from '../facilities/schemas/facility.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
    @InjectModel(PregnancyProfile.name) private readonly profileModel: Model<PregnancyProfileDocument>,
    @InjectModel(Facility.name) private readonly facilityModel: Model<FacilityDocument>,
    private readonly config: ConfigService,
  ) {}

  async list(page = 1, limit = 20, role?: Role, status?: AccountStatus) {
    const filter = { ...(role ? { role } : {}), ...(status ? { status } : {}) };
    const [users, total] = await Promise.all([
      this.userModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      this.userModel.countDocuments(filter),
    ]);
    return {
      data: users.map((user) => this.publicUser(user)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createStaff(actor: AuthenticatedUser, dto: CreateStaffUserDto) {
    const email = dto.email.toLowerCase();
    if (await this.userModel.exists({ email })) throw new ConflictException('Email sudah terdaftar');
    const passwordHash = await bcrypt.hash(dto.password, this.config.get<number>('passwordHashRounds', 12));
    const user = await this.userModel.create({
      fullName: dto.fullName,
      email,
      phone: dto.phone,
      passwordHash,
      role: dto.role,
      ...(dto.facilityId ? { facilityId: new Types.ObjectId(dto.facilityId) } : {}),
      status: AccountStatus.ACTIVE,
      consentGranted: false,
      emailVerified: false,
      phoneVerified: false,
    });
    await this.audit(actor, 'user.created', user._id.toString());
    return { user: this.publicUser(user) };
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateUserAdminDto) {
    if (id === actor.userId && dto.role && dto.role !== Role.ADMIN) {
      throw new ConflictException('Admin tidak dapat menurunkan role dirinya sendiri');
    }
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { $set: { ...dto, ...(dto.facilityId ? { facilityId: new Types.ObjectId(dto.facilityId) } : {}) } },
      { new: true, runValidators: true },
    );
    if (!user) throw new NotFoundException('Pengguna tidak ditemukan');
    await this.audit(actor, 'user.updated', id, {
      ...(dto.role ? { role: dto.role } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    });
    return { user: this.publicUser(user) };
  }

  async disable(actor: AuthenticatedUser, id: string) {
    return this.update(actor, id, { status: AccountStatus.DISABLED });
  }

  async assignProvider(actor: AuthenticatedUser, patientId: string, providerId: string) {
    const [patient, provider] = await Promise.all([
      this.userModel.findById(patientId).select('_id role').lean(),
      this.userModel.findById(providerId).select('_id role status').lean(),
    ]);
    if (!patient || patient.role !== Role.PREGNANT_MOTHER) throw new NotFoundException('Pasien tidak ditemukan');
    if (!provider || ![Role.DOCTOR, Role.MIDWIFE].includes(provider.role) || provider.status !== AccountStatus.ACTIVE) {
      throw new NotFoundException('Provider aktif tidak ditemukan');
    }
    const profile = await this.profileModel.findOneAndUpdate(
      { userId: patientId },
      { $addToSet: { assignedProviderIds: new Types.ObjectId(providerId) } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    await this.audit(actor, 'provider.assigned', patientId, { providerId });
    return profile;
  }

  async unassignProvider(actor: AuthenticatedUser, patientId: string, providerId: string) {
    const profile = await this.profileModel.findOneAndUpdate(
      { userId: patientId },
      { $pull: { assignedProviderIds: new Types.ObjectId(providerId) } },
      { new: true },
    ).lean();
    if (!profile) throw new NotFoundException('Profil kehamilan tidak ditemukan');
    await this.audit(actor, 'provider.unassigned', patientId, { providerId });
    return profile;
  }

  async assignFacility(actor: AuthenticatedUser, patientId: string, facilityId: string) {
    const [patient, facility] = await Promise.all([
      this.userModel.findOne({ _id: patientId, role: Role.PREGNANT_MOTHER }).select('_id').lean(),
      this.facilityModel.findOne({ _id: facilityId, active: true }).select('_id').lean(),
    ]);
    if (!patient) throw new NotFoundException('Pasien tidak ditemukan');
    if (!facility) throw new NotFoundException('Fasilitas aktif tidak ditemukan');
    const profile = await this.profileModel.findOneAndUpdate(
      { userId: patientId },
      { $set: { facilityId: new Types.ObjectId(facilityId) } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    await this.audit(actor, 'patient.facility_assigned', patientId, { facilityId });
    return profile;
  }

  async listAuditLogs(page = 1, limit = 20, action?: string) {
    const filter = action ? { action } : {};
    const [data, total] = await Promise.all([
      this.auditModel.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.auditModel.countDocuments(filter),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async audit(actor: AuthenticatedUser | undefined, action: string, resourceId?: string, metadata?: Record<string, string>) {
    await this.auditModel.create({
      actorId: actor ? this.objectId(actor.userId) : undefined,
      action,
      resourceType: 'user',
      resourceId,
      timestamp: new Date(),
      requestId: getRequestId(),
      metadata,
    });
  }

  publicUser(user: UserDocument) {
    return {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      consentGranted: user.consentGranted,
      consentVersion: user.consentVersion,
      facilityId: user.facilityId?.toString(),
    };
  }

  private objectId(value: string) {
    return new Types.ObjectId(value);
  }
}
