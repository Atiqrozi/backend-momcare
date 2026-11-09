import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { FilterQuery, Model, Types } from 'mongoose';
import { Role, User, UserDocument } from '../users/schemas/user.schema';
import { PregnancyProfile, PregnancyProfileDocument } from '../pregnancy/schemas/pregnancy-profile.schema';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AncAppointment, AncAppointmentDocument, AncAppointmentStatus } from '../pregnancy/schemas/anc-appointment.schema';
import { NotificationProvider } from './notification-provider';
import {
  Notification,
  NotificationChannel,
  NotificationDocument,
  NotificationStatus,
} from './schemas/notification.schema';

@Injectable()
export class NotificationService implements OnModuleInit {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(AncAppointment.name)
    private readonly appointmentModel: Model<AncAppointmentDocument>,
    @InjectModel(PregnancyProfile.name)
    private readonly profileModel: Model<PregnancyProfileDocument>,
    @Inject('NOTIFICATION_PROVIDER')
    private readonly provider: NotificationProvider,
  ) {}

  async onModuleInit() {
    await this.notificationModel.updateMany(
      { status: NotificationStatus.PENDING, channel: NotificationChannel.WHATSAPP },
      { $set: { status: NotificationStatus.CANCELLED, lastError: 'Pengingat konsultasi dipindahkan ke chat aplikasi.' } },
    );
  }

  async list(
    user: AuthenticatedUser,
    page = 1,
    limit = 20,
    status?: NotificationStatus,
    patientId?: string,
    appointmentId?: string,
    from?: string,
    to?: string,
  ) {
    const filter = await this.notificationScope(user, patientId, appointmentId);
    if (status) filter.status = status;
    if (from || to) {
      filter.scheduledAt = {
        ...(from ? { $gte: this.dateValue(from) } : {}),
        ...(to ? { $lte: this.dateValue(to) } : {}),
      };
    }
    const [data, total] = await Promise.all([
      this.notificationModel.find(filter).sort({ scheduledAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.notificationModel.countDocuments(filter),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async notificationScope(
    user: AuthenticatedUser,
    patientId?: string,
    appointmentId?: string,
  ): Promise<FilterQuery<Notification>> {
    if (user.role === Role.ADMIN) {
      return {
        ...(patientId ? { userId: this.objectId(patientId) } : {}),
        ...(appointmentId ? { appointmentId: this.objectId(appointmentId) } : {}),
      };
    }
    if (user.role === Role.PREGNANT_MOTHER) {
      if (patientId && patientId !== user.userId) throw new ForbiddenException('Tidak dapat mengakses notifikasi pasien lain');
      return {
        userId: this.objectId(user.userId),
        ...(appointmentId ? { appointmentId: this.objectId(appointmentId) } : {}),
      };
    }
    if (![Role.DOCTOR, Role.MIDWIFE].includes(user.role)) {
      throw new ForbiddenException('Role tidak memiliki akses ke notifikasi provider');
    }
    const providerId = this.objectId(user.userId);
    const assignedPatientIds = await this.profileModel.find({ assignedProviderIds: providerId }).distinct('userId');
    const appointmentIds = await this.appointmentModel.find({
      providerId,
      ...(patientId ? { patientId: this.objectId(patientId) } : {}),
    }).distinct('_id');
    if (appointmentId && !appointmentIds.some((id) => id.toString() === appointmentId)) {
      throw new ForbiddenException('Appointment tidak berada dalam cakupan akses Anda');
    }
    const scope = appointmentIds.length
      ? { $or: [{ userId: { $in: assignedPatientIds } }, { appointmentId: { $in: appointmentIds } }] }
      : { userId: { $in: assignedPatientIds } };
    return {
      ...scope,
      ...(appointmentId ? { appointmentId: this.objectId(appointmentId) } : {}),
    };
  }

  async createAppointmentReminder(
    userId: string,
    appointmentId: string,
    scheduledAt: Date,
    reminderMinutesBefore = 1440,
  ) {
    const user = await this.userModel.findById(userId).select('phone phoneVerified').lean();
    if (!user?.phone || !user.phoneVerified) {
      throw new BadRequestException('Nomor telepon pasien harus tersedia dan terverifikasi');
    }
    const recipientPhone = this.normalizePhone(user.phone);
    const reminderAt = new Date(scheduledAt.getTime() - reminderMinutesBefore * 60 * 1000);
    const idempotencyKey = `${appointmentId}:whatsapp:${reminderAt.toISOString()}`;
    return this.notificationModel.findOneAndUpdate(
      { idempotencyKey },
      {
        $setOnInsert: {
          userId: this.objectId(userId),
          appointmentId: this.objectId(appointmentId),
          channel: NotificationChannel.WHATSAPP,
          scheduledAt: reminderAt,
          status: NotificationStatus.PENDING,
          attemptCount: 0,
          idempotencyKey,
          recipientPhone,
          message: `Pengingat pemeriksaan ANC pada ${scheduledAt.toISOString()}. Silakan konfirmasi melalui kanal resmi.`,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  }

  async cancelAppointmentReminders(appointmentId: string) {
    await this.notificationModel.updateMany(
      { appointmentId: this.objectId(appointmentId), status: NotificationStatus.PENDING },
      { $set: { status: NotificationStatus.CANCELLED } },
    );
  }

  async retry(user: AuthenticatedUser, id: string, maxAttempts = 3) {
    const notification = await this.notificationModel.findById(this.objectId(id));
    if (!notification) throw new NotFoundException('Notifikasi tidak ditemukan');
    if (notification.channel === NotificationChannel.WHATSAPP) {
      throw new BadRequestException('Pengingat konsultasi sekarang ditampilkan di chat aplikasi.');
    }
    await this.authorizeRetry(user, notification.userId, notification.appointmentId);
    if (notification.status !== NotificationStatus.FAILED) {
      throw new BadRequestException('Hanya notifikasi gagal yang dapat diulang');
    }
    if (notification.attemptCount >= maxAttempts) {
      throw new BadRequestException('Batas percobaan pengiriman tercapai');
    }
    return this.send(notification);
  }

  private async authorizeRetry(
    user: AuthenticatedUser,
    patientId: Types.ObjectId,
    appointmentId: Types.ObjectId,
  ) {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.PREGNANT_MOTHER) {
      if (patientId.toString() !== user.userId) {
        throw new ForbiddenException('Tidak dapat mengulang notifikasi pasien lain');
      }
      return;
    }
    if (![Role.MIDWIFE, Role.DOCTOR].includes(user.role)) {
      throw new ForbiddenException('Role tidak memiliki izin mengulang notifikasi');
    }
    const providerId = this.objectId(user.userId);
    const [appointment, profile] = await Promise.all([
      this.appointmentModel.findById(appointmentId).select('providerId patientId').lean(),
      this.profileModel.findOne({ userId: patientId }).select('assignedProviderIds').lean(),
    ]);
    const assigned = profile?.assignedProviderIds?.some((id) => id.equals(providerId));
    const appointmentProvider = appointment?.providerId?.equals(providerId);
    if (!assigned && !appointmentProvider) {
      throw new ForbiddenException('Notifikasi tidak berada dalam cakupan akses Anda');
    }
  }

  @Cron('*/1 * * * *')
  async processDueNotifications() {
    await this.markMissedAppointments();
    await this.notificationModel.updateMany(
      { status: NotificationStatus.PENDING, channel: NotificationChannel.WHATSAPP, scheduledAt: { $lte: new Date() } },
      { $set: { status: NotificationStatus.CANCELLED, lastError: 'Pengingat konsultasi sekarang ditampilkan di chat aplikasi.' } },
    );
  }

  private async send(notification: NotificationDocument) {
    try {
      const result = await this.provider.send({
        channel: notification.channel,
        message: notification.message,
        recipientPhone: notification.recipientPhone,
      });
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
      notification.providerMessageId = result.providerMessageId;
      notification.attemptCount += 1;
      notification.lastError = undefined;
    } catch (error) {
      notification.status = NotificationStatus.FAILED;
      notification.attemptCount += 1;
      notification.lastError = error instanceof Error ? error.message.slice(0, 500) : 'Provider error';
    }
    return notification.save();
  }

  private objectId(value: string) {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException('ID tidak valid');
    return new Types.ObjectId(value);
  }

  private dateValue(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Tanggal filter tidak valid');
    return date;
  }

  private normalizePhone(phone: string) {
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 10 || normalized.length > 15) {
      throw new BadRequestException('Nomor telepon pasien tidak valid');
    }
    return normalized.startsWith('0') ? `62${normalized.slice(1)}` : normalized;
  }

  private async markMissedAppointments() {
    await this.appointmentModel.updateMany(
      {
        scheduledAt: { $lt: new Date() },
        status: { $in: [AncAppointmentStatus.SCHEDULED, AncAppointmentStatus.CONFIRMED] },
      },
      { $set: { status: AncAppointmentStatus.MISSED } },
    );
  }
}
