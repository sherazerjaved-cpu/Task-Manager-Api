import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ActivityService } from './activity.service';
import { RolesGuard } from 'src/auth/guards/roles.guards';
import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Activity')
@ApiBearerAuth()
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

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
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMyActivity(@Req() req: any) {
    return this.activityService.findByUser(req.user.userId);
  }

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
  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  getAllActivity() {
    return this.activityService.findAll();
  }
}
