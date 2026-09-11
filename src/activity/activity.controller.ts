import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guards';
import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';

import { GetUserActivitiesQuery } from './application/queries/get-user-activities/get-user-activities.query';
import { GetAllActivitiesQuery } from './application/queries/get-all-activities/get-all-activities.query';

import { ProblemResponses } from 'src/common/http/problem-responses.decorator';

@ApiTags('Activity')
@ApiBearerAuth('access-token')
@ProblemResponses()
@Controller({
  path: 'activity',
  version: '1',
})
export class ActivityController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Get current user activity',
    description: 'Returns the activity log for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Activity retrieved successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  getMyActivity(@Req() req: any) {
    return this.queryBus.execute(new GetUserActivitiesQuery(req.user.userId));
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Get all activity logs',
    description: 'Returns all activity logs. Admin access only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Activity logs retrieved successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Admin access required.',
  })
  getAllActivity() {
    return this.queryBus.execute(new GetAllActivitiesQuery());
  }
}
