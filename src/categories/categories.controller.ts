import { Body,Post, Get, Delete, Request, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategryDto } from './DTO/create_category.dto';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { UpdateCategoryDto } from './DTO/update_category.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guards';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({path: 'categories', version: '1'})
export class CategoriesController {
    constructor (private readonly categoryService:CategoriesService){}

    @Post()
    create(@Body() createCategoryDto: CreateCategryDto, @Request() req){
        return this.categoryService.create(createCategoryDto, req.user.userId);
    }

    @Get()
    findAll(@Request() req){
        return this.categoryService.findAll(req.user.userId, req.user.role)
    }

    @Get(":id")
    findOne(@Param("id", ParseObjectIdPipe) id:string, @Request() req){
        return this.categoryService.findOne(id, req.user.userId, req.user.role)
    }

    @Patch(":id")
    update(@Param("id", ParseObjectIdPipe) id:string, @Body() updateCategoryDto: UpdateCategoryDto, @Request() req){
        return this.categoryService.update(id, updateCategoryDto, req.user.userId, req.user.role)
    } 

     @Delete(':id')
     remove(@Param('id', ParseObjectIdPipe) id: string, @Request() req){
        return this.categoryService.remove(id, req.user.userId, req.user.role)
    }

}
