import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role, AccountStatus } from './schemas/user.schema';
import { UsersService } from './users.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { AssignProviderDto } from './dto/assign-provider.dto';
import { AssignFacilityDto } from './dto/assign-facility.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users for administration' })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'status', required: false, enum: AccountStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(
    @Query('role') role?: Role,
    @Query('status') status?: AccountStatus,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.service.list(Math.max(page, 1), Math.min(Math.max(limit, 1), 100), role, status);
  }

  @Post('staff')
  @ApiOperation({ summary: 'Create a staff account' })
  @ApiResponse({ status: 201, description: 'Staff account created' })
  createStaff(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateStaffUserDto) {
    return this.service.createStaff(actor, dto);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List audit logs' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  auditLogs(
    @Query('action') action?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.service.listAuditLogs(
      Math.max(page, 1),
      Math.min(Math.max(limit, 1), 100),
      action,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user role or account status' })
  update(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateUserAdminDto) {
    return this.service.update(actor, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Disable a user account' })
  disable(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.service.disable(actor, id);
  }

  @Post('patients/:patientId/providers')
  @ApiOperation({ summary: 'Assign a provider to a patient' })
  assignProvider(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('patientId') patientId: string,
    @Body() dto: AssignProviderDto,
  ) {
    return this.service.assignProvider(actor, patientId, dto.providerId);
  }

  @Delete('patients/:patientId/providers/:providerId')
  @ApiOperation({ summary: 'Remove a provider assignment from a patient' })
  unassignProvider(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('patientId') patientId: string,
    @Param('providerId') providerId: string,
  ) {
    return this.service.unassignProvider(actor, patientId, providerId);
  }

  @Patch('patients/:patientId/facility')
  @ApiOperation({ summary: 'Assign a facility to a patient' })
  assignFacility(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('patientId') patientId: string,
    @Body() dto: AssignFacilityDto,
  ) {
    return this.service.assignFacility(actor, patientId, dto.facilityId);
  }
}
