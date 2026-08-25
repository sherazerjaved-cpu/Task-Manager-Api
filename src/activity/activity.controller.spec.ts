import { Test, TestingModule } from '@nestjs/testing';
import { QueryBus } from '@nestjs/cqrs';

import { ActivityController } from './activity.controller';

import { GetUserActivitiesQuery } from './application/queries/get-user-activities/get-user-activities.query';
import { GetAllActivitiesQuery } from './application/queries/get-all-activities/get-all-activities.query';

describe('ActivityController', () => {
  let controller: ActivityController;

  const queryBus = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivityController],
      providers: [
        {
          provide: QueryBus,
          useValue: queryBus,
        },
      ],
    }).compile();

    controller = module.get<ActivityController>(ActivityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyActivity', () => {
    it('should execute GetUserActivitiesQuery with the authenticated user ID', async () => {
      const userId = 'user-123';

      const expectedResult = [
        {
          _id: 'activity-1',
          user: userId,
          action: 'created',
        },
      ];

      queryBus.execute.mockResolvedValue(expectedResult);

      const request = {
        user: {
          userId,
        },
      };

      const result = await controller.getMyActivity(request);

      expect(queryBus.execute).toHaveBeenCalledTimes(1);

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetUserActivitiesQuery),
      );

      const executedQuery = queryBus.execute.mock.calls[0][0];

      expect(executedQuery).toBeInstanceOf(GetUserActivitiesQuery);
      expect(executedQuery.userId).toBe(userId);

      expect(result).toEqual(expectedResult);
    });

    it('should propagate QueryBus errors', async () => {
      const userId = 'user-123';
      const error = new Error('Failed to retrieve activities');

      queryBus.execute.mockRejectedValue(error);

      const request = {
        user: {
          userId,
        },
      };

      await expect(controller.getMyActivity(request)).rejects.toThrow(
        'Failed to retrieve activities',
      );

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllActivity', () => {
    it('should execute GetAllActivitiesQuery', async () => {
      const expectedResult = [
        {
          _id: 'activity-1',
          action: 'created',
        },
        {
          _id: 'activity-2',
          action: 'updated',
        },
      ];

      queryBus.execute.mockResolvedValue(expectedResult);

      const result = await controller.getAllActivity();

      expect(queryBus.execute).toHaveBeenCalledTimes(1);

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetAllActivitiesQuery),
      );

      const executedQuery = queryBus.execute.mock.calls[0][0];

      expect(executedQuery).toBeInstanceOf(GetAllActivitiesQuery);

      expect(result).toEqual(expectedResult);
    });

    it('should propagate QueryBus errors', async () => {
      const error = new Error('Failed to retrieve activity logs');

      queryBus.execute.mockRejectedValue(error);

      await expect(controller.getAllActivity()).rejects.toThrow(
        'Failed to retrieve activity logs',
      );

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
    });
  });
});
