import { SetMetadata } from '@nestjs/common';
import { AppAbility } from './app-ability';

export type PolicyHandler = (ability: AppAbility, request: any) => boolean;

export const CHECK_POLICIES_KEY = 'check_policy';

export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);

export const GLOBAL_POLICY_KEY = 'global_policy';

export const GlobalPolicy = () => SetMetadata(GLOBAL_POLICY_KEY, true);

export const LOAD_TASK_KEY = 'load_task';

export const LoadTask = () => SetMetadata(LOAD_TASK_KEY, true);
