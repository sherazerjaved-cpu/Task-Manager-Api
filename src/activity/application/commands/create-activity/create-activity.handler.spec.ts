import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { CreateActivityHandler } from './create-activity.handler';
import { CreateActivityCommand } from './create-activity.command';

import { ACTIVITY_REPOSITORY } from '../../../domain/repositories/activity.repository.interface';
import { ActivityAction } from 'src/activity/enums/activity-action.enum';

describe('CreateActivityHandler', () => {
  let handler: CreateActivityHandler;

  const activityRepository: {
    create: jest.Mock;
  } = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateActivityHandler,
        {
          provide: ACTIVITY_REPOSITORY,
          useValue: activityRepository,
        },
      ],
    }).compile();

    handler = module.get<CreateActivityHandler>(CreateActivityHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should create an activity using the repository', async () => {
      const taskId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      const createActivityDto = {
        task: taskId,
        user: userId,
        action: ActivityAction.UPDATED,
        description: 'Task priority changed from medium to high.',
        changes: {
          priority: {
            old: 'medium',
            new: 'high',
          },
        },
      };

      const createdActivity = {
        _id: new Types.ObjectId(),
        ...createActivityDto,
      };

      activityRepository.create.mockResolvedValue(createdActivity);

      const command = new CreateActivityCommand(createActivityDto);

      const result = await handler.execute(command);

      expect(activityRepository.create).toHaveBeenCalledTimes(1);
      expect(activityRepository.create).toHaveBeenCalledWith(createActivityDto);

      expect(result).toEqual(createdActivity);
    });

    it('should create an activity without optional fields', async () => {
      const taskId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      const createActivityDto = {
        task: taskId,
        user: userId,
        action: ActivityAction.CREATED,
      };

      const createdActivity = {
        _id: new Types.ObjectId(),
        ...createActivityDto,
      };

      activityRepository.create.mockResolvedValue(createdActivity);

      const command = new CreateActivityCommand(createActivityDto);

      const result = await handler.execute(command);

      expect(activityRepository.create).toHaveBeenCalledTimes(1);
      expect(activityRepository.create).toHaveBeenCalledWith(createActivityDto);
      expect(result).toEqual(createdActivity);
    });

    it('should propagate repository errors', async () => {
      const taskId = new Types.ObjectId();
      const userId = new Types.ObjectId();

      const createActivityDto = {
        task: taskId,
        user: userId,
        action: ActivityAction.DELETED,
      };

      const error = new Error('Database error');

      activityRepository.create.mockRejectedValue(error);

      const command = new CreateActivityCommand(createActivityDto);

      await expect(handler.execute(command)).rejects.toThrow('Database error');

      expect(activityRepository.create).toHaveBeenCalledTimes(1);
      expect(activityRepository.create).toHaveBeenCalledWith(createActivityDto);
    });
  });
});
