import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CHECK_POLICIES_KEY,
  PolicyHandler,
  LOAD_TASK_KEY,
  GLOBAL_POLICY_KEY,
} from './check-policies.decorator';
import { AbilityFactory } from './ability.factory';

import type { IMembershipRepository } from 'src/workspace/domain/repositories/membership.repository.interface';
import { MEMBERSHIP_REPOSITORY } from 'src/workspace/domain/repositories/membership.repository.interface';

import { MembershipStatus } from 'src/workspace/domain/enums/membership-status.enum';

import { TASK_REPOSITORY } from 'src/task/domain/constants/repository.tokens';
import type { ITaskRepository } from 'src/task/domain/repositories/task.repository.interface';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,

    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepository: IMembershipRepository,

    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlers = this.reflector.getAllAndOverride<PolicyHandler[]>(
      CHECK_POLICIES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const isGlobalPolicy = this.reflector.getAllAndOverride<boolean>(
      GLOBAL_POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );

    const loadTask = this.reflector.getAllAndOverride<boolean>(LOAD_TASK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!handlers || handlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.userId) {
      throw new ForbiddenException('User not found');
    }

    if (isGlobalPolicy) {
      const ability = this.abilityFactory.createForUser();

      const allowed = handlers.every((handler) => handler(ability, request));

      if (!allowed) {
        throw new ForbiddenException(
          'You do not have permission to perform this action',
        );
      }

      request.ability = ability;

      return true;
    }

    const workspaceId =
      request.params.workspaceId ??
      request.query.workspaceId ??
      request.body?.workspaceId ??
      request.params.id;

    if (!workspaceId) {
      throw new ForbiddenException(
        'Workspace context is required for this policy',
      );
    }

    if (loadTask) {
      const task = await this.taskRepository.findById(
        request.params.id,
        workspaceId,
      );

      if (!task) {
        throw new ForbiddenException('Task not found');
      }

      request.task = task;
    }

    const membership = await this.membershipRepository.findByWorkspaceAndUser(
      workspaceId,
      user.userId,
    );

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const ability = this.abilityFactory.createForRole(
      membership.role,
      user.userId,
    );

    const allowed = handlers.every((handler) => handler(ability, request));

    if (!allowed) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    request.ability = ability;

    return true;
  }
}
