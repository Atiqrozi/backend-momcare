import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerGuard } from "@nestjs/throttler";
import * as Joi from "joi";
import configuration from "./config/configuration";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health/health.controller";
import { PregnancyModule } from "./pregnancy/pregnancy.module";
import { ScheduleModule } from "@nestjs/schedule";
import { NotificationModule } from "./notifications/notification.module";
import { EducationModule } from "./education/education.module";
import { HospitalServiceModule } from "./hospital-services/hospital-service.module";
import { UsersModule } from "./users/users.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { FacilitiesModule } from "./facilities/facilities.module";
import { RiskAssessmentsModule } from "./risk-assessments/risk-assessments.module";
import { ChatModule } from "./chat/chat.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      load: [configuration],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
        PORT: Joi.number().port().default(3000),
        MONGODB_URI: Joi.string().required(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        IMAGEKIT_PUBLIC_KEY: Joi.string().optional(),
        IMAGEKIT_PRIVATE_KEY: Joi.string().optional(),
        IMAGEKIT_URL_ENDPOINT: Joi.string().uri().optional(),
        GOOGLE_SERVICE_ACCOUNT_EMAIL: Joi.string().email().allow('').optional(),
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: Joi.string().allow('').optional(),
        GOOGLE_SHEETS_SPREADSHEET_ID: Joi.string().default('1nFZAn_tQl_3JhCFtLZOKpLBzL7KaPYFKUwAvOn87jb0'),
        GOOGLE_SHEETS_SCHEDULE_TAB: Joi.string().default('Sheet1'),
      }),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>("MONGODB_URI"),
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>("RATE_LIMIT_TTL", 60000),
          limit: config.get<number>("RATE_LIMIT_LIMIT", 100),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    PregnancyModule,
    NotificationModule,
    EducationModule,
    HospitalServiceModule,
    UsersModule,
    DashboardModule,
    FacilitiesModule,
    RiskAssessmentsModule,
    ChatModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
