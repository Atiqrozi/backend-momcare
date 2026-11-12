import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PregnancyProfile, PregnancyProfileDocument } from '../pregnancy/schemas/pregnancy-profile.schema';
import { Role, User, UserDocument } from '../users/schemas/user.schema';
import { AuditLog, AuditLogDocument } from '../users/schemas/audit-log.schema';
import { AncAppointment, AncAppointmentDocument, AncAppointmentStatus } from '../pregnancy/schemas/anc-appointment.schema';
import { Facility, FacilityDocument } from '../facilities/schemas/facility.schema';
import { getRequestId } from '../common/request-context';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AppointmentChatActionDto, AppointmentSlotOptionsDto, RescheduleAppointmentChatDto } from './dto/appointment-chat-action.dto';
import { ChatConversation, ChatConversationDocument, ChatKind } from './schemas/chat-conversation.schema';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { AppointmentSlotReservation, AppointmentSlotReservationDocument } from './schemas/appointment-slot-reservation.schema';
import { DoctorScheduleService } from './doctor-schedule.service';
import { EncryptionService } from '../common/crypto/encryption.service';

type ReminderPayload = { appointmentId: string; scheduledAt: string; rescheduleDeadline: string; providerName: string; facilityName: string; visitType: string; resolvedAction?: string };
const ACTIVE_APPOINTMENT_STATUSES = [AncAppointmentStatus.SCHEDULED, AncAppointmentStatus.CONFIRMED, AncAppointmentStatus.RESCHEDULED];
const RESCHEDULABLE_STATUSES = [AncAppointmentStatus.SCHEDULED, AncAppointmentStatus.RESCHEDULED];
const SLOT_MINUTES = 15;
const DAILY_PATIENT_LIMIT = 10;
const JAKARTA_OFFSET = '+07:00';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatConversation.name) private readonly conversationModel: Model<ChatConversationDocument>,
    @InjectModel(ChatMessage.name) private readonly messageModel: Model<ChatMessageDocument>,
    @InjectModel(PregnancyProfile.name) private readonly profileModel: Model<PregnancyProfileDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
    @InjectModel(AncAppointment.name) private readonly appointmentModel: Model<AncAppointmentDocument>,
    @InjectModel(Facility.name) private readonly facilityModel: Model<FacilityDocument>,
    @InjectModel(AppointmentSlotReservation.name) private readonly slotReservationModel: Model<AppointmentSlotReservationDocument>,
    private readonly config: ConfigService,
    private readonly doctorSchedule: DoctorScheduleService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async createConversation(user: AuthenticatedUser, dto: CreateConversationDto) {
    if (dto.kind === ChatKind.AI) {
      if (user.role !== Role.PREGNANT_MOTHER) throw new ForbiddenException('Konsultasi AI hanya tersedia untuk akun ibu hamil');
      const existing = await this.conversationModel.findOne({ patientId: user.userId, kind: ChatKind.AI });
      if (existing) return existing;
      return this.conversationModel.create({ patientId: new Types.ObjectId(user.userId), kind: dto.kind, title: dto.title ?? 'Konsultasi MOMENT AI' });
    }

    if (!dto.participantId) throw new BadRequestException('participantId wajib untuk percakapan dengan tim layanan');
    if (user.role === Role.PREGNANT_MOTHER) {
      await this.assertAssignedProvider(user.userId, dto.participantId);
      return this.conversationModel.findOneAndUpdate(
        { patientId: new Types.ObjectId(user.userId), providerId: new Types.ObjectId(dto.participantId), kind: ChatKind.CARE_TEAM },
        { $setOnInsert: { patientId: new Types.ObjectId(user.userId), providerId: new Types.ObjectId(dto.participantId), kind: ChatKind.CARE_TEAM, title: dto.title } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
    if (![Role.DOCTOR, Role.MIDWIFE, Role.ADMIN].includes(user.role)) throw new ForbiddenException('Role tidak dapat membuka percakapan klinis');
    if (user.role !== Role.ADMIN) await this.assertAssignedProvider(dto.participantId, user.userId);
    const patient = await this.userModel.findOne({ _id: dto.participantId, role: Role.PREGNANT_MOTHER }).select('_id').lean();
    if (!patient) throw new BadRequestException('participantId harus merupakan akun ibu hamil');
    return this.conversationModel.findOneAndUpdate(
      { patientId: new Types.ObjectId(dto.participantId), providerId: new Types.ObjectId(user.userId), kind: ChatKind.CARE_TEAM },
      { $setOnInsert: { patientId: new Types.ObjectId(dto.participantId), providerId: new Types.ObjectId(user.userId), kind: ChatKind.CARE_TEAM, title: dto.title } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async listConversations(user: AuthenticatedUser): Promise<unknown[]> {
    let filter: Record<string, unknown>;
    if (user.role === Role.PREGNANT_MOTHER) {
      filter = { patientId: new Types.ObjectId(user.userId) };
    } else if (user.role === Role.ADMIN) {
      filter = {};
    } else if ([Role.DOCTOR, Role.MIDWIFE].includes(user.role)) {
      const assignedPatientIds = await this.profileModel.distinct('userId', {
        assignedProviderIds: new Types.ObjectId(user.userId),
      });
      filter = { providerId: new Types.ObjectId(user.userId), patientId: { $in: assignedPatientIds } };
    } else {
      throw new ForbiddenException('Role tidak dapat mengakses percakapan');
    }
    const conversations = await this.conversationModel.find(filter).sort({ lastMessageAt: -1 }).limit(100).lean();
    const providerIds = [...new Set(conversations.flatMap((item) => item.providerId ? [item.providerId.toString()] : []))]
      .map((id) => new Types.ObjectId(id));
    const providers = await this.userModel.find({ _id: { $in: providerIds } })
      .select('_id +fullName +fullNameEncrypted +legacyFullName').lean();
    const providerNames = new Map(providers.map((provider) => [
      provider._id.toString(), this.resolveFullName(provider) ?? 'Tenaga kesehatan',
    ]));
    return conversations.map((item) => ({
      ...item,
      providerName: item.providerId ? providerNames.get(item.providerId.toString()) ?? 'Tenaga kesehatan' : undefined,
    }));
  }

  async listMessages(user: AuthenticatedUser, conversationId: string, limit = 50) {
    const conversation = await this.getAccessibleConversation(user, conversationId);
    const messages = await this.messageModel.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 }).limit(Math.min(Math.max(limit, 1), 100)).lean();
    await this.audit(user, 'chat.messages_read', conversation);
    return { conversation, data: messages.reverse() };
  }

  @Cron('*/1 * * * *')
  async createDueAppointmentChatReminders() {
    const now = new Date();
    const dueBefore = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dueAppointments = await this.appointmentModel.find({
      providerId: { $exists: true },
      status: { $in: RESCHEDULABLE_STATUSES },
      scheduledAt: { $gt: now, $lte: dueBefore },
      $or: [{ chatReminderFor: { $exists: false } }, { $expr: { $ne: ['$chatReminderFor', '$scheduledAt'] } }],
    }).sort({ scheduledAt: 1 }).limit(200).lean();

    for (const appointment of dueAppointments) {
      if (!appointment.providerId) continue;
      const [patient, provider, facility] = await Promise.all([
        this.userModel.findById(appointment.patientId).select('+fullName +fullNameEncrypted +legacyFullName').lean(),
        this.userModel.findOne({ _id: appointment.providerId, role: Role.DOCTOR, status: 'ACTIVE' }).select('+fullName +fullNameEncrypted +legacyFullName').lean(),
        this.facilityModel.findById(appointment.facilityId).select('name').lean(),
      ]);
      if (!patient || !provider) continue;
      const conversation = await this.getOrCreateAiConversation(appointment.patientId);
      const scheduledAt = appointment.scheduledAt.toISOString();
      const eventKey = `appointment-reminder:${appointment._id.toString()}:${appointment.scheduledAt.getTime()}`;
      const payload: ReminderPayload = {
        appointmentId: appointment._id.toString(),
        scheduledAt,
        rescheduleDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        providerName: this.resolveFullName(provider) ?? 'Dokter',
        facilityName: facility?.name ?? 'Rumah sakit',
        visitType: appointment.visitType ?? 'Konsultasi kandungan',
      };
      let message;
      try {
        message = await this.messageModel.findOneAndUpdate(
          { eventKey },
          { $setOnInsert: {
            conversationId: conversation._id,
            senderRole: 'ASSISTANT',
            text: `Pengingat konsultasi ${payload.visitType} dengan ${payload.providerName} pada ${this.formatJakartaDate(appointment.scheduledAt)} pukul ${this.formatJakartaTime(appointment.scheduledAt)} di ${payload.facilityName}. Apakah Bunda dapat hadir?`,
            messageType: 'appointment_reminder',
            payload,
            eventKey,
          } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        ).lean();
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        message = await this.messageModel.findOne({ eventKey }).lean();
        if (!message) throw error;
      }
      await this.conversationModel.updateOne({ _id: conversation._id }, { $set: { lastMessageAt: now } });
      await this.appointmentModel.updateOne({ _id: appointment._id, scheduledAt: appointment.scheduledAt }, { $set: { chatReminderFor: appointment.scheduledAt } });
    }
  }

  async confirmAppointmentFromChat(user: AuthenticatedUser, conversationId: string, dto: AppointmentChatActionDto) {
    const context = await this.getReminderAction(user, conversationId, dto.appointmentId, dto.reminderMessageId);
    const { appointment, message, payload } = context;
    if (payload.resolvedAction === 'confirmed' || appointment.status === AncAppointmentStatus.CONFIRMED) {
      return { appointment, resultMessage: await this.getActionResultMessage(conversationId, `appointment-confirmed:${dto.appointmentId}:${appointment.scheduledAt.getTime()}`) };
    }
    if (payload.resolvedAction) throw new ConflictException('Tindakan pada pengingat ini sudah diproses.');
    const update = await this.appointmentModel.updateOne(
      { _id: appointment._id, patientId: this.objectId(user.userId), scheduledAt: appointment.scheduledAt, status: { $in: RESCHEDULABLE_STATUSES } },
      { $set: { status: AncAppointmentStatus.CONFIRMED } },
    );
    if (!update.modifiedCount) throw new ConflictException('Jadwal sudah berubah. Muat ulang percakapan untuk melihat jadwal terbaru.');
    await this.resolveReminderMessage(message, 'confirmed');
    const resultMessage = await this.createAppointmentResultMessage(
      conversationId,
      `appointment-confirmed:${dto.appointmentId}:${appointment.scheduledAt.getTime()}`,
      `Terima kasih, Bunda. Kehadiran untuk konsultasi ${payload.visitType} dengan ${payload.providerName} pada ${this.formatJakartaDate(appointment.scheduledAt)} pukul ${this.formatJakartaTime(appointment.scheduledAt)} sudah dikonfirmasi.`,
      { appointmentId: dto.appointmentId, action: 'confirmed', scheduledAt: appointment.scheduledAt.toISOString() },
    );
    await this.auditAppointmentAction(user, conversationId, dto.appointmentId, 'appointment.confirmed_by_patient');
    return { appointment: { ...appointment, status: AncAppointmentStatus.CONFIRMED }, resultMessage };
  }

  async getAppointmentSlotOptions(user: AuthenticatedUser, conversationId: string, dto: AppointmentSlotOptionsDto) {
    const context = await this.getReminderAction(user, conversationId, dto.appointmentId, dto.reminderMessageId);
    if (context.payload.resolvedAction) throw new ConflictException('Pengingat ini sudah ditindaklanjuti.');
    const date = this.parseLocalDate(dto.date);
    const deadline = new Date(context.payload.rescheduleDeadline);
    const dayStart = this.jakartaDayStart(dto.date);
    if (dayStart.getTime() > deadline.getTime()) throw new BadRequestException('Tanggal pilihan harus berada dalam tujuh hari setelah pengingat dikirim.');
    const provider = await this.userModel.findById(context.appointment.providerId).select('+fullName +fullNameEncrypted +legacyFullName role status').lean();
    if (!provider || provider.role !== Role.DOCTOR || provider.status !== 'ACTIVE') {
      throw new ConflictException('Dokter pada jadwal ini tidak lagi aktif. Silakan hubungi rumah sakit.');
    }
    const weekday = this.weekdayInJakarta(date);
    const providerName = this.resolveFullName(provider);
    if (!providerName) throw new ConflictException('Nama dokter belum tersedia. Silakan hubungi rumah sakit.');
    const windows = await this.doctorSchedule.getDoctorWindows(providerName, weekday);
    if (!windows.length) return { slots: [], date: dto.date, dailyLimit: DAILY_PATIENT_LIMIT, message: 'Dokter tidak praktik pada tanggal yang dipilih.' };

    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const [appointments, reservations] = await Promise.all([
      this.appointmentModel.find({
        providerId: context.appointment.providerId,
        scheduledAt: { $gte: dayStart, $lt: dayEnd },
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        _id: { $ne: context.appointment._id },
      }).select('_id scheduledAt').lean(),
      this.slotReservationModel.find({ providerId: context.appointment.providerId, localDate: dto.date, appointmentId: { $ne: context.appointment._id } }).select('slotStart').lean(),
    ]);
    if (appointments.length >= DAILY_PATIENT_LIMIT) {
      return { slots: [], date: dto.date, dailyLimit: DAILY_PATIENT_LIMIT, message: 'Kuota konsultasi dokter pada tanggal ini sudah penuh.' };
    }
    const bookedStarts = [
      ...appointments.map((item) => item.scheduledAt.getTime()),
      ...reservations.map((item) => item.slotStart.getTime()),
    ];
    const now = Date.now();
    const generated = new Map<number, { startsAt: string; endsAt: string; durationMinutes: number }>();
    for (const window of windows) {
      const start = this.minutesOfDay(window.startTime);
      const end = this.minutesOfDay(window.endTime);
      for (let minute = start; minute + SLOT_MINUTES <= end; minute += SLOT_MINUTES) {
        const startsAt = this.jakartaDateTime(dto.date, minute);
        const endAt = new Date(startsAt.getTime() + SLOT_MINUTES * 60_000);
        if (startsAt.getTime() <= now || startsAt.getTime() > deadline.getTime()) continue;
        const overlapsAppointment = bookedStarts.some((booked) => startsAt.getTime() < booked + SLOT_MINUTES * 60_000 && endAt.getTime() > booked);
        if (!overlapsAppointment) generated.set(startsAt.getTime(), { startsAt: startsAt.toISOString(), endsAt: endAt.toISOString(), durationMinutes: window.durationMinutes });
      }
    }
    const slots = [...generated.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return {
      slots: slots.slice(0, DAILY_PATIENT_LIMIT - appointments.length),
      date: dto.date,
      dailyLimit: DAILY_PATIENT_LIMIT,
      remainingCapacity: DAILY_PATIENT_LIMIT - appointments.length,
    };
  }

  async rescheduleAppointmentFromChat(user: AuthenticatedUser, conversationId: string, dto: RescheduleAppointmentChatDto) {
    const context = await this.getReminderAction(user, conversationId, dto.appointmentId, dto.reminderMessageId);
    const { appointment, message, payload } = context;
    if (payload.resolvedAction) throw new ConflictException('Pengingat ini sudah ditindaklanjuti.');
    if (!appointment.providerId) throw new ConflictException('Dokter pada jadwal ini belum ditentukan. Silakan hubungi rumah sakit.');
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() % (15 * 60_000) !== 0) {
      throw new BadRequestException('Pilih salah satu slot 15 menit yang ditampilkan.');
    }
    const localDate = this.localDateString(scheduledAt);
    const options = await this.getAppointmentSlotOptions(user, conversationId, {
      appointmentId: dto.appointmentId,
      reminderMessageId: dto.reminderMessageId,
      date: localDate,
    });
    const chosen = options.slots.find((slot) => new Date(slot.startsAt).getTime() === scheduledAt.getTime());
    if (!chosen) throw new ConflictException(options.message ?? 'Slot ini sudah tidak tersedia. Muat ulang pilihan waktu.');

    const reservation = await this.reserveAppointmentSlot(appointment, localDate, scheduledAt);
    const updated = await this.appointmentModel.findOneAndUpdate(
      { _id: appointment._id, patientId: this.objectId(user.userId), scheduledAt: appointment.scheduledAt, status: { $in: RESCHEDULABLE_STATUSES } },
      {
        $set: { scheduledAt, status: AncAppointmentStatus.RESCHEDULED },
        $push: { rescheduleHistory: { previousScheduledAt: appointment.scheduledAt, scheduledAt, changedAt: new Date(), changedBy: this.objectId(user.userId), source: 'appointment_chat' } },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) {
      await this.rollbackAppointmentSlotReservation(reservation);
      throw new ConflictException('Jadwal sudah berubah. Muat ulang percakapan untuk melihat jadwal terbaru.');
    }
    if (reservation.previous && !reservation.reused) await this.slotReservationModel.deleteOne({ _id: reservation.previous._id });
    await this.resolveReminderMessage(message, 'rescheduled');
    const resultMessage = await this.createAppointmentResultMessage(
      conversationId,
      `appointment-rescheduled:${dto.appointmentId}:${scheduledAt.getTime()}`,
      `Jadwal konsultasi berhasil diubah ke ${this.formatJakartaDate(scheduledAt)} pukul ${this.formatJakartaTime(scheduledAt)} dengan ${payload.providerName}. Pengingat baru akan muncul di chat sebelum jadwal tersebut.`,
      { appointmentId: dto.appointmentId, action: 'rescheduled', scheduledAt: scheduledAt.toISOString(), providerName: payload.providerName },
    );
    await this.auditAppointmentAction(user, conversationId, dto.appointmentId, 'appointment.rescheduled_by_patient');
    return { appointment: updated, resultMessage };
  }

  async sendMessage(user: AuthenticatedUser, conversationId: string, dto: SendMessageDto) {
    if (!dto.text.trim()) throw new BadRequestException('Pesan tidak boleh kosong');
    const conversation = await this.getAccessibleConversation(user, conversationId);
    if (conversation.kind === ChatKind.AI) {
      if (user.role !== Role.PREGNANT_MOTHER) throw new ForbiddenException('Hanya pemilik percakapan yang dapat mengirim pesan');
      if (!dto.consentToAiProcessing) throw new BadRequestException('Persetujuan pemrosesan pesan oleh layanan AI wajib diberikan.');
      const reply = await this.getAiReply(conversation._id.toString(), dto.text.trim());
      const [message, assistantMessage] = await Promise.all([
        this.messageModel.create({ conversationId: conversation._id, senderId: new Types.ObjectId(user.userId), senderRole: user.role, text: dto.text.trim() }),
        this.messageModel.create({ conversationId: conversation._id, senderRole: 'ASSISTANT', text: reply }),
      ]);
      await this.conversationModel.updateOne({ _id: conversation._id }, { $set: { lastMessageAt: new Date() } });
      await this.audit(user, 'chat.message_sent', conversation);
      return { userMessage: message, assistantMessage, disclaimer: 'Jawaban AI bersifat informasional dan bukan diagnosis atau pengganti tenaga kesehatan.' };
    }
    const message = await this.messageModel.create({
      conversationId: conversation._id,
      senderId: new Types.ObjectId(user.userId),
      senderRole: user.role,
      text: dto.text.trim(),
    });
    await this.conversationModel.updateOne({ _id: conversation._id }, { $set: { lastMessageAt: new Date() } });
    await this.audit(user, 'chat.message_sent', conversation);
    return message;
  }

  private async getAiReply(conversationId: string, text: string) {
    const apiKey = this.config.get<string>('chatAi.apiKey');
    const model = this.config.get<string>('chatAi.model');
    const endpoint = this.config.get<string>('chatAi.endpoint');
    if (!apiKey || !model || !endpoint) {
      throw new ServiceUnavailableException('Layanan AI belum dikonfigurasi. Percakapan tidak dikirim atau disimpan.');
    }
    const previous = await this.messageModel.find({ conversationId: new Types.ObjectId(conversationId), $or: [{ messageType: 'text' }, { messageType: { $exists: false } }] })
      .sort({ createdAt: -1 }).limit(10).lean();
    const history = previous.reverse().map((message) => ({
      role: message.senderRole === 'ASSISTANT' ? 'assistant' : 'user',
      content: message.text,
    }));
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'Anda adalah pendamping informasi maternal MOMENT AI. Gunakan bahasa Indonesia yang jelas. Jangan mendiagnosis, meresepkan atau mengubah obat, dan jangan menyatakan kehamilan aman berdasarkan chat. Untuk gejala berat atau keadaan darurat, arahkan pengguna segera menghubungi tenaga kesehatan atau layanan gawat darurat setempat. Jelaskan keterbatasan Anda dan sarankan konsultasi klinis untuk keputusan medis.' },
            ...history,
            { role: 'user', content: text },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new ServiceUnavailableException('Layanan AI sedang tidak dapat dihubungi. Pesan belum disimpan.');
    }
    if (!response.ok) throw new ServiceUnavailableException('Layanan AI gagal memproses pesan. Pesan belum disimpan.');
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const answer = payload.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new ServiceUnavailableException('Layanan AI memberikan jawaban kosong. Pesan belum disimpan.');
    return answer.slice(0, 4000);
  }

  private async getOrCreateAiConversation(patientId: Types.ObjectId) {
    const existing = await this.conversationModel.findOne({ patientId, kind: ChatKind.AI });
    if (existing) return existing;
    try {
      return await this.conversationModel.create({ patientId, kind: ChatKind.AI, title: 'Konsultasi MOMENT AI' });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const conversation = await this.conversationModel.findOne({ patientId, kind: ChatKind.AI });
      if (!conversation) throw error;
      return conversation;
    }
  }

  private async getReminderAction(user: AuthenticatedUser, conversationId: string, appointmentId: string, reminderMessageId: string) {
    if (user.role !== Role.PREGNANT_MOTHER) throw new ForbiddenException('Pengingat appointment hanya dapat ditindaklanjuti oleh pasien.');
    const conversation = await this.getAccessibleConversation(user, conversationId);
    if (conversation.kind !== ChatKind.AI || conversation.patientId.toString() !== user.userId) {
      throw new ForbiddenException('Pengingat ini bukan milik pasien yang sedang masuk.');
    }
    if (!Types.ObjectId.isValid(reminderMessageId)) throw new BadRequestException('ID pengingat tidak valid.');
    const message = await this.messageModel.findOne({
      _id: new Types.ObjectId(reminderMessageId),
      conversationId: conversation._id,
      senderRole: 'ASSISTANT',
      messageType: 'appointment_reminder',
    });
    if (!message) throw new NotFoundException('Kartu pengingat tidak ditemukan.');
    const payload = message.payload as ReminderPayload | undefined;
    if (!payload || payload.appointmentId !== appointmentId || !payload.scheduledAt || !payload.rescheduleDeadline) {
      throw new BadRequestException('Kartu pengingat tidak cocok dengan appointment.');
    }
    const appointment = await this.appointmentModel.findById(this.objectId(appointmentId)).lean();
    if (!appointment || appointment.patientId.toString() !== user.userId) throw new NotFoundException('Appointment tidak ditemukan.');
    if (appointment.scheduledAt.toISOString() !== payload.scheduledAt) {
      throw new ConflictException('Jadwal ini sudah diperbarui. Gunakan kartu pengingat terbaru.');
    }
    if (appointment.scheduledAt <= new Date() || ![...RESCHEDULABLE_STATUSES, AncAppointmentStatus.CONFIRMED].includes(appointment.status)) {
      throw new ConflictException('Appointment sudah lewat atau tidak dapat ditindaklanjuti.');
    }
    return { conversation, appointment, message, payload };
  }

  private async resolveReminderMessage(message: ChatMessageDocument, action: 'confirmed' | 'rescheduled') {
    await this.messageModel.updateOne({ _id: message._id }, { $set: { 'payload.resolvedAction': action } });
  }

  private async createAppointmentResultMessage(conversationId: string, eventKey: string, text: string, payload: Record<string, unknown>) {
    const conversationObjectId = this.objectId(conversationId);
    const message = await this.messageModel.findOneAndUpdate(
      { eventKey },
      { $setOnInsert: { conversationId: conversationObjectId, senderRole: 'ASSISTANT', text, messageType: 'appointment_result', payload, eventKey } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    await this.conversationModel.updateOne({ _id: conversationObjectId }, { $set: { lastMessageAt: new Date() } });
    return message;
  }

  private async getActionResultMessage(conversationId: string, eventKey: string) {
    return this.messageModel.findOne({ conversationId: this.objectId(conversationId), eventKey }).lean();
  }

  private async reserveAppointmentSlot(appointment: { _id: Types.ObjectId; patientId: Types.ObjectId; providerId?: Types.ObjectId }, localDate: string, slotStart: Date) {
    const providerId = appointment.providerId as Types.ObjectId;
    const previous = await this.slotReservationModel.findOne({ appointmentId: appointment._id }).sort({ createdAt: -1 }).lean();
    if (previous?.localDate === localDate) {
      try {
        await this.slotReservationModel.updateOne({ _id: previous._id }, { $set: { slotStart } });
      } catch (error) {
        if ((error as { code?: number }).code === 11000) throw new ConflictException('Slot baru saja dipilih pasien lain. Pilih jam lain.');
        throw error;
      }
      return { previous, created: null as AppointmentSlotReservationDocument | null, reused: true, originalSlotStart: previous.slotStart };
    }

    const dayStart = this.jakartaDayStart(localDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const appointmentsInDay = await this.appointmentModel.countDocuments({
      providerId,
      scheduledAt: { $gte: dayStart, $lt: dayEnd },
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      _id: { $ne: appointment._id },
    });
    if (appointmentsInDay >= DAILY_PATIENT_LIMIT) throw new ConflictException('Kuota dokter pada tanggal ini baru saja penuh.');
    for (let seatIndex = appointmentsInDay; seatIndex < DAILY_PATIENT_LIMIT; seatIndex += 1) {
      try {
        const created = await this.slotReservationModel.create({ providerId, patientId: appointment.patientId, appointmentId: appointment._id, localDate, seatIndex, slotStart });
        return { previous, created, reused: false, originalSlotStart: previous?.slotStart };
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        const slotTaken = await this.slotReservationModel.exists({ providerId, slotStart });
        if (slotTaken) throw new ConflictException('Slot baru saja dipilih pasien lain. Muat ulang pilihan waktu.');
      }
    }
    throw new ConflictException('Kuota dokter pada tanggal ini baru saja penuh.');
  }

  private async rollbackAppointmentSlotReservation(reservation: { previous: { _id: Types.ObjectId; slotStart: Date } | null; created: AppointmentSlotReservationDocument | null; reused: boolean; originalSlotStart?: Date }) {
    if (reservation.reused && reservation.previous && reservation.originalSlotStart) {
      await this.slotReservationModel.updateOne({ _id: reservation.previous._id }, { $set: { slotStart: reservation.originalSlotStart } });
    } else if (reservation.created) {
      await this.slotReservationModel.deleteOne({ _id: reservation.created._id });
    }
  }

  private async auditAppointmentAction(user: AuthenticatedUser, conversationId: string, appointmentId: string, action: string) {
    await this.auditModel.create({
      actorId: this.objectId(user.userId),
      action,
      resourceType: 'anc_appointment',
      resourceId: appointmentId,
      timestamp: new Date(),
      requestId: getRequestId(),
      metadata: { conversationId, patientId: user.userId },
    });
  }

  private weekdayInJakarta(date: Date) {
    const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'long' }).format(date).toLowerCase();
    const days: Record<string, string> = { monday: 'senin', tuesday: 'selasa', wednesday: 'rabu', thursday: 'kamis', friday: 'jumat', saturday: 'sabtu', sunday: 'minggu' };
    return days[day];
  }

  private parseLocalDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Tanggal harus memakai format YYYY-MM-DD.');
    const date = new Date(`${value}T12:00:00${JAKARTA_OFFSET}`);
    if (this.localDateString(date) !== value) throw new BadRequestException('Tanggal tidak valid.');
    return date;
  }

  private localDateString(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private jakartaDayStart(localDate: string) {
    return new Date(`${localDate}T00:00:00${JAKARTA_OFFSET}`);
  }

  private jakartaDateTime(localDate: string, minuteOfDay: number) {
    const hours = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
    const minutes = String(minuteOfDay % 60).padStart(2, '0');
    return new Date(`${localDate}T${hours}:${minutes}:00${JAKARTA_OFFSET}`);
  }

  private minutesOfDay(time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private formatJakartaDate(date: Date) {
    return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  private formatJakartaTime(date: Date) {
    return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  }

  private resolveFullName(user: { fullName?: string; legacyFullName?: string; fullNameEncrypted?: string }) {
    if (user.fullName) return user.fullName;
    if (user.legacyFullName) return user.legacyFullName;
    if (!user.fullNameEncrypted) return undefined;
    try {
      return this.encryptionService.decrypt(user.fullNameEncrypted);
    } catch {
      return undefined;
    }
  }

  private objectId(value: string) {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException('ID tidak valid.');
    return new Types.ObjectId(value);
  }

  private async getAccessibleConversation(user: AuthenticatedUser, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID percakapan tidak valid');
    const conversation = await this.conversationModel.findById(id);
    if (!conversation) throw new ForbiddenException('Percakapan tidak ditemukan atau tidak dapat diakses');
    const patientOwns = conversation.patientId.toString() === user.userId;
    const assignedProvider = conversation.providerId?.toString() === user.userId;
    if (!patientOwns && !assignedProvider && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Percakapan tidak dapat diakses');
    }
    if (assignedProvider && conversation.kind === ChatKind.CARE_TEAM && [Role.DOCTOR, Role.MIDWIFE].includes(user.role)) {
      await this.assertAssignedProvider(conversation.patientId.toString(), user.userId);
    }
    return conversation;
  }

  private async assertAssignedProvider(patientId: string, providerId: string) {
    const profile = await this.profileModel.findOne({
      userId: new Types.ObjectId(patientId),
      assignedProviderIds: new Types.ObjectId(providerId),
    }).select('_id').lean();
    if (!profile) throw new ForbiddenException('Pasien dan tenaga kesehatan belum memiliki penugasan aktif');
  }

  private async audit(user: AuthenticatedUser, action: string, conversation: ChatConversationDocument) {
    await this.auditModel.create({
      actorId: new Types.ObjectId(user.userId),
      action,
      resourceType: 'chat_conversation',
      resourceId: conversation._id.toString(),
      timestamp: new Date(),
      requestId: getRequestId(),
      metadata: { patientId: conversation.patientId.toString(), kind: conversation.kind },
    });
  }
}
