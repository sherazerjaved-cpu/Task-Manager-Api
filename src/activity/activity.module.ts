import { Module } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Activity, ActivitySchema } from './Schema/activity.schema';
import { CqrsModule } from '@nestjs/cqrs';
import { ACTIVITY_REPOSITORY } from './domain/repositories/activity.repository.interface';
import { MongooseActivityRepository } from './infrastructure/persistence/activity.repository';
import { CreateActivityHandler } from './application/commands/create-activity/create-activity.handler';
import { GetAllActivitiesHandler } from './application/queries/get-all-activities/get-all-activities.handler';
import { GetTaskActivitiesHandler } from './application/queries/get-task-activities/get-task-activities.handler';
import { GetUserActivitiesHandler } from './application/queries/get-user-activities/get-user-activities.handler';

@Module({
  imports: [
    CqrsModule,
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
    ]),
  ],
  providers: [
    {
      provide: ACTIVITY_REPOSITORY,
      useClass: MongooseActivityRepository,
    },
    CreateActivityHandler,
    GetTaskActivitiesHandler,
    GetUserActivitiesHandler,
    GetAllActivitiesHandler,
  ],
  controllers: [ActivityController],
  exports: [ACTIVITY_REPOSITORY],
})
export class ActivityModule {}
