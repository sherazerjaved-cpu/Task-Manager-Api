import { Module } from '@nestjs/common';
import { TaskGateway } from './task/task.gateway';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [TaskGateway],
  exports: [TaskGateway]
})
export class WebsocketModule {}
