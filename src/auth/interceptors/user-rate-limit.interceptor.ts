import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import { UserRateLimitService } from '../services/user-rate-limit.service';

@Injectable()
export class UserRateLimitInterceptor implements NestInterceptor {
  constructor(private readonly userRateLimitService: UserRateLimitService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();

    const user = request.user;

    if (!user?.userId && !user?.sub) {
      return next.handle();
    }

    const userId = user.userId ?? user.sub;

    const allowed = await this.userRateLimitService.checkLimit(userId);

    if (!allowed) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return next.handle();
  }
}
