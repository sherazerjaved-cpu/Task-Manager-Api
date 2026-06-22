import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, UserSchema } from 'src/users/Schema/user.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtStrategy } from './Strategy/jwt.strategy';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [MongooseModule.forFeature([{name:User.name, schema: UserSchema}]),ConfigModule,
  PassportModule.register({defaultStrategy: "jwt"}), 
  JwtModule.registerAsync({inject:[ConfigService], useFactory: (config: ConfigService) =>({
      secret:config.get("JWT_SECRET"), signOptions:{expiresIn: "1d"}})})],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtModule]
})
export class AuthModule {}
