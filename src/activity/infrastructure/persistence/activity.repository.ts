import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Activity } from '../../Schema/activity.schema';
import type { IActivityRepository } from '../../domain/repositories/activity.repository.interface';
import type { ClientSession } from 'mongoose';

@Injectable()
export class MongooseActivityRepository implements IActivityRepository {
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<Activity>,
  ) {}

  async create(activity: any, session?: ClientSession): Promise<Activity> {
    const [created] = await this.activityModel.create([activity], { session });

    return created;
  }

  async findByTask(taskId: string): Promise<Activity[]> {
    return this.activityModel
      .find({ task: taskId })
      .populate('user', 'email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUser(userId: string): Promise<Activity[]> {
    return this.activityModel
      .find({
        user: new Types.ObjectId(userId),
      })
      .populate('task', 'title')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAll(): Promise<Activity[]> {
    return this.activityModel
      .find()
      .populate('user', 'email')
      .populate('task', 'title')
      .sort({ createdAt: -1 })
      .exec();
  }
}
