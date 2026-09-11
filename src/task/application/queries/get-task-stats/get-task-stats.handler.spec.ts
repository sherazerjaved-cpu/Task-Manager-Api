import { Types } from 'mongoose';

import { GetTaskStatsHandler } from './get-task-stats.handler';
import { GetTaskStatsQuery } from './get-task-stats.query';

describe('GetTaskStatsHandler', () => {
  let handler: GetTaskStatsHandler;

  let taskRepository: {
    getStats: jest.Mock;
  };

  const userId = new Types.ObjectId().toString();
  const role = 'MEMBER';

  const stats = {
    total: 10,
    pending: 4,
    inProgress: 3,
    completed: 3,
  };

  const createQuery = (
    overrides: Partial<{
      userId: string;
      role: string;
    }> = {},
  ) =>
    new GetTaskStatsQuery(overrides.userId ?? userId, overrides.role ?? role);

  beforeEach(() => {
    jest.clearAllMocks();

    taskRepository = {
      getStats: jest.fn().mockResolvedValue(stats),
    };

    handler = new GetTaskStatsHandler(taskRepository as any);
  });

  describe('execute', () => {
    it('should get task statistics using the user ID and role', async () => {
      const query = createQuery();

      await handler.execute(query);

      expect(taskRepository.getStats).toHaveBeenCalledTimes(1);

      expect(taskRepository.getStats).toHaveBeenCalledWith(userId, role);
    });

    it('should return the task statistics', async () => {
      const query = createQuery();

      const result = await handler.execute(query);

      expect(result).toBe(stats);
    });

    it('should pass the correct user ID', async () => {
      const customUserId = new Types.ObjectId().toString();

      const query = createQuery({
        userId: customUserId,
      });

      await handler.execute(query);

      expect(taskRepository.getStats).toHaveBeenCalledWith(customUserId, role);
    });

    it('should pass the correct role', async () => {
      const query = createQuery({
        role: 'ADMIN',
      });

      await handler.execute(query);

      expect(taskRepository.getStats).toHaveBeenCalledWith(userId, 'ADMIN');
    });

    it('should propagate repository errors', async () => {
      taskRepository.getStats.mockRejectedValue(new Error('Stats unavailable'));

      const query = createQuery();

      await expect(handler.execute(query)).rejects.toThrow('Stats unavailable');
    });

    it('should propagate the original repository error', async () => {
      const error = new Error('Database unavailable');

      taskRepository.getStats.mockRejectedValue(error);

      const query = createQuery();

      await expect(handler.execute(query)).rejects.toBe(error);
    });

    it('should call the repository only once', async () => {
      const query = createQuery();

      await handler.execute(query);

      expect(taskRepository.getStats).toHaveBeenCalledTimes(1);
    });
  });
});
