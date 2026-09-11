import { Test, TestingModule } from '@nestjs/testing';

import { GetTaskActivitiesHandler } from './get-task-activities.handler';
import { GetTaskActivitiesQuery } from './get-task-activities.query';

import { ACTIVITY_REPOSITORY } from '../../../domain/repositories/activity.repository.interface';

describe('GetTaskActivitiesHandler', () => {
  let handler: GetTaskActivitiesHandler;

  const activityRepository = {
    findByTask: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTaskActivitiesHandler,
        {
          provide: ACTIVITY_REPOSITORY,
          useValue: activityRepository,
        },
      ],
    }).compile();

    handler = module.get<GetTaskActivitiesHandler>(GetTaskActivitiesHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should return activities for the specified task', async () => {
      const taskId = 'task-123';
      const userId = 'user-123';
      const role = 'admin';

      const activities = [
        {
          _id: 'activity-1',
          task: taskId,
          user: userId,
          action: 'created',
        },
        {
          _id: 'activity-2',
          task: taskId,
          user: 'user-456',
          action: 'updated',
        },
      ];

      activityRepository.findByTask.mockResolvedValue(activities);

      const query = new GetTaskActivitiesQuery(taskId, userId, role);

      const result = await handler.execute(query);

      expect(activityRepository.findByTask).toHaveBeenCalledTimes(1);
      expect(activityRepository.findByTask).toHaveBeenCalledWith(taskId);

      expect(result).toEqual(activities);
    });

    it('should return an empty array when the task has no activities', async () => {
      const taskId = 'task-with-no-activities';
      const userId = 'user-123';
      const role = 'member';

      activityRepository.findByTask.mockResolvedValue([]);

      const query = new GetTaskActivitiesQuery(taskId, userId, role);

      const result = await handler.execute(query);

      expect(activityRepository.findByTask).toHaveBeenCalledTimes(1);
      expect(activityRepository.findByTask).toHaveBeenCalledWith(taskId);
      expect(result).toEqual([]);
    });

    it('should propagate repository errors', async () => {
      const taskId = 'task-123';
      const userId = 'user-123';
      const role = 'admin';

      const error = new Error('Database error');

      activityRepository.findByTask.mockRejectedValue(error);

      const query = new GetTaskActivitiesQuery(taskId, userId, role);

      await expect(handler.execute(query)).rejects.toThrow('Database error');

      expect(activityRepository.findByTask).toHaveBeenCalledTimes(1);
      expect(activityRepository.findByTask).toHaveBeenCalledWith(taskId);
    });
  });
});
