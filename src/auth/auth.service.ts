import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/users/Schema/user.schema';
import { Model } from 'mongoose';
import { RegisterDto } from './DTO/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './DTO/login.dto';
import { ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';
import { RefreshTokenDto } from './DTO/refresh_token.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private async generateAccessToken(user: UserDocument) {
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

  private async generateRefreshToken(user: UserDocument) {
    const payload = {
      sub: user._id.toString(),
    };
    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow(
        'JWT_REFRESH_EXPIRES_IN',
      ) as StringValue,
    });
  }

  async register(regiterDto: RegisterDto) {
    const { email, password } = regiterDto;
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }
    const hashpassword = await bcrypt.hash(password, 10);
    const user = await this.userModel.create({ email, password: hashpassword });
    return this.userModel.findById(user._id);
  }

  async login(loginDto: LoginDto) {
    const user = await this.userModel
      .findOne({ email: loginDto.email })
      .select('+password');
    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }
    const isMatch = await bcrypt.compare(loginDto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid Credentials');
    }
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.userModel.findByIdAndUpdate(user._id, { refreshTokenHash });
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refresh_token } = refreshTokenDto;
    let payload: any;
    try {
      payload = this.jwtService.verify(refresh_token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh Token');
    }

    const user = await this.userModel
      .findById(payload.sub)
      .select('+refreshTokenHash');
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh Token Not Found');
    }

    const isValid = await bcrypt.compare(refresh_token, user.refreshTokenHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = await this.generateAccessToken(user);
    return { access_token: accessToken };
  }

  async logout(userId: string) {
    await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash: null });
    return { message: 'Logged out successfully' };
  }
}
