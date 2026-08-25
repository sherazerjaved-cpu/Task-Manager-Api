import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import { CreateExportDto } from '../dto/create-export.dto';
import { ExportService } from '../application/export.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guards';
import { PoliciesGuard } from 'src/common/authorization/policies.guard';
import { CheckPolicies } from 'src/common/authorization/check-policies.decorator';
import { ProblemResponses } from 'src/common/http/problem-responses.decorator';
import { createExportPolicy } from 'src/common/authorization/policies/create-export.policy';
import { readExportPolicy } from 'src/common/authorization/policies/read-export.policy';
import { downloadExportPolicy } from 'src/common/authorization/policies/download-export.policy';
import { IdempotencyInterceptor } from 'src/common/idempotency/idempotency.interceptor';
import { ApiIdempotencyKey } from 'src/common/http/api-headers.decorator';

@ApiTags('Exports')
@ApiBearerAuth('access-token')
@ProblemResponses()
@UseGuards(JwtAuthGuard)
@Controller({
  path: 'workspaces/:id/exports',
  version: '1',
})
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @ApiOperation({
    summary: 'Request a workspace export',
  })
  @ApiResponse({
    status: 201,
    description: 'Export requested successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not allowed to create exports.',
  })
  @Post()
  @ApiIdempotencyKey()
  @UseInterceptors(IdempotencyInterceptor)
  @UseGuards(PoliciesGuard)
  @CheckPolicies(createExportPolicy)
  async createExport(
    @Param('id') workspaceId: string,
    @Body() dto: CreateExportDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.userId;

    return this.exportService.requestExport({
      workspaceId,
      userId,
      format: dto.format,
    });
  }

  @ApiOperation({
    summary: 'Get export status',
  })
  @ApiResponse({
    status: 200,
    description: 'Export status retrieved successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not allowed to access this export.',
  })
  @ApiResponse({
    status: 404,
    description: 'Export not found.',
  })
  @Get(':exportId')
  @UseGuards(PoliciesGuard)
  @CheckPolicies(readExportPolicy)
  async getExport(
    @Param('id') workspaceId: string,
    @Param('exportId') exportId: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.userId;

    return this.exportService.getExport(exportId, workspaceId, userId);
  }

  @ApiOperation({
    summary: 'Download a completed export',
  })
  @ApiResponse({
    status: 200,
    description: 'Export downloaded successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired download token.',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not allowed to download this export.',
  })
  @ApiResponse({
    status: 404,
    description: 'Export not found.',
  })
  @Get(':exportId/download')
  @UseGuards(PoliciesGuard)
  @CheckPolicies(downloadExportPolicy)
  async downloadExport(
    @Param('id') workspaceId: string,
    @Param('exportId') exportId: string,
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const userId = (req as any).user.userId;

    const result = await this.exportService.downloadExport(
      exportId,
      workspaceId,
      userId,
      token,
    );

    return res.download(result.filePath, result.fileName);
  }
}
