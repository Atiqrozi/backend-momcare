import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuditLog, AuditLogDocument } from '../users/schemas/audit-log.schema';
import { getRequestId } from '../common/request-context';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { Facility, FacilityDocument } from './schemas/facility.schema';

@Injectable()
export class FacilitiesService {
  constructor(
    @InjectModel(Facility.name) private readonly facilityModel: Model<FacilityDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  list() {
    return this.facilityModel.find({ active: true }).sort({ name: 1 }).lean();
  }

  async create(actor: AuthenticatedUser, dto: CreateFacilityDto) {
    const code = dto.code.toLowerCase();
    if (await this.facilityModel.exists({ code })) throw new ConflictException('Kode fasilitas sudah digunakan');
    const facility = await this.facilityModel.create({ ...dto, code });
    await this.audit(actor, 'facility.created', facility._id.toString());
    return facility;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateFacilityDto) {
    if (dto.code) {
      const code = dto.code.toLowerCase();
      if (await this.facilityModel.exists({ code, _id: { $ne: id } })) {
        throw new ConflictException('Kode fasilitas sudah digunakan');
      }
      dto.code = code;
    }
    const facility = await this.facilityModel.findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true }).lean();
    if (!facility) throw new NotFoundException('Fasilitas tidak ditemukan');
    await this.audit(actor, 'facility.updated', id);
    return facility;
  }

  async archive(actor: AuthenticatedUser, id: string) {
    const facility = await this.facilityModel.findByIdAndUpdate(id, { $set: { active: false } }, { new: true }).lean();
    if (!facility) throw new NotFoundException('Fasilitas tidak ditemukan');
    await this.audit(actor, 'facility.archived', id);
    return facility;
  }

  private audit(actor: AuthenticatedUser, action: string, resourceId: string) {
    return this.auditModel.create({
      actorId: actor.userId,
      action,
      resourceType: 'facility',
      resourceId,
      timestamp: new Date(),
      requestId: getRequestId(),
    });
  }
}
