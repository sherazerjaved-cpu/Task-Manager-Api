import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './Strategy/jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { RolesGuard } from './guards/roles.guards';
import { UsersModule } from 'src/users/users.module';
import { CqrsModule } from '@nestjs/cqrs';
import { RegisterUserHandler } from './application/command/register-user/register-user.handler';
import { LoginHandler } from './application/command/login/login.handler';
import { RefreshTokenHandler } from './application/command/refresh-token/refresh-token.handler';
import { LogoutHandler } from './application/command/logout/logout.handler';
import { TokenService } from './services/token.service';
import { MailModule } from 'src/mail/mail.module';
import { VerifyEmailHandler } from './application/command/verify-email/verify-email.handler';
import { ForgotPasswordHandler } from './application/command/forgot-password/forgot-password.handler';
import { ResetPasswordHandler } from './application/command/reset-password/reset-password.handler';
import { BruteForceService } from './services/brute-force.service';
import { UserRateLimitService } from './services/user-rate-limit.service';
import { AuditModule } from 'src/audit/audit.module';
import { OutboxModule } from 'src/outbox/outbox.module';

@Module({
  imports: [
    CqrsModule,
    UsersModule,
    MailModule,
    ConfigModule,
    AuditModule,
    OutboxModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.getOrThrow('JWT_ACCESS_EXPIRES_IN') },
      }),
    }),
  ],
  providers: [
    RolesGuard,
    JwtStrategy,
    TokenService,
    BruteForceService,
    UserRateLimitService,
    RegisterUserHandler,
    LoginHandler,
    RefreshTokenHandler,
    LogoutHandler,
    VerifyEmailHandler,
    ForgotPasswordHandler,
    ResetPasswordHandler,
  ],
  controllers: [AuthController],
  exports: [JwtModule, UserRateLimitService],
})
export class AuthModule {}
