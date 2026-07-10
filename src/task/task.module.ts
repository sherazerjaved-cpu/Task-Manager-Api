import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './Schema/task.schema';
import {
  Category,
  CategorySchema,
} from 'src/categories/Schema/categories.schema';
import { WebsocketModule } from 'src/websocket/websocket.module';
import { ActivityModule } from 'src/activity/activity.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    WebsocketModule,
    ActivityModule,
  ],
  providers: [TaskService],
  controllers: [TaskController],
  exports: [MongooseModule, TaskService],
})
export class TaskModule {}
