import { Test, TestingModule } from '@nestjs/testing';

import { GetUserActivitiesHandler } from './get-user-activities.handler';
import { GetUserActivitiesQuery } from './get-user-activities.query';

import { ACTIVITY_REPOSITORY } from '../../../domain/repositories/activity.repository.interface';

describe('GetUserActivitiesHandler', () => {
  let handler: GetUserActivitiesHandler;

  const activityRepository = {
    findByUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetUserActivitiesHandler,
        {
          provide: ACTIVITY_REPOSITORY,
          useValue: activityRepository,
        },
      ],
    }).compile();

    handler = module.get<GetUserActivitiesHandler>(GetUserActivitiesHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should return activities for the specified user', async () => {
      const userId = 'user-123';

      const activities = [
        {
          _id: 'activity-1',
          task: 'task-1',
          user: userId,
          action: 'created',
        },
        {
          _id: 'activity-2',
          task: 'task-2',
          user: userId,
          action: 'updated',
        },
      ];

      activityRepository.findByUser.mockResolvedValue(activities);

      const query = new GetUserActivitiesQuery(userId);

      const result = await handler.execute(query);

      expect(activityRepository.findByUser).toHaveBeenCalledTimes(1);
      expect(activityRepository.findByUser).toHaveBeenCalledWith(userId);

      expect(result).toEqual(activities);
    });

    it('should return an empty array when the user has no activities', async () => {
      const userId = 'user-with-no-activities';

      activityRepository.findByUser.mockResolvedValue([]);

      const query = new GetUserActivitiesQuery(userId);

      const result = await handler.execute(query);

      expect(activityRepository.findByUser).toHaveBeenCalledTimes(1);
      expect(activityRepository.findByUser).toHaveBeenCalledWith(userId);

      expect(result).toEqual([]);
    });

    it('should propagate repository errors', async () => {
      const userId = 'user-123';
      const error = new Error('Database error');

      activityRepository.findByUser.mockRejectedValue(error);

      const query = new GetUserActivitiesQuery(userId);

      await expect(handler.execute(query)).rejects.toThrow('Database error');

      expect(activityRepository.findByUser).toHaveBeenCalledTimes(1);
      expect(activityRepository.findByUser).toHaveBeenCalledWith(userId);
    });
  });
});
