import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guards';
import { RolesGuard } from 'src/auth/guards/roles.guards';
import { UsersService } from './users.service';

@Controller({path: 'users', version: '1'})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class UsersController {
    constructor (private readonly usersService: UsersService){}

    @Get()
    findAll(){
        return this.usersService.findAll()
    }

    @Delete(":id")
    deleteUser(@Param("id") id:string){
        return this.usersService.deleteUser(id)
    }
}
