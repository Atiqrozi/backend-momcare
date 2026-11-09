import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { AccountStatus, Role, User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    const secret = configService.get<string>('jwt.accessSecret');
    if (!secret) throw new Error('JWT_ACCESS_SECRET belum dikonfigurasi');
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: secret });
  }

  async validate(payload: AuthenticatedUser): Promise<AuthenticatedUser> {
    const user = await this.userModel.findById(payload.userId).select('email role status emailVerified');
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Akun tidak aktif atau tidak ditemukan');
    }
    if (user.role === Role.PREGNANT_MOTHER && !user.emailVerified) {
      throw new UnauthorizedException('Verifikasi email sebelum menggunakan akun');
    }
    return { userId: user._id.toString(), email: user.email, role: user.role };
  }
}
