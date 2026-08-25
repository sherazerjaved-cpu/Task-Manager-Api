import { Reflector } from '@nestjs/core';
import { Roles, ROLES_KEY } from './roles.decorator';

describe('Roles decorator', () => {
  it('should set a single role as metadata', () => {
    class TestController {
      @Roles('admin')
      testMethod() {}
    }

    const reflector = new Reflector();

    const method = Reflect.get(TestController.prototype, 'testMethod') as (
      ...args: never[]
    ) => unknown;

    const roles = reflector.get<string[]>(ROLES_KEY, method);

    expect(roles).toEqual(['admin']);
  });

  it('should set multiple roles as metadata', () => {
    class TestController {
      @Roles('admin', 'user')
      testMethod() {}
    }

    const reflector = new Reflector();

    const method = Reflect.get(TestController.prototype, 'testMethod') as (
      ...args: never[]
    ) => unknown;

    const roles = reflector.get<string[]>(ROLES_KEY, method);

    expect(roles).toEqual(['admin', 'user']);
  });

  it('should set an empty array when no roles are provided', () => {
    class TestController {
      @Roles()
      testMethod() {}
    }

    const reflector = new Reflector();

    const method = Reflect.get(TestController.prototype, 'testMethod') as (
      ...args: never[]
    ) => unknown;

    const roles = reflector.get<string[]>(ROLES_KEY, method);

    expect(roles).toEqual([]);
  });
});
