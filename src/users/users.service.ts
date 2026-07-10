import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './Schema/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class UsersService {
    constructor (@InjectModel(User.name) private readonly userModel:Model<User>){}

    async findAll(){
        return this.userModel.find().select("-password");
    }

    async deleteUser(id:string){
        const user = await this.userModel.findOneAndDelete({_id:id})

        if(!user){
            throw new NotFoundException("User Not Found")
        }

        return { message: "User Deleted Successfully"};
    }
}
