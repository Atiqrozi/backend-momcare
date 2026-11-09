import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { AuditLog, AuditLogDocument } from '../users/schemas/audit-log.schema';
import { getRequestId } from '../common/request-context';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateHospitalServiceDto } from './dto/create-hospital-service.dto';
import { UpdateHospitalServiceDto } from './dto/update-hospital-service.dto';
import { HospitalService, HospitalServiceDocument, HospitalServiceStatus } from './schemas/hospital-service.schema';

@Injectable()
export class HospitalServiceService {
  constructor(
    @InjectModel(HospitalService.name) private readonly model: Model<HospitalServiceDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async list(page = 1, limit = 20) {
    const filter = { status: HospitalServiceStatus.PUBLISHED };
    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.model.countDocuments(filter),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async get(slug: string) {
    const service = await this.model.findOne({ slug, status: HospitalServiceStatus.PUBLISHED }).lean();
    if (!service) throw new NotFoundException('Layanan rumah sakit tidak ditemukan');
    return service;
  }

  async create(user: AuthenticatedUser, dto: CreateHospitalServiceDto) {
    const exists = await this.model.exists({ slug: dto.slug.toLowerCase() });
    if (exists) throw new ConflictException('Slug layanan sudah digunakan');
    const service = await this.model.create({ ...dto, slug: this.slug(dto.slug), updatedBy: user.userId });
    await this.audit(user, 'hospital_service.created', service._id.toString());
    return service;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateHospitalServiceDto) {
    const service = await this.model.findByIdAndUpdate(
      id,
      { $set: { ...dto, updatedBy: user.userId } },
      { new: true, runValidators: true },
    ).lean();
    if (!service) throw new NotFoundException('Layanan rumah sakit tidak ditemukan');
    await this.audit(user, 'hospital_service.updated', id);
    return service;
  }

  async publish(user: AuthenticatedUser, id: string) {
    const service = await this.model.findByIdAndUpdate(
      id,
      { $set: { status: HospitalServiceStatus.PUBLISHED, updatedBy: user.userId } },
      { new: true, runValidators: true },
    ).lean();
    if (!service) throw new NotFoundException('Layanan rumah sakit tidak ditemukan');
    await this.audit(user, 'hospital_service.published', id);
    return service;
  }

  async listInternal(page = 1, limit = 20, status?: HospitalServiceStatus, department?: string) {
    const filter = { ...(status ? { status } : {}), ...(department ? { department } : {}) };
    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.model.countDocuments(filter),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async archive(user: AuthenticatedUser, id: string) {
    const service = await this.model.findByIdAndUpdate(
      id,
      { $set: { status: HospitalServiceStatus.ARCHIVED, updatedBy: user.userId } },
      { new: true, runValidators: true },
    ).lean();
    if (!service) throw new NotFoundException('Layanan rumah sakit tidak ditemukan');
    await this.audit(user, 'hospital_service.archived', id);
    return service;
  }

  private slug(value: string) {
    const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) throw new BadRequestException('Slug layanan tidak valid');
    return slug;
  }

  private async audit(actor: AuthenticatedUser, action: string, resourceId: string) {
    await this.auditModel.create({
      actorId: new Types.ObjectId(actor.userId),
      action,
      resourceType: 'hospital_service',
      resourceId,
      timestamp: new Date(),
      requestId: getRequestId(),
    });
  }
}
