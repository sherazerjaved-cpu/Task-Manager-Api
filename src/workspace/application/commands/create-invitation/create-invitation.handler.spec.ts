import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateInvitationHandler } from './create-invitation.handler';
import { CreateInvitationCommand } from './create-invitation.command';
import { WorkspaceRole } from '../../../domain/enums/workspace-role.enum';
import { InvitationStatus } from '../../../domain/enums/invitation-status.enum';
import type { IWorkspaceRepository } from '../../../domain/repositories/workspace.repository.interface';
import type { IMembershipRepository } from '../../../domain/repositories/membership.repository.interface';
import type { IInvitationRepository } from '../../../domain/repositories/invitation.repository.interface';
import type { IUserRepository } from '../../../../users/domain/repositories/user.repository.interface';
import { MailService } from '../../../../mail/mail.service';
import { AuditService } from '../../../../audit/application/audit.service';

describe('CreateInvitationHandler', () => {
  let handler: CreateInvitationHandler;

  let workspaceRepository: jest.Mocked<IWorkspaceRepository>;
  let membershipRepository: jest.Mocked<IMembershipRepository>;
  let invitationRepository: jest.Mocked<IInvitationRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let mailService: jest.Mocked<MailService>;
  let auditService: jest.Mocked<AuditService>;

  const workspaceId = 'workspace-123';
  const invitedBy = 'user-123';

  const dto = {
    email: 'invitee@example.com',
    role: WorkspaceRole.MEMBER,
  };

  const command = new CreateInvitationCommand(workspaceId, dto, invitedBy);

  const workspace = {
    _id: workspaceId,
    name: 'Test Workspace',
  };

  const actorMembership = {
    _id: 'membership-123',
    workspaceId,
    userId: invitedBy,
  };

  const invitedUser = {
    _id: 'user-456',
    email: 'invitee@example.com',
  };

  const createdInvitation = {
    _id: 'invitation-123',
    email: dto.email,
    role: dto.role,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: InvitationStatus.PENDING,
  };

  beforeEach(() => {
    workspaceRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<IWorkspaceRepository>;

    membershipRepository = {
      findByWorkspaceAndUser: jest.fn(),
    } as unknown as jest.Mocked<IMembershipRepository>;

    invitationRepository = {
      findPendingByEmail: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<IInvitationRepository>;

    userRepository = {
      findByEmailWithoutPassword: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    mailService = {
      sendWorkspaceInvitation: jest.fn(),
    } as unknown as jest.Mocked<MailService>;

    auditService = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    handler = new CreateInvitationHandler(
      workspaceRepository,
      membershipRepository,
      invitationRepository,
      userRepository,
      mailService,
      auditService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    beforeEach(() => {
      workspaceRepository.findById.mockResolvedValue(workspace as any);

      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        actorMembership as any,
      );

      userRepository.findByEmailWithoutPassword.mockResolvedValue(
        invitedUser as any,
      );

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce(actorMembership as any)
        .mockResolvedValueOnce(null);

      invitationRepository.findPendingByEmail.mockResolvedValue([]);

      invitationRepository.create.mockResolvedValue(createdInvitation as any);

      mailService.sendWorkspaceInvitation.mockResolvedValue(undefined);

      auditService.log.mockResolvedValue(undefined as any);
    });

    it('should throw NotFoundException when workspace does not exist', async () => {
      workspaceRepository.findById.mockResolvedValue(null);

      await expect(handler.execute(command)).rejects.toThrow(
        new NotFoundException('Workspace not found'),
      );

      expect(workspaceRepository.findById).toHaveBeenCalledWith(workspaceId);
    });

    it('should throw ForbiddenException when actor is not a workspace member', async () => {
      membershipRepository.findByWorkspaceAndUser.mockReset();

      membershipRepository.findByWorkspaceAndUser.mockResolvedValueOnce(null);

      await expect(handler.execute(command)).rejects.toThrow(
        new ForbiddenException('You are not a member of this workspace'),
      );

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        workspaceId,
        invitedBy,
      );
    });

    it('should throw BadRequestException when trying to invite with OWNER role', async () => {
      const ownerDto = {
        email: 'invitee@example.com',
        role: WorkspaceRole.OWNER,
      };

      const ownerCommand = new CreateInvitationCommand(
        workspaceId,
        ownerDto,
        invitedBy,
      );

      await expect(handler.execute(ownerCommand)).rejects.toThrow(
        new BadRequestException(
          'Owner role cannot be assigned through an invitation',
        ),
      );

      expect(userRepository.findByEmailWithoutPassword).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when invited user does not exist', async () => {
      userRepository.findByEmailWithoutPassword.mockResolvedValue(null);

      await expect(handler.execute(command)).rejects.toThrow(
        new NotFoundException('User with this email does not exist'),
      );

      expect(userRepository.findByEmailWithoutPassword).toHaveBeenCalledWith(
        dto.email,
      );
    });

    it('should throw ConflictException when user is already a member', async () => {
      membershipRepository.findByWorkspaceAndUser.mockReset();

      membershipRepository.findByWorkspaceAndUser
        .mockResolvedValueOnce(actorMembership as any)
        .mockResolvedValueOnce({
          _id: 'existing-membership',
          workspaceId,
          userId: invitedUser._id,
        } as any);

      await expect(handler.execute(command)).rejects.toThrow(
        new ConflictException('User is already a member of this workspace'),
      );

      expect(invitationRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when a pending invitation already exists', async () => {
      invitationRepository.findPendingByEmail.mockResolvedValue([
        {
          _id: 'existing-invitation',
          workspaceId,
          email: dto.email,
          status: InvitationStatus.PENDING,
        } as any,
      ]);

      await expect(handler.execute(command)).rejects.toThrow(
        new ConflictException(
          'A pending invitation already exists for this user',
        ),
      );

      expect(invitationRepository.create).not.toHaveBeenCalled();
    });

    it('should create the invitation with the correct arguments', async () => {
      await handler.execute(command);

      expect(invitationRepository.create).toHaveBeenCalledTimes(1);

      const args = invitationRepository.create.mock.calls[0];

      expect(args[0]).toBe(workspaceId);
      expect(args[1]).toBe(dto.email);
      expect(args[2]).toBe(dto.role);
      expect(args[3]).toEqual(expect.any(String));
      expect(args[3]).toHaveLength(64);
      expect(args[4]).toEqual(expect.any(Date));
      expect(args[5]).toBe(invitedBy);

      const expiresAt = args[4] as Date;

      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + 24 * 60 * 60 * 1000 + 1000,
      );
    });

    it('should send the workspace invitation email', async () => {
      await handler.execute(command);

      expect(mailService.sendWorkspaceInvitation).toHaveBeenCalledTimes(1);

      const args = mailService.sendWorkspaceInvitation.mock.calls[0];

      expect(args[0]).toBe(dto.email);
      expect(args[1]).toBe(workspace.name);
      expect(args[2]).toEqual(expect.any(String));
      expect(args[2]).toHaveLength(64);
      expect(args[3]).toEqual(expect.any(Date));
    });

    it('should write an audit log after creating the invitation', async () => {
      await handler.execute(command);

      expect(auditService.log).toHaveBeenCalledTimes(1);

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: invitedBy,
        action: 'INVITATION_CREATED',
        resource: 'INVITATION',
        workspaceId,
        meta: {
          invitedUserId: invitedUser._id.toString(),
          role: dto.role,
        },
      });
    });

    it('should return the created invitation without exposing the token hash', async () => {
      const result = await handler.execute(command);

      expect(result).toEqual({
        id: createdInvitation._id,
        email: createdInvitation.email,
        role: createdInvitation.role,
        expiresAt: createdInvitation.expiresAt,
        status: createdInvitation.status,
      });

      expect(result).not.toHaveProperty('tokenHash');
    });

    it('should propagate errors from workspaceRepository.findById', async () => {
      const error = new Error('Database error');

      workspaceRepository.findById.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);
    });

    it('should propagate errors from invitationRepository.create', async () => {
      const error = new Error('Invitation creation failed');

      invitationRepository.create.mockRejectedValue(error);

      await expect(handler.execute(command)).rejects.toThrow(error);
    });

    it('should propagate errors from mailService.sendWorkspaceInvitation', async () => {
      const error = new Error('Email sending failed');

      mailService.sendWorkspaceInvitation.mockRejectedValue(error);

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
