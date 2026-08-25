import { JwtService } from '@nestjs/jwt';
import { TaskGateway } from './task.gateway';

describe('TaskGateway', () => {
  let gateway: TaskGateway;
  let jwtService: {
    verify: jest.Mock;
  };

  let client: {
    id: string;
    handshake: {
      auth: {
        token?: unknown;
      };
    };
    disconnect: jest.Mock;
    join: jest.Mock;
  };

  let server: {
    to: jest.Mock;
    emit: jest.Mock;
  };

  beforeEach(() => {
    jwtService = {
      verify: jest.fn(),
    };

    gateway = new TaskGateway(jwtService as unknown as JwtService);

    client = {
      id: 'socket-123',
      handshake: {
        auth: {},
      },
      disconnect: jest.fn(),
      join: jest.fn(),
    };

    server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    gateway.server = server as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should reject the connection when no token is provided', () => {
      client.handshake.auth.token = undefined;

      gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalledTimes(1);
      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should reject the connection when token is not a string', () => {
      client.handshake.auth.token = 123;

      gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalledTimes(1);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('should authenticate the client and join the user room', () => {
      client.handshake.auth.token = 'valid-token';

      jwtService.verify.mockReturnValue({
        sub: 'user-123',
      });

      gateway.handleConnection(client as any);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');

      expect(client.join).toHaveBeenCalledWith('user-123');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should reject the connection when JWT verification fails', () => {
      client.handshake.auth.token = 'invalid-token';

      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      gateway.handleConnection(client as any);

      expect(jwtService.verify).toHaveBeenCalledWith('invalid-token');

      expect(client.disconnect).toHaveBeenCalledTimes(1);
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should handle client disconnection', () => {
      expect(() => {
        gateway.handleDisconnect(client as any);
      }).not.toThrow();
    });
  });

  describe('emitTaskCreated', () => {
    it('should emit a task.created event to the user room', () => {
      const task = {
        id: 'task-123',
        title: 'Test task',
      };

      gateway.emitTaskCreated('user-123', task);

      expect(server.to).toHaveBeenCalledWith('user-123');
      expect(server.emit).toHaveBeenCalledWith('task.created', task);
    });
  });

  describe('emitTaskUpdated', () => {
    it('should emit a task.updated event to the user room', () => {
      const task = {
        id: 'task-123',
        title: 'Updated task',
      };

      gateway.emitTaskUpdated('user-123', task);

      expect(server.to).toHaveBeenCalledWith('user-123');
      expect(server.emit).toHaveBeenCalledWith('task.updated', task);
    });
  });

  describe('emitTaskDeleted', () => {
    it('should emit a task.deleted event to the user room', () => {
      gateway.emitTaskDeleted('user-123', 'task-123');

      expect(server.to).toHaveBeenCalledWith('user-123');
      expect(server.emit).toHaveBeenCalledWith('task.deleted', {
        taskId: 'task-123',
      });
    });
  });
});
