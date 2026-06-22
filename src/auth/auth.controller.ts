import {Post, Body, Controller } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './DTO/register.dto';
import { LoginDto } from './DTO/login.dto';

@Controller('auth')
export class AuthController {
    constructor (private readonly authService:AuthService){}

    @Post("register")
    register(@Body() registerDto:RegisterDto){
        return this.authService.register(registerDto)
        }
        
        @Post("login")
        login(@Body() loginDto: LoginDto){
            return this.authService.login(loginDto)
        }
}
