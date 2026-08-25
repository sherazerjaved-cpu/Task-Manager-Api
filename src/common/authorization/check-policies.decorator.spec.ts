import {
  CheckPolicies,
  GlobalPolicy,
  LoadTask,
  CHECK_POLICIES_KEY,
  GLOBAL_POLICY_KEY,
  LOAD_TASK_KEY,
  PolicyHandler,
} from './check-policies.decorator';

describe('CheckPolicies decorators', () => {
  describe('CheckPolicies', () => {
    it('should store policy handlers as metadata', () => {
      const policy1: PolicyHandler = jest.fn().mockReturnValue(true);
      const policy2: PolicyHandler = jest.fn().mockReturnValue(false);

      class TestController {
        @CheckPolicies(policy1, policy2)
        testMethod() {}
      }

      const handlers = Reflect.getMetadata(
        CHECK_POLICIES_KEY,
        TestController.prototype.testMethod,
      );

      expect(handlers).toEqual([policy1, policy2]);
    });

    it('should store an empty array when no policies are provided', () => {
      class TestController {
        @CheckPolicies()
        testMethod() {}
      }

      const handlers = Reflect.getMetadata(
        CHECK_POLICIES_KEY,
        TestController.prototype.testMethod,
      );

      expect(handlers).toEqual([]);
    });

    it('should preserve the order of policy handlers', () => {
      const policy1: PolicyHandler = jest.fn().mockReturnValue(true);
      const policy2: PolicyHandler = jest.fn().mockReturnValue(true);
      const policy3: PolicyHandler = jest.fn().mockReturnValue(true);

      class TestController {
        @CheckPolicies(policy1, policy2, policy3)
        testMethod() {}
      }

      const handlers = Reflect.getMetadata(
        CHECK_POLICIES_KEY,
        TestController.prototype.testMethod,
      );

      expect(handlers).toEqual([policy1, policy2, policy3]);
    });
  });

  describe('GlobalPolicy', () => {
    it('should set GLOBAL_POLICY_KEY metadata to true', () => {
      class TestController {
        @GlobalPolicy()
        testMethod() {}
      }

      const metadata = Reflect.getMetadata(
        GLOBAL_POLICY_KEY,
        TestController.prototype.testMethod,
      );

      expect(metadata).toBe(true);
    });

    it('should not set CHECK_POLICIES_KEY metadata', () => {
      class TestController {
        @GlobalPolicy()
        testMethod() {}
      }

      const policies = Reflect.getMetadata(
        CHECK_POLICIES_KEY,
        TestController.prototype.testMethod,
      );

      expect(policies).toBeUndefined();
    });
  });

  describe('LoadTask', () => {
    it('should set LOAD_TASK_KEY metadata to true', () => {
      class TestController {
        @LoadTask()
        testMethod() {}
      }

      const metadata = Reflect.getMetadata(
        LOAD_TASK_KEY,
        TestController.prototype.testMethod,
      );

      expect(metadata).toBe(true);
    });

    it('should not set GLOBAL_POLICY_KEY metadata', () => {
      class TestController {
        @LoadTask()
        testMethod() {}
      }

      const metadata = Reflect.getMetadata(
        GLOBAL_POLICY_KEY,
        TestController.prototype.testMethod,
      );

      expect(metadata).toBeUndefined();
    });
  });

  describe('metadata isolation', () => {
    it('should keep metadata separate between methods', () => {
      const policy: PolicyHandler = jest.fn().mockReturnValue(true);

      class TestController {
        @CheckPolicies(policy)
        firstMethod() {}

        @GlobalPolicy()
        secondMethod() {}

        @LoadTask()
        thirdMethod() {}
      }

      expect(
        Reflect.getMetadata(
          CHECK_POLICIES_KEY,
          TestController.prototype.firstMethod,
        ),
      ).toEqual([policy]);

      expect(
        Reflect.getMetadata(
          GLOBAL_POLICY_KEY,
          TestController.prototype.secondMethod,
        ),
      ).toBe(true);

      expect(
        Reflect.getMetadata(
          LOAD_TASK_KEY,
          TestController.prototype.thirdMethod,
        ),
      ).toBe(true);
    });
  });
});
