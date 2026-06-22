import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/users/Schema/user.schema';
import { Model } from 'mongoose';
import { RegisterDto } from './DTO/register.dto';
import *as bcrypt from "bcrypt";
import { LoginDto } from './DTO/login.dto';


@Injectable()
export class AuthService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>, 
    private jwtService: JwtService){}

    async register(regiterDto: RegisterDto){
        const {email, password} = regiterDto;
        const existingUser = await this.userModel.findOne({email});
        if(existingUser){
            throw new ConflictException ("Email already registered")
        }
        const hashpassword = await bcrypt.hash(password, 10)
        const user = await this.userModel.create({email, password:hashpassword});
        return user;
    }

    async login(loginDto:LoginDto){
        const user = await this.userModel.findOne({email:loginDto.email});
        if(!user){
            throw new UnauthorizedException("Invalid Credentials")
        }
        const isMatch = await bcrypt.compare(loginDto.password, user.password)
        if(!isMatch){
            throw new UnauthorizedException("Invalid Credentials")
        }
        const payload = {sub: user._id.toString(), email: user.email}
        return {access_token: this.jwtService.sign(payload)}
    }
}
 