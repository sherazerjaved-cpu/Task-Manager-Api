import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guards';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let getAllAndOverride: jest.Mock;

  const createExecutionContext = (user?: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    getAllAndOverride = jest.fn();

    reflector = {
      getAllAndOverride,
    } as unknown as Reflector;

    guard = new RolesGuard(reflector);
  });

  describe('when no roles are required', () => {
    it('should allow access', () => {
      getAllAndOverride.mockReturnValue(undefined);

      const context = createExecutionContext({
        userId: 'user-1',
        role: 'user',
      });

      expect(guard.canActivate(context)).toBe(true);

      expect(getAllAndOverride).toHaveBeenCalledWith(
        'roles',
        expect.any(Array),
      );
    });
  });

  describe('when roles are required', () => {
    it('should allow an admin user when admin role is required', () => {
      getAllAndOverride.mockReturnValue(['admin']);

      const context = createExecutionContext({
        userId: 'admin-1',
        role: 'admin',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow a regular user when user role is required', () => {
      getAllAndOverride.mockReturnValue(['user']);

      const context = createExecutionContext({
        userId: 'user-1',
        role: 'user',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when the user has one of multiple required roles', () => {
      getAllAndOverride.mockReturnValue(['user', 'admin']);

      const context = createExecutionContext({
        userId: 'user-1',
        role: 'user',
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow an admin when multiple roles include admin', () => {
      getAllAndOverride.mockReturnValue(['user', 'admin']);

      const context = createExecutionContext({
        userId: 'admin-1',
        role: 'admin',
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('authorization failures', () => {
    it('should throw ForbiddenException when user is missing', () => {
      getAllAndOverride.mockReturnValue(['admin']);

      const context = createExecutionContext(undefined);

      expect(() => guard.canActivate(context)).toThrow('User Not Found');
    });

    it('should throw ForbiddenException when user does not have the required role', () => {
      getAllAndOverride.mockReturnValue(['admin']);

      const context = createExecutionContext({
        userId: 'user-1',
        role: 'user',
      });

      expect(() => guard.canActivate(context)).toThrow(
        'You do not have permission to access this resource',
      );
    });

    it('should reject an admin when only user role is required', () => {
      getAllAndOverride.mockReturnValue(['user']);

      const context = createExecutionContext({
        userId: 'admin-1',
        role: 'admin',
      });

      expect(() => guard.canActivate(context)).toThrow(
        'You do not have permission to access this resource',
      );
    });
  });

  describe('reflector behavior', () => {
    it('should check handler and class metadata', () => {
      getAllAndOverride.mockReturnValue(['admin']);

      const context = createExecutionContext({
        userId: 'admin-1',
        role: 'admin',
      });

      guard.canActivate(context);

      expect(getAllAndOverride).toHaveBeenCalledTimes(1);

      const [key, targets] = getAllAndOverride.mock.calls[0];

      expect(key).toBe('roles');
      expect(targets).toHaveLength(2);
    });
  });
});
