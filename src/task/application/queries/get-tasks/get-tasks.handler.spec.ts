import { Types } from 'mongoose';
import { ForbiddenException } from '@nestjs/common';

import { GetTasksHandler } from './get-tasks.handler';
import { GetTasksQuery } from './get-tasks.query';

describe('GetTasksHandler', () => {
  let handler: GetTasksHandler;

  let taskRepository: {
    findAll: jest.Mock;
  };

  let membershipRepository: {
    findByWorkspaceAndUser: jest.Mock;
  };

  const userId = new Types.ObjectId().toString();
  const workspaceId = new Types.ObjectId().toString();
  const role = 'MEMBER';

  const queryOptions = {
    page: 1,
    limit: 10,
    status: 'pending',
  };

  const tasksResult = {
    data: [
      {
        _id: new Types.ObjectId(),
        title: 'Task 1',
      },
      {
        _id: new Types.ObjectId(),
        title: 'Task 2',
      },
    ],
    total: 2,
  };

  const membership = {
    _id: new Types.ObjectId(),
    user: new Types.ObjectId(userId),
    workspace: new Types.ObjectId(workspaceId),
    role,
  };

  const createQuery = (
    overrides: Partial<{
      userId: string;
      role: string;
      workspaceId: string;
      query: any;
    }> = {},
  ) =>
    new GetTasksQuery(
      overrides.userId ?? userId,
      overrides.role ?? role,
      overrides.workspaceId ?? workspaceId,
      overrides.query ?? queryOptions,
    );

  beforeEach(() => {
    jest.clearAllMocks();

    membershipRepository = {
      findByWorkspaceAndUser: jest.fn().mockResolvedValue(membership),
    };

    taskRepository = {
      findAll: jest.fn().mockResolvedValue(tasksResult),
    };

    handler = new GetTasksHandler(
      taskRepository as any,
      membershipRepository as any,
    );
  });

  describe('execute', () => {
    it('should verify workspace membership before retrieving tasks', async () => {
      const query = createQuery();

      await handler.execute(query);

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledTimes(
        1,
      );

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        workspaceId,
        userId,
      );
    });

    it('should return tasks for a workspace member', async () => {
      const query = createQuery();

      const result = await handler.execute(query);

      expect(result).toBe(tasksResult);
    });

    it('should call findAll with the correct arguments', async () => {
      const query = createQuery();

      await handler.execute(query);

      expect(taskRepository.findAll).toHaveBeenCalledTimes(1);

      expect(taskRepository.findAll).toHaveBeenCalledWith(
        userId,
        role,
        workspaceId,
        queryOptions,
      );
    });

    it('should throw ForbiddenException when the user is not a workspace member', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      const query = createQuery();

      await expect(handler.execute(query)).rejects.toThrow(
        new ForbiddenException('You are not a member of this workspace'),
      );
    });

    it('should not retrieve tasks when the user is not a workspace member', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      const query = createQuery();

      await expect(handler.execute(query)).rejects.toThrow(ForbiddenException);

      expect(taskRepository.findAll).not.toHaveBeenCalled();
    });

    it('should propagate membership repository errors', async () => {
      membershipRepository.findByWorkspaceAndUser.mockRejectedValue(
        new Error('Membership unavailable'),
      );

      const query = createQuery();

      await expect(handler.execute(query)).rejects.toThrow(
        'Membership unavailable',
      );

      expect(taskRepository.findAll).not.toHaveBeenCalled();
    });

    it('should propagate task repository errors', async () => {
      taskRepository.findAll.mockRejectedValue(new Error('Tasks unavailable'));

      const query = createQuery();

      await expect(handler.execute(query)).rejects.toThrow('Tasks unavailable');
    });

    it('should pass the correct user ID to membership lookup', async () => {
      const customUserId = new Types.ObjectId().toString();

      const query = createQuery({
        userId: customUserId,
      });

      await handler.execute(query);

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        workspaceId,
        customUserId,
      );
    });

    it('should pass the correct workspace ID to membership lookup', async () => {
      const customWorkspaceId = new Types.ObjectId().toString();

      const query = createQuery({
        workspaceId: customWorkspaceId,
      });

      await handler.execute(query);

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        customWorkspaceId,
        userId,
      );
    });

    it('should pass the correct role to findAll', async () => {
      const query = createQuery({
        role: 'ADMIN',
      });

      await handler.execute(query);

      expect(taskRepository.findAll).toHaveBeenCalledWith(
        userId,
        'ADMIN',
        workspaceId,
        queryOptions,
      );
    });

    it('should pass the query options to findAll unchanged', async () => {
      const customQuery = {
        page: 2,
        limit: 20,
        status: 'done',
        priority: 'high',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const query = createQuery({
        query: customQuery,
      });

      await handler.execute(query);

      expect(taskRepository.findAll).toHaveBeenCalledWith(
        userId,
        role,
        workspaceId,
        customQuery,
      );
    });

    it('should execute membership verification before retrieving tasks', async () => {
      const calls: string[] = [];

      membershipRepository.findByWorkspaceAndUser.mockImplementation(
        async () => {
          calls.push('membership');
          return membership;
        },
      );

      taskRepository.findAll.mockImplementation(async () => {
        calls.push('tasks');
        return tasksResult;
      });

      const query = createQuery();

      await handler.execute(query);

      expect(calls).toEqual(['membership', 'tasks']);
    });

    it('should only call membership verification once', async () => {
      const query = createQuery();

      await handler.execute(query);

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should only call findAll once', async () => {
      const query = createQuery();

      await handler.execute(query);

      expect(taskRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });
});
