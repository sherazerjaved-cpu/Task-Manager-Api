import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PoliciesGuard } from './policies.guard';
import {
  CHECK_POLICIES_KEY,
  GLOBAL_POLICY_KEY,
  LOAD_TASK_KEY,
  PolicyHandler,
} from './check-policies.decorator';

import { AbilityFactory } from './ability.factory';

import type { IMembershipRepository } from 'src/workspace/domain/repositories/membership.repository.interface';
import { MembershipStatus } from 'src/workspace/domain/enums/membership-status.enum';
import { WorkspaceRole } from 'src/workspace/domain/enums/workspace-role.enum';

import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';

import type { ExecutionContext } from '@nestjs/common';

type TestRequest = {
  user?: {
    userId?: string;
  };

  params?: Record<string, string | undefined>;

  query?: Record<string, string | undefined>;

  body?: Record<string, unknown>;

  ability?: unknown;

  task?: unknown;
};

type MockExecutionContextOptions = {
  request: TestRequest;
};

describe('PoliciesGuard', () => {
  let guard: PoliciesGuard;

  let reflector: {
    getAllAndOverride: jest.Mock;
  };

  let abilityFactory: {
    createForUser: jest.Mock;
    createForRole: jest.Mock;
  };

  let membershipRepository: {
    findByWorkspaceAndUser: jest.Mock;
  };

  let taskRepository: {
    findById: jest.Mock;
  };

  const createContext = ({
    request,
  }: MockExecutionContextOptions): ExecutionContext => {
    request.params ??= {};
    request.query ??= {};
    request.body ??= {};

    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),

      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
    } as unknown as ExecutionContext;
  };

  const createMembership = (role: WorkspaceRole = WorkspaceRole.MEMBER) => ({
    role,
    status: MembershipStatus.ACTIVE,
    workspaceId: 'workspace-123',
    userId: 'user-123',
  });

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };

    abilityFactory = {
      createForUser: jest.fn(),
      createForRole: jest.fn(),
    };

    membershipRepository = {
      findByWorkspaceAndUser: jest.fn(),
    };

    taskRepository = {
      findById: jest.fn(),
    };

    guard = new PoliciesGuard(
      reflector as unknown as Reflector,
      abilityFactory as unknown as AbilityFactory,
      membershipRepository as unknown as IMembershipRepository,
      taskRepository as unknown as ITaskRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when no policies are configured', () => {
    it('should allow access when no policy handlers exist', async () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return undefined;
        }

        return undefined;
      });

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).not.toHaveBeenCalled();
      expect(taskRepository.findById).not.toHaveBeenCalled();
      expect(abilityFactory.createForRole).not.toHaveBeenCalled();
      expect(abilityFactory.createForUser).not.toHaveBeenCalled();
    });

    it('should allow access when policy handlers are an empty array', async () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return [];
        }

        return undefined;
      });

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).not.toHaveBeenCalled();
    });
  });

  describe('authorization failures', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return [jest.fn().mockReturnValue(true)];
        }

        return undefined;
      });
    });

    it('should throw ForbiddenException when user is missing', async () => {
      const request: TestRequest = {};

      const context = createContext({ request });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        'User not found',
      );

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when userId is missing', async () => {
      const request: TestRequest = {
        user: {},
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('global policies', () => {
    const globalAbility = {
      can: jest.fn(),
    };

    beforeEach(() => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return [
            jest.fn().mockReturnValue(true),
            jest.fn().mockReturnValue(true),
          ];
        }

        if (key === GLOBAL_POLICY_KEY) {
          return true;
        }

        if (key === LOAD_TASK_KEY) {
          return undefined;
        }

        return undefined;
      });

      abilityFactory.createForUser.mockReturnValue(globalAbility);
    });

    it('should create a global ability', async () => {
      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(abilityFactory.createForUser).toHaveBeenCalledTimes(1);
      expect(abilityFactory.createForRole).not.toHaveBeenCalled();
    });

    it('should execute all global policy handlers', async () => {
      const firstHandler = jest.fn().mockReturnValue(true);
      const secondHandler = jest.fn().mockReturnValue(true);

      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return [firstHandler, secondHandler];
        }

        if (key === GLOBAL_POLICY_KEY) {
          return true;
        }

        return undefined;
      });

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(firstHandler).toHaveBeenCalledWith(globalAbility, request);
      expect(secondHandler).toHaveBeenCalledWith(globalAbility, request);
    });

    it('should allow access when every global policy passes', async () => {
      const handlers: PolicyHandler[] = [
        jest.fn().mockReturnValue(true),
        jest.fn().mockReturnValue(true),
        jest.fn().mockReturnValue(true),
      ];

      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return handlers;
        }

        if (key === GLOBAL_POLICY_KEY) {
          return true;
        }

        return undefined;
      });

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(request.ability).toBe(globalAbility);
    });

    it('should reject when a global policy fails', async () => {
      const passingHandler = jest.fn().mockReturnValue(true);
      const failingHandler = jest.fn().mockReturnValue(false);

      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return [passingHandler, failingHandler];
        }

        if (key === GLOBAL_POLICY_KEY) {
          return true;
        }

        return undefined;
      });

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        'You do not have permission to perform this action',
      );

      expect(request.ability).toBeUndefined();
    });

    it('should not query workspace membership for global policies', async () => {
      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).not.toHaveBeenCalled();
      expect(taskRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('workspace policies', () => {
    const ability = {
      can: jest.fn(),
    };

    beforeEach(() => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return [jest.fn().mockReturnValue(true)];
        }

        if (key === GLOBAL_POLICY_KEY) {
          return false;
        }

        if (key === LOAD_TASK_KEY) {
          return false;
        }

        return undefined;
      });

      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        createMembership(WorkspaceRole.MEMBER),
      );

      abilityFactory.createForRole.mockReturnValue(ability);
    });

    it('should read workspaceId from route params', async () => {
      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        'workspace-123',
        'user-123',
      );
    });

    it('should read workspaceId from query parameters', async () => {
      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        query: {
          workspaceId: 'workspace-query',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        'workspace-query',
        'user-123',
      );
    });

    it('should read workspaceId from request body', async () => {
      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        body: {
          workspaceId: 'workspace-body',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        'workspace-body',
        'user-123',
      );
    });

    it('should use params.id as workspace context when no workspaceId exists', async () => {
      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          id: 'workspace-from-id',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        'workspace-from-id',
        'user-123',
      );
    });

    it('should reject when workspace context is missing', async () => {
      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Workspace context is required for this policy',
      );

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).not.toHaveBeenCalled();
    });

    it('should reject when membership does not exist', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        'You are not a member of this workspace',
      );
    });

    it('should reject inactive membership', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue({
        ...createMembership(),
        status: 'INACTIVE' as MembershipStatus,
      });

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        'You are not a member of this workspace',
      );

      expect(abilityFactory.createForRole).not.toHaveBeenCalled();
    });

    it('should create ability using the membership role', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        createMembership(WorkspaceRole.ADMIN),
      );

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(abilityFactory.createForRole).toHaveBeenCalledWith(
        WorkspaceRole.ADMIN,
        'user-123',
      );
    });

    it('should attach the created ability to the request', async () => {
      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(request.ability).toBe(ability);
    });

    it('should execute the policy handler with ability and request', async () => {
      const handler = jest.fn().mockReturnValue(true);

      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return [handler];
        }

        if (key === GLOBAL_POLICY_KEY) {
          return false;
        }

        if (key === LOAD_TASK_KEY) {
          return false;
        }

        return undefined;
      });

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(handler).toHaveBeenCalledWith(ability, request);
    });

    it('should allow access when every workspace policy passes', async () => {
      const firstHandler = jest.fn().mockReturnValue(true);
      const secondHandler = jest.fn().mockReturnValue(true);

      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return [firstHandler, secondHandler];
        }

        if (key === GLOBAL_POLICY_KEY) {
          return false;
        }

        return undefined;
      });

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('should reject when a workspace policy fails', async () => {
      const passingHandler = jest.fn().mockReturnValue(true);
      const failingHandler = jest.fn().mockReturnValue(false);

      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return [passingHandler, failingHandler];
        }

        if (key === GLOBAL_POLICY_KEY) {
          return false;
        }

        return undefined;
      });

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        'You do not have permission to perform this action',
      );
    });

    it('should not execute later policy handlers after a failure', async () => {
      const failingHandler = jest.fn().mockReturnValue(false);
      const laterHandler = jest.fn().mockReturnValue(true);

      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return [failingHandler, laterHandler];
        }

        if (key === GLOBAL_POLICY_KEY) {
          return false;
        }

        return undefined;
      });

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      expect(failingHandler).toHaveBeenCalledTimes(1);
      expect(laterHandler).not.toHaveBeenCalled();
    });
  });

  describe('task loading', () => {
    const ability = {
      can: jest.fn(),
    };

    const task = {
      _id: 'task-123',
      workspaceId: 'workspace-123',
      owner: 'user-123',
      title: 'Test task',
    };

    beforeEach(() => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return [jest.fn().mockReturnValue(true)];
        }

        if (key === GLOBAL_POLICY_KEY) {
          return false;
        }

        if (key === LOAD_TASK_KEY) {
          return true;
        }

        return undefined;
      });

      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        createMembership(WorkspaceRole.MEMBER),
      );

      abilityFactory.createForRole.mockReturnValue(ability);
      taskRepository.findById.mockResolvedValue(task);
    });

    it('should load the task before checking membership', async () => {
      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          id: 'task-123',
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(taskRepository.findById).toHaveBeenCalledWith(
        'task-123',
        'workspace-123',
      );

      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalledWith(
        'workspace-123',
        'user-123',
      );
    });

    it('should attach the loaded task to the request', async () => {
      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          id: 'task-123',
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(request.task).toBe(task);
    });

    it('should reject when the requested task does not exist', async () => {
      taskRepository.findById.mockResolvedValue(null);

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          id: 'task-123',
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Task not found',
      );

      expect(
        membershipRepository.findByWorkspaceAndUser,
      ).not.toHaveBeenCalled();
    });

    it('should load task using workspace from params', async () => {
      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          id: 'task-456',
          workspaceId: 'workspace-456',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(taskRepository.findById).toHaveBeenCalledWith(
        'task-456',
        'workspace-456',
      );
    });

    it('should still check membership after loading the task', async () => {
      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(null);

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          id: 'task-123',
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'You are not a member of this workspace',
      );

      expect(taskRepository.findById).toHaveBeenCalled();
      expect(membershipRepository.findByWorkspaceAndUser).toHaveBeenCalled();
    });
  });

  describe('reflector metadata', () => {
    it('should read policy handlers from handler and class metadata', async () => {
      const handlers: PolicyHandler[] = [jest.fn().mockReturnValue(true)];

      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === CHECK_POLICIES_KEY) {
          return handlers;
        }

        if (key === GLOBAL_POLICY_KEY) {
          return false;
        }

        return undefined;
      });

      membershipRepository.findByWorkspaceAndUser.mockResolvedValue(
        createMembership(),
      );

      abilityFactory.createForRole.mockReturnValue({});

      const request: TestRequest = {
        user: {
          userId: 'user-123',
        },
        params: {
          workspaceId: 'workspace-123',
        },
      };

      const context = createContext({ request });

      await guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        CHECK_POLICIES_KEY,
        expect.any(Array),
      );

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        GLOBAL_POLICY_KEY,
        expect.any(Array),
      );

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        LOAD_TASK_KEY,
        expect.any(Array),
      );
    });
  });
});
