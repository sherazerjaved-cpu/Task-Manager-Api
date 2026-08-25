import { Types } from 'mongoose';

import { MongooseActivityRepository } from './activity.repository';

describe('MongooseActivityRepository', () => {
  let repository: MongooseActivityRepository;

  const activityModel = {
    create: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    repository = new MongooseActivityRepository(activityModel as any);
  });

  describe('create', () => {
    it('should create an activity and return the created activity', async () => {
      const activity = {
        task: new Types.ObjectId(),
        user: new Types.ObjectId(),
        action: 'created',
      };

      const session = {
        id: 'session-123',
      } as any;

      const createdActivity = {
        _id: new Types.ObjectId(),
        ...activity,
      };

      activityModel.create.mockResolvedValue([createdActivity]);

      const result = await repository.create(activity, session);

      expect(activityModel.create).toHaveBeenCalledTimes(1);
      expect(activityModel.create).toHaveBeenCalledWith([activity], {
        session,
      });

      expect(result).toEqual(createdActivity);
    });

    it('should propagate errors when creating an activity fails', async () => {
      const activity = {
        task: new Types.ObjectId(),
        user: new Types.ObjectId(),
        action: 'created',
      };

      const error = new Error('Database error');

      activityModel.create.mockRejectedValue(error);

      await expect(repository.create(activity)).rejects.toThrow(
        'Database error',
      );

      expect(activityModel.create).toHaveBeenCalledWith([activity], {
        session: undefined,
      });
    });
  });

  describe('findByTask', () => {
    it('should find activities for a task with user email populated and newest first', async () => {
      const taskId = 'task-123';

      const activities = [
        {
          _id: new Types.ObjectId(),
          task: taskId,
          action: 'created',
        },
      ];

      const exec = jest.fn().mockResolvedValue(activities);

      const sort = jest.fn().mockReturnValue({
        exec,
      });

      const populate = jest.fn().mockReturnValue({
        sort,
      });

      activityModel.find.mockReturnValue({
        populate,
      });

      const result = await repository.findByTask(taskId);

      expect(activityModel.find).toHaveBeenCalledTimes(1);
      expect(activityModel.find).toHaveBeenCalledWith({
        task: taskId,
      });

      expect(populate).toHaveBeenCalledWith('user', 'email');
      expect(sort).toHaveBeenCalledWith({
        createdAt: -1,
      });
      expect(exec).toHaveBeenCalledTimes(1);

      expect(result).toEqual(activities);
    });
  });

  describe('findByUser', () => {
    it('should find activities for a user with task title populated and newest first', async () => {
      const userId = new Types.ObjectId().toString();

      const activities = [
        {
          _id: new Types.ObjectId(),
          user: userId,
          action: 'updated',
        },
      ];

      const exec = jest.fn().mockResolvedValue(activities);

      const sort = jest.fn().mockReturnValue({
        exec,
      });

      const populate = jest.fn().mockReturnValue({
        sort,
      });

      activityModel.find.mockReturnValue({
        populate,
      });

      const result = await repository.findByUser(userId);

      expect(activityModel.find).toHaveBeenCalledTimes(1);

      const findArgument = activityModel.find.mock.calls[0][0];

      expect(findArgument.user).toBeInstanceOf(Types.ObjectId);
      expect(findArgument.user.toString()).toBe(userId);

      expect(populate).toHaveBeenCalledWith('task', 'title');
      expect(sort).toHaveBeenCalledWith({
        createdAt: -1,
      });
      expect(exec).toHaveBeenCalledTimes(1);

      expect(result).toEqual(activities);
    });

    it('should propagate errors when finding activities by user fails', async () => {
      const userId = new Types.ObjectId().toString();

      const error = new Error('Database error');

      const exec = jest.fn().mockRejectedValue(error);

      const sort = jest.fn().mockReturnValue({
        exec,
      });

      const populate = jest.fn().mockReturnValue({
        sort,
      });

      activityModel.find.mockReturnValue({
        populate,
      });

      await expect(repository.findByUser(userId)).rejects.toThrow(
        'Database error',
      );

      expect(activityModel.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should return all activities with user and task populated and newest first', async () => {
      const activities = [
        {
          _id: new Types.ObjectId(),
          action: 'created',
        },
        {
          _id: new Types.ObjectId(),
          action: 'updated',
        },
      ];

      const exec = jest.fn().mockResolvedValue(activities);

      const sort = jest.fn().mockReturnValue({
        exec,
      });

      const secondPopulate = jest.fn().mockReturnValue({
        sort,
      });

      const firstPopulate = jest.fn().mockReturnValue({
        populate: secondPopulate,
      });

      activityModel.find.mockReturnValue({
        populate: firstPopulate,
      });

      const result = await repository.findAll();

      expect(activityModel.find).toHaveBeenCalledTimes(1);
      expect(activityModel.find).toHaveBeenCalledWith();

      expect(firstPopulate).toHaveBeenCalledWith('user', 'email');
      expect(secondPopulate).toHaveBeenCalledWith('task', 'title');
      expect(sort).toHaveBeenCalledWith({
        createdAt: -1,
      });
      expect(exec).toHaveBeenCalledTimes(1);

      expect(result).toEqual(activities);
    });
  });
});
