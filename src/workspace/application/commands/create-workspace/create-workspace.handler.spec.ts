import { ConflictException } from '@nestjs/common';
import { CreateWorkspaceHandler } from './create-workspace.handler';
import { CreateWorkspaceCommand } from './create-workspace.command';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';
import type { IWorkspaceRepository } from '../../../domain/repositories/workspace.repository.interface';
import type { IMembershipRepository } from '../../../domain/repositories/membership.repository.interface';
import { AuditService } from '../../../../audit/application/audit.service';
import { FeatureFlagsService } from '../../services/feature-flags.service';
import { WorkspaceSettingsService } from '../../services/workspace-settings.service';

describe('CreateWorkspaceHandler', () => {
  let handler: CreateWorkspaceHandler;

  let workspaceRepository: jest.Mocked<IWorkspaceRepository>;
  let membershipRepository: jest.Mocked<IMembershipRepository>;
  let auditService: jest.Mocked<AuditService>;
  let featureFlagsService: jest.Mocked<FeatureFlagsService>;
  let workspaceSettingsService: jest.Mocked<WorkspaceSettingsService>;

  const ownerId = 'user-123';

  const dto = {
    name: 'Test Workspace',
    slug: 'test-workspace',
  };

  const command = new CreateWorkspaceCommand(dto, ownerId);

  const workspace = {
    _id: 'workspace-123',
    name: dto.name,
    slug: dto.slug,
    ownerId,
  };

  beforeEach(() => {
    workspaceRepository = {
      findBySlug: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<IWorkspaceRepository>;

    membershipRepository = {
      create: jest.fn(),
    } as unknown as jest.Mocked<IMembershipRepository>;

    auditService = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    featureFlagsService = {
      createDefaultConfiguration: jest.fn(),
    } as unknown as jest.Mocked<FeatureFlagsService>;

    workspaceSettingsService = {
      createDefaultSettings: jest.fn(),
    } as unknown as jest.Mocked<WorkspaceSettingsService>;

    handler = new CreateWorkspaceHandler(
      workspaceRepository,
      membershipRepository,
      auditService,
      featureFlagsService,
      workspaceSettingsService,
    );

    workspaceRepository.findBySlug.mockResolvedValue(null);

    workspaceRepository.create.mockResolvedValue(workspace as any);

    membershipRepository.create.mockResolvedValue(undefined as any);

    featureFlagsService.createDefaultConfiguration.mockResolvedValue(
      undefined as any,
    );

    workspaceSettingsService.createDefaultSettings.mockResolvedValue(
      undefined as any,
    );

    auditService.log.mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should throw ConflictException when workspace slug already exists', async () => {
      workspaceRepository.findBySlug.mockResolvedValue(workspace as any);

      await expect(handler.execute(command)).rejects.toThrow(
        new ConflictException('Workspace slug already exists'),
      );

      expect(workspaceRepository.findBySlug).toHaveBeenCalledWith(dto.slug);

      expect(workspaceRepository.create).not.toHaveBeenCalled();
      expect(membershipRepository.create).not.toHaveBeenCalled();
      expect(
        featureFlagsService.createDefaultConfiguration,
      ).not.toHaveBeenCalled();
      expect(
        workspaceSettingsService.createDefaultSettings,
      ).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should check whether the workspace slug already exists', async () => {
      await handler.execute(command);

      expect(workspaceRepository.findBySlug).toHaveBeenCalledTimes(1);
      expect(workspaceRepository.findBySlug).toHaveBeenCalledWith(dto.slug);
    });

    it('should create the workspace with the correct arguments', async () => {
      await handler.execute(command);

      expect(workspaceRepository.create).toHaveBeenCalledTimes(1);
      expect(workspaceRepository.create).toHaveBeenCalledWith(
        dto.name,
        dto.slug,
        ownerId,
      );
    });

    it('should create an OWNER membership for the workspace owner', async () => {
      await handler.execute(command);

      expect(membershipRepository.create).toHaveBeenCalledTimes(1);
      expect(membershipRepository.create).toHaveBeenCalledWith(
        workspace._id.toString(),
        ownerId,
        WorkspaceRole.OWNER,
      );
    });

    it('should create the default feature flag configuration', async () => {
      await handler.execute(command);

      expect(
        featureFlagsService.createDefaultConfiguration,
      ).toHaveBeenCalledTimes(1);

      expect(
        featureFlagsService.createDefaultConfiguration,
      ).toHaveBeenCalledWith(workspace._id.toString());
    });

    it('should create the default workspace settings', async () => {
      await handler.execute(command);

      expect(
        workspaceSettingsService.createDefaultSettings,
      ).toHaveBeenCalledTimes(1);

      expect(
        workspaceSettingsService.createDefaultSettings,
      ).toHaveBeenCalledWith(workspace._id.toString());
    });

    it('should write an audit log after creating the workspace', async () => {
      await handler.execute(command);

      expect(auditService.log).toHaveBeenCalledTimes(1);

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: ownerId,
        action: 'WORKSPACE_CREATED',
        resource: 'WORKSPACE',
        workspaceId: workspace._id.toString(),
      });
    });

    it('should return the created workspace', async () => {
      const result = await handler.execute(command);

      expect(result).toBe(workspace);
    });

    it('should propagate errors from workspaceRepository.findBySlug', async () => {
      const error = new Error('Database error');

      workspaceRepository.findBySlug.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(workspaceRepository.create).not.toHaveBeenCalled();
    });

    it('should propagate errors from workspaceRepository.create', async () => {
      const error = new Error('Workspace creation failed');

      workspaceRepository.create.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(membershipRepository.create).not.toHaveBeenCalled();
      expect(
        featureFlagsService.createDefaultConfiguration,
      ).not.toHaveBeenCalled();
      expect(
        workspaceSettingsService.createDefaultSettings,
      ).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should propagate errors from membershipRepository.create', async () => {
      const error = new Error('Membership creation failed');

      membershipRepository.create.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(
        featureFlagsService.createDefaultConfiguration,
      ).not.toHaveBeenCalled();

      expect(
        workspaceSettingsService.createDefaultSettings,
      ).not.toHaveBeenCalled();

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should propagate errors from featureFlagsService.createDefaultConfiguration', async () => {
      const error = new Error('Feature flag configuration failed');

      featureFlagsService.createDefaultConfiguration.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(
        workspaceSettingsService.createDefaultSettings,
      ).not.toHaveBeenCalled();

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should propagate errors from workspaceSettingsService.createDefaultSettings', async () => {
      const error = new Error('Workspace settings creation failed');

      workspaceSettingsService.createDefaultSettings.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should propagate errors from auditService.log', async () => {
      const error = new Error('Audit logging failed');

      auditService.log.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);
    });
  });
});
