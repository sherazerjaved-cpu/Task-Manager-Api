import { Test, TestingModule } from '@nestjs/testing';

import { GetAllActivitiesHandler } from './get-all-activities.handler';
import { GetAllActivitiesQuery } from './get-all-activities.query';

import { ACTIVITY_REPOSITORY } from '../../../domain/repositories/activity.repository.interface';

describe('GetAllActivitiesHandler', () => {
  let handler: GetAllActivitiesHandler;

  const activityRepository = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAllActivitiesHandler,
        {
          provide: ACTIVITY_REPOSITORY,
          useValue: activityRepository,
        },
      ],
    }).compile();

    handler = module.get<GetAllActivitiesHandler>(GetAllActivitiesHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should return all activities from the repository', async () => {
      const activities = [
        {
          _id: 'activity-1',
          task: 'task-1',
          user: 'user-1',
          action: 'created',
        },
        {
          _id: 'activity-2',
          task: 'task-2',
          user: 'user-2',
          action: 'updated',
        },
      ];

      activityRepository.findAll.mockResolvedValue(activities);

      const query = new GetAllActivitiesQuery();

      const result = await handler.execute(query);

      expect(activityRepository.findAll).toHaveBeenCalledTimes(1);
      expect(activityRepository.findAll).toHaveBeenCalledWith();

      expect(result).toEqual(activities);
    });

    it('should return an empty array when there are no activities', async () => {
      activityRepository.findAll.mockResolvedValue([]);

      const query = new GetAllActivitiesQuery();

      const result = await handler.execute(query);

      expect(activityRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Database error');

      activityRepository.findAll.mockRejectedValue(error);

      const query = new GetAllActivitiesQuery();

      await expect(handler.execute(query)).rejects.toThrow('Database error');

      expect(activityRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });
});
