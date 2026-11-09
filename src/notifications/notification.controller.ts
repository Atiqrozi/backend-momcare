import { Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications visible to the authenticated user' })
  @ApiResponse({ status: 200, description: 'Paginated notification list' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
    @Query('status') status?: import('./schemas/notification.schema').NotificationStatus,
    @Query('patientId') patientId?: string,
    @Query('appointmentId') appointmentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.notificationService.list(
      user,
      Math.max(page, 1),
      Math.min(Math.max(limit, 1), 100),
      status,
      patientId,
      appointmentId,
      from,
      to,
    );
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed notification within the actor scope' })
  @ApiResponse({ status: 200, description: 'Notification retry processed' })
  @ApiResponse({ status: 403, description: 'Notification is outside the actor scope' })
  @ApiResponse({ status: 409, description: 'Retry limit or status conflict' })
  retry(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationService.retry(user, id);
  }
}
