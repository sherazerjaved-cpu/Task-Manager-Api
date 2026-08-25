import { Test, TestingModule } from '@nestjs/testing';
import { LogoutHandler } from './logout.handler';
import { LogoutCommand } from './logout.command';
import { USER_REPOSITORY } from 'src/users/domain/constants/repository.tokens';
import { AuditService } from 'src/audit/application/audit.service';

describe('LogoutHandler', () => {
  let handler: LogoutHandler;

  const userRepository = {
    clearRefreshToken: jest.fn(),
  };

  const auditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogoutHandler,
        {
          provide: USER_REPOSITORY,
          useValue: userRepository,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    handler = module.get<LogoutHandler>(LogoutHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('successful logout', () => {
    it('should clear the refresh token and return success message', async () => {
      userRepository.clearRefreshToken.mockResolvedValue(undefined);
      auditService.log.mockResolvedValue(undefined);

      const command = new LogoutCommand('user-123');

      const result = await handler.execute(command);

      expect(userRepository.clearRefreshToken).toHaveBeenCalledTimes(1);
      expect(userRepository.clearRefreshToken).toHaveBeenCalledWith('user-123');

      expect(auditService.log).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'LOGOUT_SUCCESS',
        resource: 'AUTH',
      });

      expect(result).toEqual({
        message: 'Logged out successfully',
      });
    });
  });

  describe('repository failure', () => {
    it('should propagate the error when clearing the refresh token fails', async () => {
      const error = new Error('Database error');

      userRepository.clearRefreshToken.mockRejectedValue(error);

      const command = new LogoutCommand('user-123');

      await expect(handler.execute(command)).rejects.toThrow('Database error');

      expect(userRepository.clearRefreshToken).toHaveBeenCalledWith('user-123');

      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  describe('audit failure', () => {
    it('should propagate the error when audit logging fails', async () => {
      userRepository.clearRefreshToken.mockResolvedValue(undefined);

      const error = new Error('Audit service error');
      auditService.log.mockRejectedValue(error);

      const command = new LogoutCommand('user-123');

      await expect(handler.execute(command)).rejects.toThrow(
        'Audit service error',
      );

      expect(userRepository.clearRefreshToken).toHaveBeenCalledWith('user-123');

      expect(auditService.log).toHaveBeenCalledWith({
        actorId: 'user-123',
        action: 'LOGOUT_SUCCESS',
        resource: 'AUTH',
      });
    });
  });
});
