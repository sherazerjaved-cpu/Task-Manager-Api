import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Activity } from './Schema/activity.schema';
import { CreateActivityDto } from './DTO/create-activity.dto';

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(Activity.name) private activityModel: Model<Activity>,
  ) {}

  async create(createActivityDto: CreateActivityDto) {
    return this.activityModel.create(createActivityDto);
  }

  async findByTask(taskId: string) {
    return this.activityModel
      .find({ task: taskId })
      .populate('user', 'email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUser(userId: string) {
    return this.activityModel
      .find({ user: userId })
      .populate('task', 'title')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAll() {
    return this.activityModel
      .find()
      .populate('user', 'email')
      .populate('task', 'title')
      .sort({ createdAt: -1 })
      .exec();
  }
}
