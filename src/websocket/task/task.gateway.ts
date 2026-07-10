import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../Interfaces/jwt-payload.interface';

@WebSocketGateway({ cors: { origin: '*' } })
export class TaskGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly jwtService: JwtService) {}
  @WebSocketServer()
  server!: Server;
  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (typeof token !== 'string') {
        console.log('WebSocket connect rejected: No token provided.');
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify<JwtPayload>(token);
      void client.join(payload.sub);
      console.log(`Client connected: ${client.id}`);
    } catch {
      console.log('WebSocket authentication failed');
      client.disconnect();
    }
  }
  handleDisconnect(client: Socket) {
    console.log(`client disconnected: ${client.id}`);
  }

  emitTaskCreated(userId: string, task: any) {
    this.server.to(userId).emit('task.created', task);
    console.log(`Task created event sent to user ${userId}`);
  }

  emitTaskUpdated(userId: string, task: any) {
    this.server.to(userId).emit('task.updated', task);
    console.log(`Task updated event sent to user ${userId}`);
  }

  emitTaskDeleted(userId: string, taskId: string) {
    this.server.to(userId).emit('task.deleted', { taskId });
    console.log(`Task deleted event sent to user ${userId}`);
  }
}
