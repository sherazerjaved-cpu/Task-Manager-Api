import { Test, TestingModule } from '@nestjs/testing';

import { GetWorkspacesHandler } from './get-workspaces.handler';
import { GetWorkspacesQuery } from './get-workspaces.query';

import { WORKSPACE_REPOSITORY } from '../../../domain/repositories/workspace.repository.interface';

import type { IWorkspaceRepository } from '../../../domain/repositories/workspace.repository.interface';

import { MEMBERSHIP_REPOSITORY } from '../../../domain/repositories/membership.repository.interface';

import type { IMembershipRepository } from '../../../domain/repositories/membership.repository.interface';

describe('GetWorkspacesHandler', () => {
  let handler: GetWorkspacesHandler;

  let workspaceRepository: jest.Mocked<IWorkspaceRepository>;
  let membershipRepository: jest.Mocked<IMembershipRepository>;

  beforeEach(async () => {
    workspaceRepository = {
      findByIds: jest.fn(),
    } as any;

    membershipRepository = {
      findByUser: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetWorkspacesHandler,
        {
          provide: WORKSPACE_REPOSITORY,
          useValue: workspaceRepository,
        },
        {
          provide: MEMBERSHIP_REPOSITORY,
          useValue: membershipRepository,
        },
      ],
    }).compile();

    handler = module.get<GetWorkspacesHandler>(GetWorkspacesHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should find memberships for the user', async () => {
      const userId = 'user-123';

      const query = new GetWorkspacesQuery(userId);

      membershipRepository.findByUser.mockResolvedValue([]);

      await handler.execute(query);

      expect(membershipRepository.findByUser).toHaveBeenCalledWith(userId);

      expect(membershipRepository.findByUser).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array when the user has no memberships', async () => {
      const userId = 'user-123';

      const query = new GetWorkspacesQuery(userId);

      membershipRepository.findByUser.mockResolvedValue([]);

      const result = await handler.execute(query);

      expect(result).toEqual([]);

      expect(workspaceRepository.findByIds).not.toHaveBeenCalled();
    });

    it('should extract workspace IDs from memberships', async () => {
      const userId = 'user-123';

      const query = new GetWorkspacesQuery(userId);

      const memberships = [
        {
          workspaceId: {
            toString: () => 'workspace-1',
          },
        },
        {
          workspaceId: {
            toString: () => 'workspace-2',
          },
        },
      ];

      membershipRepository.findByUser.mockResolvedValue(memberships as any);

      workspaceRepository.findByIds.mockResolvedValue([]);

      await handler.execute(query);

      expect(workspaceRepository.findByIds).toHaveBeenCalledWith([
        'workspace-1',
        'workspace-2',
      ]);
    });

    it('should return the workspaces returned by the repository', async () => {
      const userId = 'user-123';

      const query = new GetWorkspacesQuery(userId);

      const memberships = [
        {
          workspaceId: {
            toString: () => 'workspace-1',
          },
        },
        {
          workspaceId: {
            toString: () => 'workspace-2',
          },
        },
      ];

      const workspaces = [
        {
          _id: 'workspace-1',
          name: 'Workspace One',
          slug: 'workspace-one',
        },
        {
          _id: 'workspace-2',
          name: 'Workspace Two',
          slug: 'workspace-two',
        },
      ];

      membershipRepository.findByUser.mockResolvedValue(memberships as any);

      workspaceRepository.findByIds.mockResolvedValue(workspaces as any);

      const result = await handler.execute(query);

      expect(result).toEqual(workspaces);
    });

    it('should call findByIds only with the user membership workspace IDs', async () => {
      const userId = 'user-123';

      const query = new GetWorkspacesQuery(userId);

      const memberships = [
        {
          workspaceId: {
            toString: () => 'workspace-abc',
          },
        },
        {
          workspaceId: {
            toString: () => 'workspace-xyz',
          },
        },
        {
          workspaceId: {
            toString: () => 'workspace-123',
          },
        },
      ];

      membershipRepository.findByUser.mockResolvedValue(memberships as any);

      workspaceRepository.findByIds.mockResolvedValue([]);

      await handler.execute(query);

      expect(workspaceRepository.findByIds).toHaveBeenCalledWith([
        'workspace-abc',
        'workspace-xyz',
        'workspace-123',
      ]);

      expect(workspaceRepository.findByIds).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from membershipRepository.findByUser', async () => {
      const userId = 'user-123';

      const query = new GetWorkspacesQuery(userId);

      const error = new Error('Failed to find memberships');

      membershipRepository.findByUser.mockRejectedValue(error);

      await expect(handler.execute(query)).rejects.toThrow(error);

      expect(workspaceRepository.findByIds).not.toHaveBeenCalled();
    });

    it('should propagate errors from workspaceRepository.findByIds', async () => {
      const userId = 'user-123';

      const query = new GetWorkspacesQuery(userId);

      const memberships = [
        {
          workspaceId: {
            toString: () => 'workspace-123',
          },
        },
      ];

      const error = new Error('Failed to find workspaces');

      membershipRepository.findByUser.mockResolvedValue(memberships as any);

      workspaceRepository.findByIds.mockRejectedValue(error);

      await expect(handler.execute(query)).rejects.toThrow(error);
    });
  });
});
