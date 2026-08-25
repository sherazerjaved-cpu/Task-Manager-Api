import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateAccessToken(user: {
    _id: { toString(): string };
    email: string;
    role: string;
  }) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.getOrThrow(
        'JWT_ACCESS_EXPIRES_IN',
      ) as StringValue,
    });
  }

  async generateRefreshToken(
    user: {
      _id: { toString(): string };
    },
    tokenFamily: string,
    tokenId: string,
  ) {
    const payload = {
      sub: user._id.toString(),
      family: tokenFamily,
      jti: tokenId,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow(
        'JWT_REFRESH_EXPIRES_IN',
      ) as StringValue,
    });
  }
}
