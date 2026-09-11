import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AssignTaskHandler } from './assign-task.handler';
import { AssignTaskCommand } from './assign-task.command';
import { WorkspaceRole } from 'src/workspace/domain/enums/workspace-role.enum';

describe('AssignTaskHandler', () => {
  let handler: AssignTaskHandler;

  const taskRepository = {
    findById: jest.fn(),
    assignUsers: jest.fn(),
  };

  const membershipRepository = {
    findByWorkspaceAndUser: jest.fn(),
  };

  const auditService = {
    log: jest.fn(),
  };

  const taskId = '507f1f77bcf86cd799439011';
  const workspaceId = '507f1f77bcf86cd799439012';
  const actorUserId = '507f1f77bcf86cd799439013';

  const assigneeOneId = '507f1f77bcf86cd799439014';
  const assigneeTwoId = '507f1f77bcf86cd799439015';

  const task = {
    _id: taskId,
    workspace: workspaceId,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    handler = new AssignTaskHandler(
      taskRepository as any,
      membershipRepository as any,
      auditService as any,
    );
  });

  describe('execute', () => {
    it('should throw NotFoundException when task does not exist', async () => {
      taskRepository.findById.mockResolvedValue(null);

      const command = new AssignTaskCommand(taskId, actorUserId, workspaceId, {
        userIds: [assigneeOneId],
      });

      await expect(handler.execute(command)).rejects.toThrow(
        new NotFoundException('Task Not Found'),
      );

      expect(taskRepository.findById).toHaveBeenCalledWith(taskId, workspaceId);

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).not.toHaveBeenCalled();

      expect(taskRepository.assignUsers).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when actor is not a workspace member', async () => {
      taskRepository.findById.mockResolvedValue(task);

      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      const command = new AssignTaskCommand(taskId, actorUserId, workspaceId, {
        userIds: [assigneeOneId],
      });

      await expect(handler.execute(command)).rejects.toThrow(
        new ForbiddenException('You are not a member of this workspace'),
      );

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        workspaceId,
        actorUserId,
      );

      expect(taskRepository.assignUsers).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it.each([WorkspaceRole.MEMBER, WorkspaceRole.VIEWER])(
      'should throw ForbiddenException when actor has role %s',
      async (role) => {
        taskRepository.findById.mockResolvedValue(task);

        membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
          userId: actorUserId,
          workspaceId,
          role,
        });

        const command = new AssignTaskCommand(
          taskId,
          actorUserId,
          workspaceId,
          {
            userIds: [assigneeOneId],
          },
        );

        await expect(handler.execute(command)).rejects.toThrow(
          new ForbiddenException('You are not allowed to assign tasks'),
        );

        expect(taskRepository.assignUsers).not.toHaveBeenCalled();
        expect(auditService.log).not.toHaveBeenCalled();
      },
    );

    it.each([WorkspaceRole.OWNER, WorkspaceRole.ADMIN])(
      'should allow actor with role %s to assign a task',
      async (role) => {
        taskRepository.findById.mockResolvedValue(task);

        membershipRepository.findByWorkspaceAndUser
          .mockResolvedValueOnce({
            userId: actorUserId,
            workspaceId,
            role,
          })
          .mockResolvedValueOnce({
            userId: assigneeOneId,
            workspaceId,
            role: WorkspaceRole.MEMBER,
          });

        const updatedTask = {
          ...task,
          assignees: [assigneeOneId],
        };

        taskRepository.assignUsers.mockResolvedValue(updatedTask);

        const command = new AssignTaskCommand(
          taskId,
          actorUserId,
          workspaceId,
          {
            userIds: [assigneeOneId],
          },
        );

        const result = await handler.execute(command);

        expect(result).toEqual(updatedTask);

        expect(taskRepository.assignUsers).toHaveBeenCalledWith(taskId, [
          assigneeOneId,
        ]);

        expect(auditService.log).toHaveBeenCalledWith({
          actorId: actorUserId,
          action: 'TASK_ASSIGNED',
          resource: 'TASK',
          workspaceId,
          meta: {
            taskId,
            assigneeIds: [assigneeOneId],
          },
        });
      },
    );

    it('should throw ForbiddenException when an assignee is not a workspace member', async () => {
      taskRepository.findById.mockResolvedValue(task);

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce({
          userId: actorUserId,
          workspaceId,
          role: WorkspaceRole.ADMIN,
        })
        .mockResolvedValueOnce(null);

      const command = new AssignTaskCommand(taskId, actorUserId, workspaceId, {
        userIds: [assigneeOneId],
      });

      await expect(handler.execute(command)).rejects.toThrow(
        new ForbiddenException(
          `User ${assigneeOneId} is not a member of this workspace`,
        ),
      );

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).toHaveBeenNthCalledWith(2, workspaceId, assigneeOneId);

      expect(taskRepository.assignUsers).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should check every assignee is a workspace member', async () => {
      taskRepository.findById.mockResolvedValue(task);

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce({
          userId: actorUserId,
          workspaceId,
          role: WorkspaceRole.OWNER,
        })
        .mockResolvedValueOnce({
          userId: assigneeOneId,
          workspaceId,
          role: WorkspaceRole.MEMBER,
        })
        .mockResolvedValueOnce({
          userId: assigneeTwoId,
          workspaceId,
          role: WorkspaceRole.MEMBER,
        });

      taskRepository.assignUsers.mockResolvedValue({
        ...task,
        assignees: [assigneeOneId, assigneeTwoId],
      });

      const command = new AssignTaskCommand(taskId, actorUserId, workspaceId, {
        userIds: [assigneeOneId, assigneeTwoId],
      });

      await handler.execute(command);

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).toHaveBeenNthCalledWith(1, workspaceId, actorUserId);

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).toHaveBeenNthCalledWith(2, workspaceId, assigneeOneId);

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).toHaveBeenNthCalledWith(3, workspaceId, assigneeTwoId);

      expect(taskRepository.assignUsers).toHaveBeenCalledWith(taskId, [
        assigneeOneId,
        assigneeTwoId,
      ]);
    });

    it('should assign multiple users and return the updated task', async () => {
      taskRepository.findById.mockResolvedValue(task);

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce({
          userId: actorUserId,
          workspaceId,
          role: WorkspaceRole.ADMIN,
        })
        .mockResolvedValueOnce({
          userId: assigneeOneId,
          workspaceId,
          role: WorkspaceRole.MEMBER,
        })
        .mockResolvedValueOnce({
          userId: assigneeTwoId,
          workspaceId,
          role: WorkspaceRole.MEMBER,
        });

      const updatedTask = {
        ...task,
        assignees: [assigneeOneId, assigneeTwoId],
      };

      taskRepository.assignUsers.mockResolvedValue(updatedTask);

      const command = new AssignTaskCommand(taskId, actorUserId, workspaceId, {
        userIds: [assigneeOneId, assigneeTwoId],
      });

      const result = await handler.execute(command);

      expect(result).toBe(updatedTask);

      expect(taskRepository.assignUsers).toHaveBeenCalledTimes(1);

      expect(taskRepository.assignUsers).toHaveBeenCalledWith(taskId, [
        assigneeOneId,
        assigneeTwoId,
      ]);
    });

    it('should create an audit log after successful assignment', async () => {
      taskRepository.findById.mockResolvedValue(task);

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce({
          userId: actorUserId,
          workspaceId,
          role: WorkspaceRole.OWNER,
        })
        .mockResolvedValueOnce({
          userId: assigneeOneId,
          workspaceId,
          role: WorkspaceRole.MEMBER,
        });

      const updatedTask = {
        ...task,
        assignees: [assigneeOneId],
      };

      taskRepository.assignUsers.mockResolvedValue(updatedTask);

      const command = new AssignTaskCommand(taskId, actorUserId, workspaceId, {
        userIds: [assigneeOneId],
      });

      await handler.execute(command);

      expect(auditService.log).toHaveBeenCalledTimes(1);

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: actorUserId,
        action: 'TASK_ASSIGNED',
        resource: 'TASK',
        workspaceId,
        meta: {
          taskId,
          assigneeIds: [assigneeOneId],
        },
      });
    });

    it('should not assign users when audit logging fails', async () => {
      taskRepository.findById.mockResolvedValue(task);

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce({
          userId: actorUserId,
          workspaceId,
          role: WorkspaceRole.ADMIN,
        })
        .mockResolvedValueOnce({
          userId: assigneeOneId,
          workspaceId,
          role: WorkspaceRole.MEMBER,
        });

      const updatedTask = {
        ...task,
        assignees: [assigneeOneId],
      };

      taskRepository.assignUsers.mockResolvedValue(updatedTask);

      auditService.log.mockRejectedValue(
        new Error('Audit service unavailable'),
      );

      const command = new AssignTaskCommand(taskId, actorUserId, workspaceId, {
        userIds: [assigneeOneId],
      });

      await expect(handler.execute(command)).rejects.toThrow(
        'Audit service unavailable',
      );

      expect(taskRepository.assignUsers).toHaveBeenCalledWith(taskId, [
        assigneeOneId,
      ]);
    });
  });
});
