import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutboxEvent, OutboxEventSchema } from './schema/outbox-event.schema';
import {
  ProcessedEvent,
  ProcessedEventSchema,
} from './schema/processed-event.schema';
import { ProcessedEventRepository } from './infrastructure/repositories/processed-event.repository';
import {
  OUTBOX_REPOSITORY,
  PROCESSED_EVENT_REPOSITORY,
} from './domain/constants/repository.tokens';
import { OutboxRepository } from './infrastructure/repositories/outbox.repository';
import { QueuesModule } from 'src/infrastructure/queues/queues.module';
import { OutboxDispatcherService } from './application/outbox-dispatcher.service';
import { OutboxService } from './application/outbox.service';
import { CommonHttpModule } from 'src/common/http/common-http.module';

@Module({
  imports: [
    CommonHttpModule,
    forwardRef(() => QueuesModule),
    MongooseModule.forFeature([
      {
        name: OutboxEvent.name,
        schema: OutboxEventSchema,
      },
      {
        name: ProcessedEvent.name,
        schema: ProcessedEventSchema,
      },
    ]),
  ],
  providers: [
    OutboxDispatcherService,
    OutboxService,
    {
      provide: OUTBOX_REPOSITORY,
      useClass: OutboxRepository,
    },
    {
      provide: PROCESSED_EVENT_REPOSITORY,
      useClass: ProcessedEventRepository,
    },
  ],
  exports: [
    OUTBOX_REPOSITORY,
    OutboxService,
    OutboxDispatcherService,
    PROCESSED_EVENT_REPOSITORY,
  ],
})
export class OutboxModule {}
