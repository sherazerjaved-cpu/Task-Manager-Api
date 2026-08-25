import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WebhookDeliveryService } from './application/webhook-delivery.service';
import { WebhookService } from './application/webhook.service';

import { Webhook, WebhookSchema } from './schema/webhook.schema';
import { WebhookDelivery } from 'src/webhook/schema/webhook-delivery.schema';
import { WebhookRepository } from './infrastructure/repositories/webhook.repository';
import { WebhookDeliveryRepository } from './infrastructure/repositories/webhook-delivery.repository';
import { WebhookDeliverySchema } from 'src/webhook/schema/webhook-delivery.schema';
import { AuthorizationModule } from 'src/common/authorization/authorization.module';
import {
  WEBHOOK_REPOSITORY,
  WEBHOOK_DELIVERY_REPOSITORY,
} from './domain/constants/repository.tokens';
import { WorkspaceModule } from 'src/workspace/workspace.module';
import { WebhookController } from './presentation/controller/webhook.controller';
import { TaskModule } from 'src/task/task.module';
import { PoliciesGuard } from 'src/common/authorization/policies.guard';

@Module({
  imports: [
    AuthorizationModule,
    forwardRef(() => WorkspaceModule),
    forwardRef(() => TaskModule),
    MongooseModule.forFeature([
      {
        name: Webhook.name,
        schema: WebhookSchema,
      },
      {
        name: WebhookDelivery.name,
        schema: WebhookDeliverySchema,
      },
    ]),
  ],

  controllers: [WebhookController],

  providers: [
    WebhookDeliveryService,
    WebhookService,
    PoliciesGuard,

    {
      provide: WEBHOOK_REPOSITORY,
      useClass: WebhookRepository,
    },

    {
      provide: WEBHOOK_DELIVERY_REPOSITORY,
      useClass: WebhookDeliveryRepository,
    },
  ],

  exports: [
    WebhookDeliveryService,
    WebhookService,
    WEBHOOK_REPOSITORY,
    WEBHOOK_DELIVERY_REPOSITORY,
  ],
})
export class WebhookModule {}
