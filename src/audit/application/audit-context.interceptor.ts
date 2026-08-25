import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Scope,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuditContext } from './audit-context';

@Injectable({
  scope: Scope.REQUEST,
})
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly auditContext: AuditContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    const ip = request.ip ?? request.socket?.remoteAddress;

    this.auditContext.setIp(ip);

    return next.handle();
  }
}
