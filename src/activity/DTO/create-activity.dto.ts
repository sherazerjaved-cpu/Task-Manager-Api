import { Types } from 'mongoose';
import { ActivityAction } from '../enums/activity-action.enum';

export class CreateActivityDto {
  task!: Types.ObjectId;

  user!: Types.ObjectId;

  action!: ActivityAction;

  description?: string;

  changes?: Record<string, any>;
}
