import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  EmailDelivery,
  EmailDeliverySchema,
} from './schema/email-delivery.schema';
import { EmailDeliveryRepository } from './infrastructure/repositories/email-delivery.repository';
import { EMAIL_DELIVERY_REPOSITORY } from './domain/constants/repository.tokens';

@Module({
  imports: [
    ConfigModule,

    MongooseModule.forFeature([
      {
        name: EmailDelivery.name,
        schema: EmailDeliverySchema,
      },
    ]),

    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('SMTP_HOST'),
          port: config.get<number>('SMTP_PORT'),
          secure: false,
          auth: {
            user: config.get<string>('SMTP_USER'),
            pass: config.get<string>('SMTP_PASS'),
          },
        },

        defaults: {
          from: `"${config.get<string>('SMTP_FROM_NAME')}" <${config.get<string>('SMTP_FROM_EMAIL')}>`,
        },
      }),
    }),
  ],

  providers: [
    MailService,

    {
      provide: EMAIL_DELIVERY_REPOSITORY,
      useClass: EmailDeliveryRepository,
    },
  ],

  exports: [MailService, EMAIL_DELIVERY_REPOSITORY],
})
export class MailModule {}
