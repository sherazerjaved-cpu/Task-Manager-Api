import { DeleteTaskHandler } from './delete-task.handler';
import { DeleteTaskCommand } from './delete-task.command';
import { ActivityAction } from 'src/activity/enums/activity-action.enum';

describe('DeleteTaskHandler', () => {
  let handler: DeleteTaskHandler;

  const taskRepository = {
    findAuthorizedTask: jest.fn(),
    save: jest.fn(),
    clearCache: jest.fn(),
  };

  const activityRepository = {
    create: jest.fn(),
  };

  const taskGateway = {
    emitTaskDeleted: jest.fn(),
  };

  const auditService = {
    log: jest.fn(),
  };

  const taskId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const ownerId = '507f1f77bcf86cd799439013';
  const workspaceId = '507f1f77bcf86cd799439014';
  const role = 'admin';

  const createTask = () => ({
    _id: taskId,
    owner: {
      toString: () => ownerId,
    },
    isDeleted: false,
    deletedAt: undefined,
  });

  beforeEach(() => {
    jest.resetAllMocks();

    handler = new DeleteTaskHandler(
      taskRepository as any,
      activityRepository as any,
      taskGateway as any,
      auditService as any,
    );
  });

  describe('execute', () => {
    const createCommand = () =>
      new DeleteTaskCommand(taskId, userId, role, workspaceId);

    it('should find the task using authorization information', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(taskRepository.findAuthorizedTask).toHaveBeenCalledWith(
        taskId,
        userId,
        role,
        workspaceId,
      );
    });

    it('should soft delete the task', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(task.isDeleted).toBe(true);
      expect(task.deletedAt).toEqual(expect.any(Date));
    });

    it('should save the soft-deleted task', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(taskRepository.save).toHaveBeenCalledWith(task);
    });

    it('should create a DELETED activity', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(activityRepository.create).toHaveBeenCalledWith({
        task: task._id,
        user: expect.anything(),
        action: ActivityAction.DELETED,
        description: 'Task deleted',
      });
    });

    it('should create an audit log', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: userId,
        action: 'TASK_DELETED',
        resource: 'TASK',
        workspaceId,
        meta: {
          taskId,
          deletionType: 'soft_delete',
        },
      });
    });

    it('should clear the task cache', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(taskRepository.clearCache).toHaveBeenCalledTimes(1);
    });

    it('should emit the task deleted websocket event', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      await handler.execute(createCommand());

      expect(taskGateway.emitTaskDeleted).toHaveBeenCalledWith(ownerId, taskId);
    });

    it('should return a success message', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);

      const result = await handler.execute(createCommand());

      expect(result).toEqual({
        message: 'Task Deleted Successfully!',
      });
    });

    it('should propagate authorization/repository errors', async () => {
      taskRepository.findAuthorizedTask.mockRejectedValue(
        new Error('Authorization failed'),
      );

      await expect(handler.execute(createCommand())).rejects.toThrow(
        'Authorization failed',
      );

      expect(taskRepository.save).not.toHaveBeenCalled();
      expect(activityRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should propagate save errors', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      taskRepository.save.mockRejectedValue(new Error('Database unavailable'));

      await expect(handler.execute(createCommand())).rejects.toThrow(
        'Database unavailable',
      );

      expect(activityRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
      expect(taskGateway.emitTaskDeleted).not.toHaveBeenCalled();
    });

    it('should propagate activity repository errors', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      activityRepository.create.mockRejectedValue(
        new Error('Activity unavailable'),
      );

      await expect(handler.execute(createCommand())).rejects.toThrow(
        'Activity unavailable',
      );

      expect(auditService.log).not.toHaveBeenCalled();
      expect(taskRepository.clearCache).not.toHaveBeenCalled();
      expect(taskGateway.emitTaskDeleted).not.toHaveBeenCalled();
    });

    it('should propagate audit service errors', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      auditService.log.mockRejectedValue(new Error('Audit unavailable'));

      await expect(handler.execute(createCommand())).rejects.toThrow(
        'Audit unavailable',
      );

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
      expect(taskGateway.emitTaskDeleted).not.toHaveBeenCalled();
    });

    it('should not clear cache when audit logging fails', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      auditService.log.mockRejectedValue(new Error('Audit unavailable'));

      await expect(handler.execute(createCommand())).rejects.toThrow(
        'Audit unavailable',
      );

      expect(taskRepository.clearCache).not.toHaveBeenCalled();
    });

    it('should propagate websocket errors', async () => {
      const task = createTask();

      taskRepository.findAuthorizedTask.mockResolvedValue(task);
      taskGateway.emitTaskDeleted.mockImplementation(() => {
        throw new Error('WebSocket unavailable');
      });

      await expect(handler.execute(createCommand())).rejects.toThrow(
        'WebSocket unavailable',
      );
    });
  });
});
