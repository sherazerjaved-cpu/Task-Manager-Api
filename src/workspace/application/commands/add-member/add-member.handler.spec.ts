import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AddMemberHandler } from './add-member.handler';
import { AddMemberCommand } from './add-member.command';

import { MEMBERSHIP_REPOSITORY } from '../../../domain/repositories/membership.repository.interface';
import { WORKSPACE_REPOSITORY } from '../../../domain/repositories/workspace.repository.interface';

import type { IMembershipRepository } from '../../../domain/repositories/membership.repository.interface';
import type { IWorkspaceRepository } from '../../../domain/repositories/workspace.repository.interface';

import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';
import { AuditService } from 'src/audit/application/audit.service';

describe('AddMemberHandler', () => {
  let handler: AddMemberHandler;

  let workspaceRepository: jest.Mocked<IWorkspaceRepository>;
  let membershipRepository: jest.Mocked<IMembershipRepository>;
  let auditService: {
    log: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddMemberHandler,
        {
          provide: WORKSPACE_REPOSITORY,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: MEMBERSHIP_REPOSITORY,
          useValue: {
            findByWorkspaceAndUser: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<AddMemberHandler>(AddMemberHandler);

    workspaceRepository = module.get(
      WORKSPACE_REPOSITORY,
    ) as jest.Mocked<IWorkspaceRepository>;

    membershipRepository = module.get(
      MEMBERSHIP_REPOSITORY,
    ) as jest.Mocked<IMembershipRepository>;

    auditService = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    const workspaceId = 'workspace-123';
    const actorId = 'actor-123';
    const memberId = 'member-123';

    const command = new AddMemberCommand(
      workspaceId,
      {
        userId: memberId,
        role: WorkspaceRole.MEMBER,
      },
      actorId,
    );

    const workspace = {
      _id: workspaceId,
    };

    const actorMembership = {
      workspaceId,
      userId: actorId,
      role: WorkspaceRole.ADMIN,
    };

    const createdMembership = {
      workspaceId,
      userId: memberId,
      role: WorkspaceRole.MEMBER,
    };

    it('should throw NotFoundException when workspace does not exist', async () => {
      workspaceRepository.findById.mockResolvedValue(null);

      await expect(handler.execute(command)).rejects.toThrow(
        new NotFoundException('Workspace not found'),
      );

      expect(workspaceRepository.findById).toHaveBeenCalledWith(workspaceId);
      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when actor is not a workspace member', async () => {
      workspaceRepository.findById.mockResolvedValue(workspace as any);

      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      await expect(handler.execute(command)).rejects.toThrow(
        new ForbiddenException('You are not a member of this workspace'),
      );

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        workspaceId,
        actorId,
      );

      expect(membershipRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to assign OWNER role', async () => {
      workspaceRepository.findById.mockResolvedValue(workspace as any);

      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        actorMembership as any,
      );

      const ownerCommand = new AddMemberCommand(
        workspaceId,
        {
          userId: memberId,
          role: WorkspaceRole.OWNER,
        },
        actorId,
      );

      await expect(handler.execute(ownerCommand)).rejects.toThrow(
        new BadRequestException(
          'Owner membership cannot be assigned through this operation',
        ),
      );

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        workspaceId,
        actorId,
      );

      expect(membershipRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when user is already a member', async () => {
      workspaceRepository.findById.mockResolvedValue(workspace as any);

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce(actorMembership as any)
        .mockResolvedValueOnce(createdMembership as any);

      await expect(handler.execute(command)).rejects.toThrow(
        new ConflictException('User is already a member of this workspace'),
      );

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).toHaveBeenNthCalledWith(1, workspaceId, actorId);

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).toHaveBeenNthCalledWith(2, workspaceId, memberId);

      expect(membershipRepository.create).not.toHaveBeenCalled();
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should create the membership with the correct arguments', async () => {
      workspaceRepository.findById.mockResolvedValue(workspace as any);

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce(actorMembership as any)
        .mockResolvedValueOnce(null);

      membershipRepository.create.mockResolvedValue(createdMembership as any);

      auditService.log.mockResolvedValue(undefined);

      const result = await handler.execute(command);

      expect(membershipRepository.create).toHaveBeenCalledWith(
        workspaceId,
        memberId,
        WorkspaceRole.MEMBER,
      );

      expect(result).toEqual(createdMembership);
    });

    it('should write an audit log after creating the membership', async () => {
      workspaceRepository.findById.mockResolvedValue(workspace as any);

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce(actorMembership as any)
        .mockResolvedValueOnce(null);

      membershipRepository.create.mockResolvedValue(createdMembership as any);

      auditService.log.mockResolvedValue(undefined);

      await handler.execute(command);

      expect(auditService.log).toHaveBeenCalledWith({
        actorId,
        action: 'MEMBER_ADDED',
        resource: 'MEMBERSHIP',
        workspaceId,
        meta: {
          memberId,
          role: WorkspaceRole.MEMBER,
        },
      });
    });

    it('should return the created membership', async () => {
      workspaceRepository.findById.mockResolvedValue(workspace as any);

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce(actorMembership as any)
        .mockResolvedValueOnce(null);

      membershipRepository.create.mockResolvedValue(createdMembership as any);

      auditService.log.mockResolvedValue(undefined);

      const result = await handler.execute(command);

      expect(result).toBe(createdMembership);
    });

    it('should propagate errors from workspaceRepository.findById', async () => {
      const error = new Error('Database error');

      workspaceRepository.findById.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(workspaceRepository.findById).toHaveBeenCalledWith(workspaceId);
    });

    it('should propagate errors from membershipRepository.create', async () => {
      workspaceRepository.findById.mockResolvedValue(workspace as any);

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce(actorMembership as any)
        .mockResolvedValueOnce(null);

      const error = new Error('Failed to create membership');

      membershipRepository.create.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(membershipRepository.create).toHaveBeenCalledWith(
        workspaceId,
        memberId,
        WorkspaceRole.MEMBER,
      );

      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('should propagate errors from auditService.log', async () => {
      workspaceRepository.findById.mockResolvedValue(workspace as any);

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce(actorMembership as any)
        .mockResolvedValueOnce(null);

      membershipRepository.create.mockResolvedValue(createdMembership as any);

      const error = new Error('Audit logging failed');

      auditService.log.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);

      expect(membershipRepository.create).toHaveBeenCalledWith(
        workspaceId,
        memberId,
        WorkspaceRole.MEMBER,
      );

      expect(auditService.log).toHaveBeenCalledTimes(1);
    });
  });
});
