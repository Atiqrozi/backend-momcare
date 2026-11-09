import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../users/schemas/user.schema';
import { AuditLog, AuditLogDocument } from '../users/schemas/audit-log.schema';
import { getRequestId } from '../common/request-context';
import { PregnancyProfile, PregnancyProfileDocument } from '../pregnancy/schemas/pregnancy-profile.schema';
import { AssessRiskDto, MATERNAL_WARNING_SIGNS } from './dto/assess-risk.dto';
import { RiskAssessment, RiskAssessmentDocument, RiskLevel } from './schemas/risk-assessment.schema';

@Injectable()
export class RiskAssessmentsService {
  constructor(
    @InjectModel(RiskAssessment.name) private readonly assessmentModel: Model<RiskAssessmentDocument>,
    @InjectModel(PregnancyProfile.name) private readonly profileModel: Model<PregnancyProfileDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async assess(actor: AuthenticatedUser, dto: AssessRiskDto) {
    await this.assertPatientScope(actor, dto.patientId);
    const mapMmHg = Number(((dto.systolicMmHg + 2 * dto.diastolicMmHg) / 3).toFixed(1));
    const warningSigns = [...new Set(dto.warningSigns ?? [])];
    const reasons: string[] = [];
    const severePressure = dto.systolicMmHg >= 160 || dto.diastolicMmHg >= 110;
    const elevatedPressure = dto.systolicMmHg >= 140 || dto.diastolicMmHg >= 90;
    const hasWarningSign = warningSigns.some((sign) => MATERNAL_WARNING_SIGNS.includes(sign as typeof MATERNAL_WARNING_SIGNS[number]));
    if (severePressure) reasons.push('Tekanan darah mencapai rentang berat (sistolik ≥160 atau diastolik ≥110 mmHg).');
    else if (elevatedPressure) reasons.push('Tekanan darah mencapai ambang tinggi (sistolik ≥140 atau diastolik ≥90 mmHg).');
    if (hasWarningSign) reasons.push('Terdapat tanda bahaya maternal yang dipilih saat penilaian.');
    if (mapMmHg >= 90) reasons.push('MAP ≥90 mmHg; tinjau menurut protokol klinis fasilitas.');
    if ((dto.urineProteinPlus ?? 0) > 0) reasons.push('Protein urine tercatat positif; perlu interpretasi klinis.');

    const level = severePressure || hasWarningSign
      ? RiskLevel.URGENT
      : elevatedPressure
        ? RiskLevel.ELEVATED
        : mapMmHg >= 90 || (dto.urineProteinPlus ?? 0) > 0
          ? RiskLevel.FOLLOW_UP
          : RiskLevel.NO_FLAG;
    const nextStep = level === RiskLevel.URGENT
      ? 'Segera lakukan penilaian klinis langsung sesuai protokol fasilitas; hasil ini bukan diagnosis.'
      : level === RiskLevel.ELEVATED
        ? 'Ulangi dan konfirmasi pengukuran serta lakukan penilaian klinis sesuai protokol fasilitas.'
        : level === RiskLevel.FOLLOW_UP
          ? 'Tinjau hasil dan faktor klinis lain bersama tenaga kesehatan yang bertanggung jawab.'
          : 'Tidak ada pemicu pada data yang dimasukkan; lanjutkan pemantauan antenatal rutin.';

    const assessment = await this.assessmentModel.create({
      patientId: new Types.ObjectId(dto.patientId),
      assessedBy: new Types.ObjectId(actor.userId),
      assessedAt: new Date(),
      systolicMmHg: dto.systolicMmHg,
      diastolicMmHg: dto.diastolicMmHg,
      urineProteinPlus: dto.urineProteinPlus,
      warningSigns,
      mapMmHg,
      level,
      reasons,
      algorithmVersion: 'maternal-screen-v1',
      intendedUse: 'screening_only',
    });
    await this.auditModel.create({
      actorId: new Types.ObjectId(actor.userId),
      action: 'risk_assessment.created',
      resourceType: 'risk_assessment',
      resourceId: assessment._id.toString(),
      timestamp: new Date(),
      requestId: getRequestId(),
      metadata: { patientId: dto.patientId, level },
    });
    return {
      assessment,
      nextStep,
      disclaimer: 'Skrining pendukung, bukan diagnosis dan tidak menggantikan pemeriksaan atau keputusan tenaga kesehatan.',
    };
  }

  async listForPatient(actor: AuthenticatedUser, patientId: string, limit = 20) {
    await this.assertPatientScope(actor, patientId);
    const data = await this.assessmentModel.find({ patientId: new Types.ObjectId(patientId) })
      .sort({ assessedAt: -1 }).limit(Math.min(Math.max(limit, 1), 100)).lean();
    await this.auditModel.create({
      actorId: new Types.ObjectId(actor.userId), action: 'risk_assessment.listed',
      resourceType: 'risk_assessment', timestamp: new Date(), requestId: getRequestId(),
      metadata: { patientId },
    });
    return data;
  }

  private async assertPatientScope(actor: AuthenticatedUser, patientId: string) {
    if (!Types.ObjectId.isValid(patientId)) throw new BadRequestException('patientId tidak valid');
    const patientObjectId = new Types.ObjectId(patientId);
    if (actor.role === Role.ADMIN) {
      const profile = await this.profileModel.exists({ userId: patientObjectId });
      if (!profile) throw new NotFoundException('Profil pasien tidak ditemukan');
      return;
    }
    if (![Role.DOCTOR, Role.MIDWIFE].includes(actor.role)) {
      throw new ForbiddenException('Hanya tenaga kesehatan yang dapat mengakses skrining risiko');
    }
    const profile = await this.profileModel.findOne({
      userId: patientObjectId,
      assignedProviderIds: new Types.ObjectId(actor.userId),
    }).select('_id').lean();
    if (!profile) throw new NotFoundException('Pasien tidak ditemukan dalam daftar penugasan Anda');
  }
}
