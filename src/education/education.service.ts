import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../users/schemas/audit-log.schema';
import { getRequestId } from '../common/request-context';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  EducationContent,
  EducationContentDocument,
  EducationContentStatus,
} from './schemas/education-content.schema';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';

@Injectable()
export class EducationService {
  constructor(
    @InjectModel(EducationContent.name) private readonly model: Model<EducationContentDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  listPublished(page = 1, limit = 20, category?: string) {
    const filter = { status: EducationContentStatus.PUBLISHED, ...(category ? { category } : {}) };
    return this.paginate(filter, page, limit);
  }

  async getPublished(slug: string) {
    const content = await this.model.findOne({ slug, status: EducationContentStatus.PUBLISHED }).lean();
    if (!content) throw new NotFoundException('Materi edukasi tidak ditemukan');
    return content;
  }

  async listInternal(page = 1, limit = 20, status?: EducationContentStatus, category?: string) {
    const filter = { ...(status ? { status } : {}), ...(category ? { category } : {}) };
    return this.paginate(filter, page, limit);
  }

  async create(user: AuthenticatedUser, dto: CreateEducationDto) {
    const exists = await this.model.exists({ slug: dto.slug.toLowerCase() });
    if (exists) throw new ConflictException('Slug materi sudah digunakan');
    const content = await this.model.create({ ...dto, slug: dto.slug.toLowerCase(), createdBy: this.objectId(user.userId) });
    await this.audit(user, 'education.created', content._id.toString());
    return content;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateEducationDto) {
    const content = await this.model.findOneAndUpdate(
      { _id: this.objectId(id), createdBy: this.objectId(user.userId), status: EducationContentStatus.DRAFT },
      { $set: dto },
      { new: true, runValidators: true },
    ).lean();
    if (!content) throw new NotFoundException('Draf materi tidak ditemukan');
    await this.audit(user, 'education.updated', id);
    return content;
  }

  async submitReview(user: AuthenticatedUser, id: string) {
    const content = await this.changeStatus(user, id, EducationContentStatus.DRAFT, EducationContentStatus.IN_REVIEW);
    await this.audit(user, 'education.submitted_for_review', id);
    return content;
  }

  async approve(user: AuthenticatedUser, id: string) {
    const content = await this.model.findOneAndUpdate(
      { _id: this.objectId(id), createdBy: { $ne: this.objectId(user.userId) }, status: EducationContentStatus.IN_REVIEW },
      {
        $set: {
          status: EducationContentStatus.APPROVED,
          reviewedBy: this.objectId(user.userId),
          reviewedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!content) throw new NotFoundException('Konten dalam review tidak ditemukan');
    await this.audit(user, 'education.approved', id);
    return content;
  }

  async publish(user: AuthenticatedUser, id: string, sourceVersion?: string) {
    const content = await this.model.findOneAndUpdate(
      { _id: this.objectId(id), status: EducationContentStatus.APPROVED },
      {
        $set: {
          status: EducationContentStatus.PUBLISHED,
          publishedAt: new Date(),
          ...(sourceVersion ? { sourceVersion } : {}),
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!content) throw new NotFoundException('Konten yang disetujui tidak ditemukan');
    await this.audit(user, 'education.published', id);
    return content;
  }

  async reject(user: AuthenticatedUser, id: string, note: string) {
    const content = await this.model.findOneAndUpdate(
      { _id: this.objectId(id), createdBy: { $ne: this.objectId(user.userId) }, status: EducationContentStatus.IN_REVIEW },
      { $set: { status: EducationContentStatus.DRAFT, reviewedBy: this.objectId(user.userId), reviewedAt: new Date(), reviewNote: note } },
      { new: true, runValidators: true },
    ).lean();
    if (!content) throw new NotFoundException('Konten dalam review tidak ditemukan');
    await this.audit(user, 'education.rejected', id);
    return content;
  }

  async archive(user: AuthenticatedUser, id: string) {
    const content = await this.model.findOneAndUpdate(
      { _id: this.objectId(id), status: EducationContentStatus.PUBLISHED },
      { $set: { status: EducationContentStatus.ARCHIVED, reviewedBy: this.objectId(user.userId) } },
      { new: true, runValidators: true },
    ).lean();
    if (!content) throw new NotFoundException('Konten terbit tidak ditemukan');
    await this.audit(user, 'education.archived', id);
    return content;
  }

  private async changeStatus(
    user: AuthenticatedUser,
    id: string,
    from: EducationContentStatus,
    to: EducationContentStatus,
  ) {
    const content = await this.model.findOneAndUpdate(
      { _id: this.objectId(id), createdBy: this.objectId(user.userId), status: from },
      { $set: { status: to, reviewNote: undefined } },
      { new: true, runValidators: true },
    ).lean();
    if (!content) throw new NotFoundException('Draf materi tidak ditemukan');
    return content;
  }

  private paginate(filter: Record<string, unknown>, page: number, limit: number) {
    return Promise.all([
      this.model.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.model.countDocuments(filter),
    ]).then(([data, total]) => ({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
  }

  private objectId(value: string) {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException('ID tidak valid');
    return new Types.ObjectId(value);
  }

  private async audit(actor: AuthenticatedUser, action: string, resourceId: string) {
    await this.auditModel.create({
      actorId: this.objectId(actor.userId),
      action,
      resourceType: 'education',
      resourceId,
      timestamp: new Date(),
      requestId: getRequestId(),
    });
  }
}
