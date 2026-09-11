import { Activity } from '../../Schema/activity.schema';
import type { ClientSession } from 'mongoose';

export const ACTIVITY_REPOSITORY = Symbol('ACTIVITY_REPOSITORY');

export interface IActivityRepository {
  create(activity: any, session?: ClientSession): Promise<Activity>;

  findByTask(taskId: string): Promise<Activity[]>;

  findByUser(userId: string): Promise<Activity[]>;

  findAll(): Promise<Activity[]>;
}
