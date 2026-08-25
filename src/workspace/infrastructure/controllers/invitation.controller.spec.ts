import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { InvitationController } from './invitation.controller';
import { CreateInvitationDto } from '../../application/dto/create-invitation.dto';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';

describe('InvitationController', () => {
  let controller: InvitationController;

  const commandBus = {
    execute: jest.fn(),
  };

  const queryBus = {
    execute: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new InvitationController(
      commandBus as unknown as CommandBus,
      queryBus as unknown as QueryBus,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPendingInvitations', () => {
    it('should execute GetPendingInvitationsQuery with the authenticated user id', async () => {
      const result = [
        {
          id: 'invitation-123',
          email: 'user@example.com',
          role: WorkspaceRole.MEMBER,
        },
      ];

      queryBus.execute.mockResolvedValue(result);

      const req = {
        user: {
          userId: 'user-123',
        },
      };

      const response = await controller.getPendingInvitations(req);

      expect(queryBus.execute).toHaveBeenCalledTimes(1);

      const query = queryBus.execute.mock.calls[0][0];

      expect(query).toEqual(
        expect.objectContaining({
          userId: 'user-123',
        }),
      );

      expect(response).toBe(result);
    });

    it('should propagate errors from queryBus.execute', async () => {
      const error = new Error('query failed');

      queryBus.execute.mockRejectedValue(error);

      const req = {
        user: {
          userId: 'user-123',
        },
      };

      await expect(controller.getPendingInvitations(req)).rejects.toThrow(
        error,
      );
    });
  });

  describe('createInvitation', () => {
    const workspaceId = '507f1f77bcf86cd799439011';

    const dto: CreateInvitationDto = {
      email: 'invitee@example.com',
      role: WorkspaceRole.MEMBER,
    };

    const req = {
      user: {
        userId: 'user-123',
      },
    };

    it('should execute CreateInvitationCommand with the correct arguments', async () => {
      const result = {
        id: 'invitation-123',
        email: dto.email,
        role: dto.role,
      };

      commandBus.execute.mockResolvedValue(result);

      const response = await controller.createInvitation(workspaceId, dto, req);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toEqual(
        expect.objectContaining({
          workspaceId,
          dto,
          invitedBy: 'user-123',
        }),
      );

      expect(response).toBe(result);
    });

    it('should use the authenticated user id as invitedBy', async () => {
      commandBus.execute.mockResolvedValue({});

      await controller.createInvitation(workspaceId, dto, req);

      const command = commandBus.execute.mock.calls[0][0];

      expect(command.invitedBy).toBe('user-123');
    });

    it('should propagate errors from commandBus.execute', async () => {
      const error = new Error('command failed');

      commandBus.execute.mockRejectedValue(error);

      await expect(
        controller.createInvitation(workspaceId, dto, req),
      ).rejects.toThrow(error);
    });
  });

  describe('acceptInvitation', () => {
    const token = 'invitation-token-123';

    const req = {
      user: {
        userId: 'user-123',
      },
    };

    it('should execute AcceptInvitationCommand with the token and authenticated user id', async () => {
      const result = {
        id: 'membership-123',
      };

      commandBus.execute.mockResolvedValue(result);

      const response = await controller.acceptInvitation(token, req);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toEqual(
        expect.objectContaining({
          token,
          userId: 'user-123',
        }),
      );

      expect(response).toBe(result);
    });

    it('should propagate errors from commandBus.execute', async () => {
      const error = new Error('accept failed');

      commandBus.execute.mockRejectedValue(error);

      await expect(controller.acceptInvitation(token, req)).rejects.toThrow(
        error,
      );
    });
  });

  describe('declineInvitation', () => {
    const token = 'invitation-token-123';

    const req = {
      user: {
        userId: 'user-123',
      },
    };

    it('should execute DeclineInvitationCommand with the token and authenticated user id', async () => {
      const result = {
        message: 'Invitation declined successfully',
      };

      commandBus.execute.mockResolvedValue(result);

      const response = await controller.declineInvitation(token, req);

      expect(commandBus.execute).toHaveBeenCalledTimes(1);

      const command = commandBus.execute.mock.calls[0][0];

      expect(command).toEqual(
        expect.objectContaining({
          token,
          userId: 'user-123',
        }),
      );

      expect(response).toBe(result);
    });

    it('should propagate errors from commandBus.execute', async () => {
      const error = new Error('decline failed');

      commandBus.execute.mockRejectedValue(error);

      await expect(controller.declineInvitation(token, req)).rejects.toThrow(
        error,
      );
    });
  });
});
