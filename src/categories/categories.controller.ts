import {
  Body,
  Post,
  Get,
  Delete,
  Request,
  Res,
  Controller,
  Param,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CreateCategryDto } from './DTO/create_category.dto';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { UpdateCategoryDto } from './DTO/update_category.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guards';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { CreateCategoryCommand } from './application/commands/create-category/create-category.command';
import { QueryBus } from '@nestjs/cqrs';
import { GetCategoriesQuery } from './application/queries/get-categories/get-categories.query';
import { GetCategoryQuery } from './application/queries/get-category/get-category.query';
import { UpdateCategoryCommand } from './application/commands/update-category/update-category.command';
import { DeleteCategoryCommand } from './application/commands/delete-category/delete-category.command';
import { IdempotencyInterceptor } from 'src/common/idempotency/idempotency.interceptor';
import { ApiIdempotencyKey } from 'src/common/http/api-headers.decorator';
import { ProblemResponses } from 'src/common/http/problem-responses.decorator';
import type { Response } from 'express';
import { parseIfMatch } from 'src/common/http/parse-if-match';
import { ApiIfMatch } from 'src/common/http/api-headers.decorator';

@ApiTags('Categories')
@ApiBearerAuth('access-token')
@ProblemResponses()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiIdempotencyKey()
  @UseInterceptors(IdempotencyInterceptor)
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
    return this.commandBus.execute(
      new CreateCategoryCommand(createCategoryDto, req.user.userId),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
  })
  findAll(@Request() req) {
    return this.queryBus.execute(new GetCategoriesQuery(req.user.userId));
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
    return this.queryBus.execute(new GetCategoryQuery(id, req.user.userId));
  }

  @Patch(':id')
  @ApiIfMatch()
  @ApiOperation({ summary: 'Update a category' })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully.',
    headers: {
      ETag: {
        description: 'Current category version.',
        schema: {
          type: 'string',
          example: '"2"',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid If-Match header.',
  })
  @ApiResponse({
    status: 404,
    description: 'Category not found.',
  })
  @ApiResponse({
    status: 409,
    description: 'Category has been modified since it was retrieved.',
  })
  @ApiResponse({
    status: 428,
    description: 'If-Match header is required.',
  })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Request() req,
    @Res({ passthrough: true }) response: Response,
  ) {
    const expectedVersion = parseIfMatch(req.headers['if-match']);

    return this.commandBus
      .execute(
        new UpdateCategoryCommand(
          id,
          updateCategoryDto,
          req.user.userId,
          expectedVersion,
        ),
      )
      .then((category) => {
        response.setHeader('ETag', `"${category.__v}"`);
        return category;
      });
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
    return this.commandBus.execute(
      new DeleteCategoryCommand(id, req.user.userId),
    );
  }
}
