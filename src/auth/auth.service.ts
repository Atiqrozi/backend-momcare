import {
  ConflictException,
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConsentDto } from './dto/consent.dto';
import { VerifyContactDto } from './dto/verify-contact.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { AccountStatus, Role, User, UserDocument } from '../users/schemas/user.schema';
import { AuditLog, AuditLogDocument } from '../users/schemas/audit-log.schema';
import { getRequestId } from '../common/request-context';
import { calculateEstimatedDueDate } from '../common/estimated-due-date';
import { PregnancyProfile, PregnancyProfileDocument } from '../pregnancy/schemas/pregnancy-profile.schema';
import { EncryptionService } from '../common/crypto/encryption.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
    @InjectModel(PregnancyProfile.name) private readonly profileModel: Model<PregnancyProfileDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.consentGranted) {
      throw new ConflictException('Persetujuan penggunaan data wajib diberikan');
    }

    const email = dto.email.toLowerCase();
    const exists = await this.userModel.exists({ email });
    if (exists) throw new ConflictException('Email sudah terdaftar');

    const rounds = this.configService.get<number>('passwordHashRounds', 12);
    const passwordHash = await bcrypt.hash(dto.password, rounds);
    const user = await this.userModel.create({
      fullNameEncrypted: this.encryptionService.encrypt(dto.fullName),
      email,
      ...(dto.phone ? { phone: this.normalizePhone(dto.phone) } : {}),
      passwordHash,
      role: Role.PREGNANT_MOTHER,
      status: AccountStatus.ACTIVE,
      consentGranted: true,
      consentGrantedAt: new Date(),
      consentVersion: 'v1',
      emailVerified: false,
      phoneVerified: false,
    });
    // Set decrypted name for immediate use (e.g., in verification email)
    user.fullName = dto.fullName;
    user.fullName = dto.fullName;
    (user as UserDocument)._decryptedFullName = dto.fullName;

    try {
      await this.profileModel.create({
        userId: user._id,
        nikEncrypted: this.encryptionService.encrypt(dto.nik),
        insuranceType: dto.insuranceType,
        ...(dto.insuranceType === 'BPJS' ? { bpjsNumber: dto.bpjsNumber } : {}),
        birthplace: dto.birthplace,
        birthDate: new Date(dto.birthDate),
        education: dto.education,
        occupation: dto.occupation,
        address: dto.address,
        bloodType: dto.bloodType,
        medicalHistory: dto.medicalHistory,
        ...(dto.lmpDate ? {
          lmpDate: new Date(dto.lmpDate),
          estimatedDueDate: calculateEstimatedDueDate(dto.lmpDate),
        } : {}),
      });
    } catch (error) {
      await this.userModel.deleteOne({ _id: user._id });
      throw error;
    }

    const emailCode = this.createVerificationCode();
    user.emailVerificationTokenHash = this.hashToken(emailCode);
    user.emailVerificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    try {
      await this.sendVerificationEmail(user.email, user.fullName, emailCode);
    } catch (error) {
      await this.profileModel.deleteOne({ userId: user._id });
      await this.userModel.deleteOne({ _id: user._id });
      throw error;
    }
    await this.audit(undefined, 'auth.register', user._id.toString());
    return {
      verificationRequired: true,
      email: user.email,
      ...(this.configService.get<string>('nodeEnv') !== 'production' ? { verificationCode: emailCode } : {}),
    };
  }

  async login(dto: LoginDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email atau nomor telepon wajib diisi');
    }
    const user = await this.userModel.findOne(
      dto.email
        ? { email: dto.email.toLowerCase() }
        : { phone: this.normalizePhone(dto.phone!) },
    ).select('+passwordHash +fullName +fullNameEncrypted +legacyFullName');
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Email atau password tidak valid');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Verifikasi email sebelum masuk');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException('Email atau password tidak valid');
    await this.audit({ userId: user._id.toString(), email: user.email, role: user.role }, 'auth.login');
    return this.issueToken(user);
  }

  async refresh(refreshToken: string) {
    let payload: { userId?: string; email?: string; role?: Role; tokenUse?: string; jti?: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret: this.refreshSecret() });
    } catch {
      throw new UnauthorizedException('Sesi sudah berakhir. Silakan masuk kembali.');
    }
    if (payload.tokenUse !== 'refresh' || !payload.userId || !payload.jti) {
      throw new UnauthorizedException('Token sesi tidak valid. Silakan masuk kembali.');
    }

    const oldHash = this.hashToken(refreshToken);
    const next = this.createRefreshToken({
      _id: payload.userId,
      email: payload.email ?? '',
      role: payload.role ?? Role.PREGNANT_MOTHER,
    });
    const now = new Date();
    const user = await this.userModel.findOneAndUpdate(
      {
        _id: payload.userId,
        status: AccountStatus.ACTIVE,
        refreshSessions: { $elemMatch: { tokenHash: oldHash, expiresAt: { $gt: now } } },
      },
      {
        $set: {
          'refreshSessions.$.tokenHash': this.hashToken(next.token),
          'refreshSessions.$.expiresAt': next.expiresAt,
        },
      },
      { new: true },
    ).select('+fullName +fullNameEncrypted +legacyFullName');

    if (!user || (user.role === Role.PREGNANT_MOTHER && !user.emailVerified)) {
      throw new UnauthorizedException('Sesi sudah berakhir. Silakan masuk kembali.');
    }

    const accessToken = await this.createAccessToken(user);
    return { accessToken, refreshToken: next.token, tokenType: 'Bearer', user: this.toPublicUser(user) };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync<{ tokenUse?: string; userId?: string }>(refreshToken, { secret: this.refreshSecret() });
        if (payload.tokenUse === 'refresh' && payload.userId) {
          await this.userModel.updateOne(
            { _id: payload.userId },
            { $pull: { refreshSessions: { tokenHash: this.hashToken(refreshToken) } } },
          );
        }
      } catch {
        // Clearing the browser session remains safe when its refresh token is already expired.
      }
    }
    return { loggedOut: true };
  }

  async getPublicProfile(userId: string) {
    const user = await this.userModel.findById(userId).select('+fullName +fullNameEncrypted +legacyFullName');
    if (!user) throw new UnauthorizedException('Akun tidak ditemukan');
    return { user: this.toPublicUser(user) };
  }

  private decryptFullName(user: UserDocument): UserDocument {
    if (user.fullName) {
      (user as UserDocument)._decryptedFullName = user.fullName;
    } else if (user.legacyFullName) {
      user.fullName = user.legacyFullName;
      (user as UserDocument)._decryptedFullName = user.legacyFullName;
    } else if (user.fullNameEncrypted) {
      try {
        user.fullName = this.encryptionService.decrypt(user.fullNameEncrypted);
        (user as UserDocument)._decryptedFullName = user.fullName;
      } catch {
        (user as UserDocument)._decryptedFullName = '[DEKRIPSI GAGAL]';
      }
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const update: Record<string, unknown> = { ...dto };
    if (dto.fullName !== undefined) {
      update.fullNameEncrypted = this.encryptionService.encrypt(dto.fullName);
      delete update.fullName;
    }
    if (dto.phone !== undefined) {
      update.phone = this.normalizePhone(dto.phone);
      update.phoneVerified = false;
    }
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true, runValidators: true },
    ).select('+fullName +fullNameEncrypted +legacyFullName');
    if (!user) throw new UnauthorizedException('Akun tidak ditemukan');
    return { user: this.toPublicUser(user) };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId).select('+passwordHash');
    if (!user) throw new UnauthorizedException('Akun tidak ditemukan');
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Password lama tidak valid');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Password baru harus berbeda');
    }
    user.passwordHash = await bcrypt.hash(
      dto.newPassword,
      this.configService.get<number>('passwordHashRounds', 12),
    );
    await user.save();
    await this.userModel.updateOne({ _id: user._id }, { $set: { refreshSessions: [] } });
    await this.audit({ userId, email: user.email, role: user.role }, 'auth.password_changed');
    return { changed: true };
  }

  async updateConsent(userId: string, dto: ConsentDto) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          consentGranted: dto.granted,
          consentVersion: dto.version,
          ...(dto.granted ? { consentGrantedAt: new Date() } : { consentGrantedAt: undefined }),
        },
      },
      { new: true, runValidators: true },
    );
    if (!user) throw new UnauthorizedException('Akun tidak ditemukan');
    await this.audit({ userId, email: user.email, role: user.role }, dto.granted ? 'consent.granted' : 'consent.revoked');
    return { consentGranted: user.consentGranted, consentVersion: user.consentVersion };
  }

  async requestEmailVerification(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('Akun tidak ditemukan');
    if (user.emailVerified) return { message: 'Email sudah terverifikasi' };
    const token = await this.createEmailVerificationToken(user);
    return {
      message: 'Token verifikasi dibuat',
      ...(this.configService.get<string>('nodeEnv') !== 'production' ? { verificationToken: token } : {}),
    };
  }

  async verifyEmail(userId: string, dto: VerifyContactDto) {
    const user = await this.userModel.findById(userId).select('+emailVerificationTokenHash +emailVerificationExpiresAt');
    if (!user || !user.emailVerificationTokenHash || !user.emailVerificationExpiresAt) {
      throw new BadRequestException('Token verifikasi tidak valid');
    }
    if (user.emailVerificationExpiresAt < new Date() ||
      user.emailVerificationTokenHash !== this.hashToken(dto.token)) {
      throw new BadRequestException('Token verifikasi tidak valid atau sudah kedaluwarsa');
    }
    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();
    await this.audit({ userId, email: user.email, role: user.role }, 'auth.email_verified');
    return { emailVerified: true };
  }

  async requestPhoneVerification(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('Akun tidak ditemukan');
    if (!user.phone) throw new BadRequestException('Nomor telepon belum diisi');
    if (user.phoneVerified) return { message: 'Nomor telepon sudah terverifikasi' };
    const token = randomBytes(32).toString('hex');
    user.phoneVerificationTokenHash = this.hashToken(token);
    user.phoneVerificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    return {
      message: 'Token verifikasi dibuat',
      ...(this.configService.get<string>('nodeEnv') !== 'production' ? { verificationToken: token } : {}),
    };
  }

  async verifyPhone(userId: string, dto: VerifyPhoneDto) {
    const user = await this.userModel.findById(userId).select('+phoneVerificationTokenHash +phoneVerificationExpiresAt');
    if (!user || !user.phoneVerificationTokenHash || !user.phoneVerificationExpiresAt) {
      throw new BadRequestException('Token verifikasi tidak valid');
    }
    if (user.phoneVerificationExpiresAt < new Date() ||
      user.phoneVerificationTokenHash !== this.hashToken(dto.token)) {
      throw new BadRequestException('Token verifikasi tidak valid atau sudah kedaluwarsa');
    }
    user.phoneVerified = true;
    user.phoneVerificationTokenHash = undefined;
    user.phoneVerificationExpiresAt = undefined;
    await user.save();
    await this.audit({ userId, email: user.email, role: user.role }, 'auth.phone_verified');
    return { phoneVerified: true };
  }

  toPublicUser(user: UserDocument | AuthenticatedUser) {
    if ('_id' in user) {
      const decryptedUser = this.decryptFullName(user);
      return {
        id: decryptedUser._id.toString(),
        fullName: decryptedUser.fullName,
        email: decryptedUser.email,
        phone: decryptedUser.phone,
        role: decryptedUser.role,
        status: decryptedUser.status,
        consentGranted: decryptedUser.consentGranted,
        emailVerified: decryptedUser.emailVerified,
        phoneVerified: decryptedUser.phoneVerified,
      };
    }
    return user;
  }

  private async issueToken(user: UserDocument) {
    const refresh = this.createRefreshToken(user);
    const now = new Date();
    await this.userModel.updateOne({ _id: user._id }, { $pull: { refreshSessions: { expiresAt: { $lte: now } } } });
    await this.userModel.updateOne(
      { _id: user._id },
      { $push: { refreshSessions: { $each: [{ tokenHash: this.hashToken(refresh.token), expiresAt: refresh.expiresAt }], $slice: -10 } } },
    );
    const accessToken = await this.createAccessToken(user);
    return {
      accessToken,
      refreshToken: refresh.token,
      tokenType: 'Bearer',
      user: this.toPublicUser(user),
    };
  }

  private createRefreshToken(user: { _id: Types.ObjectId | string; email: string; role: Role }) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const token = this.jwtService.sign(
      { userId: user._id.toString(), email: user.email, role: user.role, tokenUse: 'refresh', jti: randomUUID() },
      { secret: this.refreshSecret(), expiresIn: '30d' },
    );
    return { token, expiresAt };
  }

  private createAccessToken(user: { _id: Types.ObjectId | string; email: string; role: Role }) {
    const payload: AuthenticatedUser = { userId: user._id.toString(), email: user.email, role: user.role };
    return this.jwtService.signAsync(payload);
  }

  private refreshSecret() {
    const accessSecret = this.configService.getOrThrow<string>('jwt.accessSecret');
    return createHmac('sha256', accessSecret).update('momcare:refresh-token:v1').digest('hex');
  }

  private async createEmailVerificationToken(user: UserDocument) {
    const token = randomBytes(32).toString('hex');
    user.emailVerificationTokenHash = this.hashToken(token);
    user.emailVerificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    return token;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async confirmRegistrationEmail(email: string, code: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() })
      .select('+emailVerificationTokenHash +emailVerificationExpiresAt');
    if (!user || user.emailVerified || !user.emailVerificationTokenHash ||
      !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date() ||
      user.emailVerificationTokenHash !== this.hashToken(code)) {
      throw new BadRequestException('Kode email tidak valid atau sudah kedaluwarsa');
    }
    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();
    return { emailVerified: true };
  }

  async confirmRegistrationPhone(phone: string, code: string) {
    const normalizedPhone = this.normalizePhone(phone);
    const user = await this.userModel.findOne({ phone: normalizedPhone })
      .select('+phoneVerificationTokenHash +phoneVerificationExpiresAt');
    if (!user || user.phoneVerified || !user.phoneVerificationTokenHash ||
      !user.phoneVerificationExpiresAt || user.phoneVerificationExpiresAt < new Date() ||
      user.phoneVerificationTokenHash !== this.hashToken(code)) {
      throw new BadRequestException('Kode WhatsApp tidak valid atau sudah kedaluwarsa');
    }
    user.phoneVerified = true;
    user.phoneVerificationTokenHash = undefined;
    user.phoneVerificationExpiresAt = undefined;
    await user.save();
    return { phoneVerified: true };
  }

  async resendRegistrationCodes(email: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() })
      .select('+fullName +fullNameEncrypted +legacyFullName');
    if (!user) {
      return { message: 'Jika email cocok dan verifikasi masih diperlukan, kode baru akan dikirim.' };
    }
    if (user.emailVerified) return { message: 'Email sudah terverifikasi.', emailVerified: true };
    const emailCode = user.emailVerified ? undefined : this.createVerificationCode();
    if (emailCode) {
      user.emailVerificationTokenHash = this.hashToken(emailCode);
      user.emailVerificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    }
    await user.save();
    if (emailCode) {
      this.decryptFullName(user);
      await this.sendVerificationEmail(user.email, user.fullName ?? user.email, emailCode);
    }
    return {
      message: 'Kode verifikasi email baru telah dikirim.',
      emailVerified: user.emailVerified,
      ...(this.configService.get<string>('nodeEnv') !== 'production' ? { verificationCode: emailCode } : {}),
    };
  }

  private createVerificationCode() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private async sendVerificationEmail(email: string, name: string, code: string) {
    const host = this.configService.get<string>('email.smtpHost');
    const port = this.configService.get<number>('email.smtpPort');
    const user = this.configService.get<string>('email.smtpUser');
    const password = this.configService.get<string>('email.smtpPassword');
    const from = this.configService.get<string>('email.from');
    if (!host || !port || !user || !password || !from) {
      throw new BadRequestException('Layanan SMTP belum dikonfigurasi. Isi SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, dan EMAIL_FROM.');
    }
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: this.configService.get<boolean>('email.smtpSecure', port === 465),
      auth: { user, pass: password },
    });
    try {
      await transport.sendMail({
        from,
        to: email,
        subject: 'Kode verifikasi email MOMENT AI',
        html: `<p>Halo ${name},</p><p>Kode verifikasi email MOMENT AI Anda:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>Kode berlaku selama 15 menit.</p>`,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 300) : 'SMTP menolak pengiriman.';
      throw new ServiceUnavailableException(`SMTP gagal mengirim email: ${detail}`);
    } finally {
      transport.close();
    }
  }

  private normalizePhone(phone: string) {
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 10 || normalized.length > 15) {
      throw new BadRequestException('Nomor telepon tidak valid');
    }
    return normalized.startsWith('0') ? `62${normalized.slice(1)}` : normalized;
  }

  private async audit(actor: AuthenticatedUser | undefined, action: string, resourceId?: string) {
    await this.auditModel.create({
      actorId: actor?.userId,
      action,
      resourceType: 'auth',
      resourceId,
      timestamp: new Date(),
      requestId: getRequestId(),
    });
  }
}
