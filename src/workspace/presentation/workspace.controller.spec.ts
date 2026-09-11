import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { WorkspaceController } from './workspace.controller';

import { CreateWorkspaceCommand } from '../application/commands/create-workspace/create-workspace.command';
import { GetWorkspacesQuery } from '../application/queries/get-workspaces/get-workspaces.query';
import { GetWorkspaceQuery } from '../application/queries/get-workspace/get-workspace.query';
import { GetWorkspaceMembersQuery } from '../application/queries/get-workspace-members/get-workspace-members.query';
import { AddMemberCommand } from '../application/commands/add-member/add-member.command';
import { GetWorkspaceAuditLogsQuery } from 'src/audit/application/queries/get-workspace-audit-logs/get-workspace-audit-logs.query';
import { GetFeatureFlagsQuery } from '../application/queries/get-feature-flags/get-feature-flags.query';
import { UpdateFeatureFlagsCommand } from '../application/commands/update-feature-flags/update-feature-flags.command';
import { GetWorkspaceSettingsQuery } from '../application/queries/get-workspace-settings/get-workspace-settings.query';
import { UpdateWorkspaceSettingsCommand } from '../application/commands/update-workspace-settings/update-workspace-settings.command';

import { CreateWorkspaceDto } from '../application/dto/create-workspace.dto';
import { AddMemberDto } from '../application/dto/add-member.dto';
import { UpdateFeatureFlagsDto } from '../application/dto/update-feature-flags.dto';
import { UpdateWorkspaceSettingsDto } from '../application/dto/update-workspace-settings.dto';

import { WorkspaceRole } from '../domain/enums/workspace-role.enum';
import { TaskPriority } from '../../task/Enums/task-priority.enum';
import { TaskStatus } from '../../task/Enums/task-status.enum';

