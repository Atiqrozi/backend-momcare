import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AncAppointment, AncAppointmentSchema } from '../pregnancy/schemas/anc-appointment.schema';
import { PregnancyProfile, PregnancyProfileSchema } from '../pregnancy/schemas/pregnancy-profile.schema';
import { NotificationController } from './notification.controller';
import { MockNotificationProvider } from './notification-provider';
import { WahaNotificationProvider } from './notification-provider';
import { NotificationService } from './notification.service';
import { Notification, NotificationSchema } from './schemas/notification.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Notification.name, schema: NotificationSchema },
    { name: User.name, schema: UserSchema },
    { name: AncAppointment.name, schema: AncAppointmentSchema },
    { name: PregnancyProfile.name, schema: PregnancyProfileSchema },
  ])],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    MockNotificationProvider,
    WahaNotificationProvider,
    {
      provide: 'NOTIFICATION_PROVIDER',
      useFactory: (
        config: ConfigService,
        waha: WahaNotificationProvider,
        mock: MockNotificationProvider,
      ) => config.get<boolean>('waha.enabled') ? waha : mock,
      inject: [
        ConfigService,
        WahaNotificationProvider,
        MockNotificationProvider,
      ],
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
