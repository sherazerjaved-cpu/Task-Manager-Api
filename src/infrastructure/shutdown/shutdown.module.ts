import { Global, Module } from '@nestjs/common';
import { GracefulShutdownService } from './graceful-shutdown.service';
import { QueuesModule } from '../queues/queues.module';

@Global()
@Module({
  imports: [QueuesModule],
  providers: [GracefulShutdownService],
  exports: [GracefulShutdownService],
})
export class ShutdownModule {}