describe('WorkspaceController', () => {
  let controller: WorkspaceController;
  let commandBus: {
    execute: jest.Mock;
  };
  let queryBus: {
    execute: jest.Mock;
  };

  const userId = '68a123456789abcdef123456';
  const workspaceId = '68a123456789abcdef123457';
  const memberId = '68a123456789abcdef123458';

  const req = {
    user: {
      userId,
    },
  };

  beforeEach(() => {
    commandBus = {
      execute: jest.fn(),
    };

    queryBus = {
      execute: jest.fn(),
    };

    controller = new WorkspaceController(
      commandBus as unknown as CommandBus,
      queryBus as unknown as QueryBus,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateWorkspaceDto = {
      name: 'Backend Development Team',
      slug: 'backend-development',
    };

    it('should execute CreateWorkspaceCommand with the DTO and authenticated user ID', async () => {
      const result = {
        id: workspaceId,
        name: dto.name,
        slug: dto.slug,
      };

      commandBus.execute.mockResolvedValue(result);

      await expect(controller.create(dto, req)).resolves.toEqual(result);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(CreateWorkspaceCommand),
      );

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(CreateWorkspaceCommand);
      expect(command.dto).toBe(dto);
      expect(command.ownerId).toBe(userId);
    });

    it('should return the result from CommandBus', async () => {
      const result = {
        id: workspaceId,
        name: 'Backend Development Team',
        slug: 'backend-development',
      };

      commandBus.execute.mockResolvedValue(result);

      await expect(controller.create(dto, req)).resolves.toBe(result);
    });

    it('should propagate errors from CommandBus', async () => {
      const error = new Error('Command failed');

      commandBus.execute.mockRejectedValue(error);

      await expect(controller.create(dto, req)).rejects.toThrow(error);
    });
  });

  describe('findAll', () => {
    it('should execute GetWorkspacesQuery with the authenticated user ID', async () => {
      const result = [
        {
          id: workspaceId,
          name: 'Workspace',
        },
      ];

      queryBus.execute.mockResolvedValue(result);

      await expect(controller.findAll(req)).resolves.toEqual(result);

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetWorkspacesQuery),
      );

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetWorkspacesQuery);
      expect(query.userId).toBe(userId);
    });

    it('should return the result from QueryBus', async () => {
      const result = [];

      queryBus.execute.mockResolvedValue(result);

      await expect(controller.findAll(req)).resolves.toBe(result);
    });

    it('should propagate errors from QueryBus', async () => {
      const error = new Error('Query failed');

      queryBus.execute.mockRejectedValue(error);

      await expect(controller.findAll(req)).rejects.toThrow(error);
    });
  });

  describe('findOne', () => {
    it('should execute GetWorkspaceQuery with workspace ID and authenticated user ID', async () => {
      const result = {
        id: workspaceId,
        name: 'Workspace',
      };

      queryBus.execute.mockResolvedValue(result);

      await expect(controller.findOne(workspaceId, req)).resolves.toEqual(
        result,
      );

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetWorkspaceQuery),
      );

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetWorkspaceQuery);
      expect(query.workspaceId).toBe(workspaceId);
      expect(query.userId).toBe(userId);
    });

    it('should return the workspace returned by QueryBus', async () => {
      const result = {
        id: workspaceId,
        name: 'Workspace',
      };

      queryBus.execute.mockResolvedValue(result);

      await expect(controller.findOne(workspaceId, req)).resolves.toBe(result);
    });

    it('should propagate errors from QueryBus', async () => {
      const error = new Error('Workspace lookup failed');

      queryBus.execute.mockRejectedValue(error);

      await expect(controller.findOne(workspaceId, req)).rejects.toThrow(error);
    });
  });

  describe('getFeatureFlags', () => {
    it('should execute GetFeatureFlagsQuery with the workspace ID', async () => {
      const result = {
        webhooks: true,
        exports: false,
      };

      queryBus.execute.mockResolvedValue(result);

      await expect(controller.getFeatureFlags(workspaceId)).resolves.toEqual(
        result,
      );

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetFeatureFlagsQuery),
      );

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetFeatureFlagsQuery);
      expect(query.workspaceId).toBe(workspaceId);
    });

    it('should return the feature flags returned by QueryBus', async () => {
      const result = {
        webhooks: true,
        exports: true,
      };

      queryBus.execute.mockResolvedValue(result);

      await expect(controller.getFeatureFlags(workspaceId)).resolves.toBe(
        result,
      );
    });

    it('should propagate errors from QueryBus', async () => {
      const error = new Error('Feature flags lookup failed');

      queryBus.execute.mockRejectedValue(error);

      await expect(controller.getFeatureFlags(workspaceId)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getMembers', () => {
    it('should execute GetWorkspaceMembersQuery with workspace ID and authenticated user ID', async () => {
      const result = [
        {
          userId: memberId,
          role: WorkspaceRole.MEMBER,
        },
      ];

      queryBus.execute.mockResolvedValue(result);

      await expect(controller.getMembers(workspaceId, req)).resolves.toEqual(
        result,
      );

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetWorkspaceMembersQuery),
      );

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetWorkspaceMembersQuery);
      expect(query.workspaceId).toBe(workspaceId);
      expect(query.userId).toBe(userId);
    });

    it('should return the members returned by QueryBus', async () => {
      const result = [];

      queryBus.execute.mockResolvedValue(result);

      await expect(controller.getMembers(workspaceId, req)).resolves.toBe(
        result,
      );
    });

    it('should propagate errors from QueryBus', async () => {
      const error = new Error('Members lookup failed');

      queryBus.execute.mockRejectedValue(error);

      await expect(controller.getMembers(workspaceId, req)).rejects.toThrow(
        error,
      );
    });
  });

  describe('addMember', () => {
    const dto: AddMemberDto = {
      userId: memberId,
      role: WorkspaceRole.MEMBER,
    };

    it('should execute AddMemberCommand with workspace ID, DTO, and authenticated user ID', async () => {
      const result = {
        id: memberId,
        role: WorkspaceRole.MEMBER,
      };

      commandBus.execute.mockResolvedValue(result);

      await expect(
        controller.addMember(workspaceId, dto, req),
      ).resolves.toEqual(result);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(AddMemberCommand),
      );

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(AddMemberCommand);
      expect(command.workspaceId).toBe(workspaceId);
      expect(command.dto).toBe(dto);
      expect(command.actorId).toBe(userId);
    });

    it('should return the result from CommandBus', async () => {
      const result = {
        id: memberId,
        role: WorkspaceRole.MEMBER,
      };

      commandBus.execute.mockResolvedValue(result);

      await expect(controller.addMember(workspaceId, dto, req)).resolves.toBe(
        result,
      );
    });

    it('should propagate errors from CommandBus', async () => {
      const error = new Error('Add member failed');

      commandBus.execute.mockRejectedValue(error);

      await expect(controller.addMember(workspaceId, dto, req)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getAuditLogs', () => {
    const auditQuery = {
      page: 2,
      limit: 20,
    };

    it('should execute GetWorkspaceAuditLogsQuery with all required arguments', async () => {
      const result = {
        data: [],
        page: 2,
        limit: 20,
      };

      queryBus.execute.mockResolvedValue(result);

      await expect(
        controller.getAuditLogs(workspaceId, auditQuery as any, req),
      ).resolves.toEqual(result);

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetWorkspaceAuditLogsQuery),
      );

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetWorkspaceAuditLogsQuery);
      expect(query.workspaceId).toBe(workspaceId);
      expect(query.userId).toBe(userId);
      expect(query.page).toBe(auditQuery.page);
      expect(query.limit).toBe(auditQuery.limit);
    });

    it('should return the audit logs returned by QueryBus', async () => {
      const result = {
        data: [],
        page: 1,
        limit: 10,
      };

      queryBus.execute.mockResolvedValue(result);

      await expect(
        controller.getAuditLogs(workspaceId, auditQuery as any, req),
      ).resolves.toBe(result);
    });

    it('should propagate errors from QueryBus', async () => {
      const error = new Error('Audit log lookup failed');

      queryBus.execute.mockRejectedValue(error);

      await expect(
        controller.getAuditLogs(workspaceId, auditQuery as any, req),
      ).rejects.toThrow(error);
    });
  });

  describe('updateFeatureFlags', () => {
    const dto: UpdateFeatureFlagsDto = {
      webhooks: true,
      exports: false,
      reminders: true,
      emailNotifications: true,
      advancedTaskFiltering: false,
    };

    it('should execute UpdateFeatureFlagsCommand with workspace ID and DTO', async () => {
      const result = {
        workspaceId,
        flags: dto,
      };

      commandBus.execute.mockResolvedValue(result);

      await expect(
        controller.updateFeatureFlags(workspaceId, dto),
      ).resolves.toEqual(result);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(UpdateFeatureFlagsCommand),
      );

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(UpdateFeatureFlagsCommand);
      expect(command.workspaceId).toBe(workspaceId);
      expect(command.dto).toBe(dto);
    });

    it('should return the result from CommandBus', async () => {
      const result = {
        workspaceId,
        flags: dto,
      };

      commandBus.execute.mockResolvedValue(result);

      await expect(
        controller.updateFeatureFlags(workspaceId, dto),
      ).resolves.toBe(result);
    });

    it('should propagate errors from CommandBus', async () => {
      const error = new Error('Feature flag update failed');

      commandBus.execute.mockRejectedValue(error);

      await expect(
        controller.updateFeatureFlags(workspaceId, dto),
      ).rejects.toThrow(error);
    });
  });

  describe('getSettings', () => {
    it('should execute GetWorkspaceSettingsQuery with workspace ID and authenticated user ID', async () => {
      const result = {
        workspaceId,
        timezone: 'Asia/Karachi',
        defaultTaskPriority: TaskPriority.Medium,
        defaultTaskStatus: TaskStatus.Pending,
        emailNotifications: true,
        taskAssignmentNotifications: true,
      };

      queryBus.execute.mockResolvedValue(result);

      await expect(controller.getSettings(workspaceId, req)).resolves.toEqual(
        result,
      );

      expect(queryBus.execute).toHaveBeenCalledTimes(1);
      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.any(GetWorkspaceSettingsQuery),
      );

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toBeInstanceOf(GetWorkspaceSettingsQuery);
      expect(query.workspaceId).toBe(workspaceId);
      expect(query.userId).toBe(userId);
    });

    it('should return the settings returned by QueryBus', async () => {
      const result = {
        workspaceId,
        timezone: 'Asia/Karachi',
      };

      queryBus.execute.mockResolvedValue(result);

      await expect(controller.getSettings(workspaceId, req)).resolves.toBe(
        result,
      );
    });

    it('should propagate errors from QueryBus', async () => {
      const error = new Error('Settings lookup failed');

      queryBus.execute.mockRejectedValue(error);

      await expect(controller.getSettings(workspaceId, req)).rejects.toThrow(
        error,
      );
    });
  });

  describe('updateSettings', () => {
    const dto: UpdateWorkspaceSettingsDto = {
      timezone: 'Asia/Karachi',
      defaultTaskPriority: TaskPriority.High,
      defaultTaskStatus: TaskStatus.Pending,
      emailNotifications: true,
      taskAssignmentNotifications: false,
    };

    it('should execute UpdateWorkspaceSettingsCommand with workspace ID, DTO, and authenticated user ID', async () => {
      const result = {
        workspaceId,
        ...dto,
      };

      commandBus.execute.mockResolvedValue(result);

      await expect(
        controller.updateSettings(workspaceId, dto, req),
      ).resolves.toEqual(result);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.any(UpdateWorkspaceSettingsCommand),
      );

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toBeInstanceOf(UpdateWorkspaceSettingsCommand);
      expect(command.workspaceId).toBe(workspaceId);
      expect(command.dto).toBe(dto);
      expect(command.userId).toBe(userId);
    });

    it('should return the result from CommandBus', async () => {
      const result = {
        workspaceId,
        ...dto,
      };

      commandBus.execute.mockResolvedValue(result);

      await expect(
        controller.updateSettings(workspaceId, dto, req),
      ).resolves.toBe(result);
    });

    it('should propagate errors from CommandBus', async () => {
      const error = new Error('Settings update failed');

      commandBus.execute.mockRejectedValue(error);

      await expect(
        controller.updateSettings(workspaceId, dto, req),
      ).rejects.toThrow(error);
    });
  });
});
