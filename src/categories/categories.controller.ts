import {
  Body,
  Post,
  Get,
  Delete,
  Request,
  Controller,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategryDto } from './DTO/create_category.dto';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { UpdateCategoryDto } from './DTO/update_category.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guards';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, } from '@nestjs/swagger';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private readonly categoryService: CategoriesService) {}

@Post()
@ApiOperation({ summary: 'Create a new category' })
@ApiResponse({
  status: 201,
  description: 'Category created successfully',
})
@ApiResponse({
  status: 401,
  description: 'Unauthorized',
})
  create(@Body() createCategoryDto: CreateCategryDto, @Request() req) {
    return this.categoryService.create(createCategoryDto, req.user.userId);
  }

@Get()
@ApiOperation({ summary: 'Get all categories for the authenticated user' })
@ApiResponse({
  status: 200,
  description: 'Categories retrieved successfully',
})
  findAll(@Request() req) {
    return this.categoryService.findAll(req.user.userId);
  }

@Get(':id')
@ApiOperation({ summary: 'Get a category by ID' })
@ApiResponse({
  status: 200,
  description: 'Category retrieved successfully',
})
@ApiResponse({
  status: 404,
  description: 'Category not found',
})
  findOne(@Param('id', ParseObjectIdPipe) id: string, @Request() req) {
    return this.categoryService.findOne(id, req.user.userId);
  }

@Patch(':id')
@ApiOperation({ summary: 'Update a category' })
@ApiResponse({
  status: 200,
  description: 'Category updated successfully',
})
@ApiResponse({
  status: 404,
  description: 'Category not found',
})
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Request() req,
  ) {
    return this.categoryService.update(id, updateCategoryDto, req.user.userId);
  }

@Delete(':id')
@ApiOperation({ summary: 'Delete a category' })
@ApiResponse({
  status: 200,
  description: 'Category deleted successfully',
})
@ApiResponse({
  status: 404,
  description: 'Category not found',
})
  remove(@Param('id', ParseObjectIdPipe) id: string, @Request() req) {
    return this.categoryService.remove(id, req.user.userId);
  }
}
