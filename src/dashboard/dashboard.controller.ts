import {
  Body,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../users/schemas/user.schema';
import { AncAppointmentStatus } from '../pregnancy/schemas/anc-appointment.schema';
import { DashboardService, type LaborBagResponse } from './dashboard.service';
import { UpsertLaborBagDto } from './dto/upsert-labor-bag.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.DOCTOR, Role.MIDWIFE, Role.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get provider dashboard summary' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601 start date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601 end date' })
  @ApiQuery({ name: 'providerId', required: false, description: 'Provider scope filter' })
  @ApiQuery({ name: 'facilityId', required: false, description: 'Facility scope filter' })
  @ApiResponse({ status: 200, description: 'Dashboard summary' })
  summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('providerId') providerId?: string,
    @Query('facilityId') facilityId?: string,
  ) {
    return this.dashboardService.summary(user, from, to, providerId, facilityId);
  }

  @Get('appointments')
  @ApiOperation({ summary: 'List appointments in provider scope' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601 start date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601 end date' })
  @ApiQuery({ name: 'status', required: false, enum: AncAppointmentStatus })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'providerId', required: false })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated appointment list' })
  appointments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: AncAppointmentStatus,
    @Query('patientId') patientId?: string,
    @Query('providerId') providerId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.dashboardService.appointments(
      user,
      from,
      to,
      status,
      patientId,
      providerId,
      facilityId,
      Math.max(page, 1),
      Math.min(Math.max(limit, 1), 100),
    );
  }

  @Get('missed-appointments')
  @ApiOperation({ summary: 'List missed appointments requiring follow-up' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601 start date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601 end date' })
  @ApiQuery({ name: 'providerId', required: false })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  missedAppointments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('providerId') providerId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.dashboardService.missedAppointments(
      user,
      from,
      to,
      providerId,
      facilityId,
      Math.max(page, 1),
      Math.min(Math.max(limit, 1), 100),
    );
  }

  @Get('patients')
  @ApiOperation({ summary: 'List patients in provider scope' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'pregnancyStatus', required: false })
  @ApiQuery({ name: 'providerId', required: false })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  patients(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('pregnancyStatus') pregnancyStatus?: string,
    @Query('providerId') providerId?: string,
    @Query('facilityId') facilityId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ): Promise<unknown> {
    return this.dashboardService.patients(
      user,
      search,
      pregnancyStatus,
      providerId,
      facilityId,
      Math.max(page, 1),
      Math.min(Math.max(limit, 1), 100),
    );
  }

  @Get('patients/:patientId')
  @ApiOperation({ summary: 'Get a patient dashboard summary' })
  @ApiResponse({ status: 200, description: 'Patient dashboard details' })
  patientDetail(@CurrentUser() user: AuthenticatedUser, @Param('patientId') patientId: string) {
    return this.dashboardService.patientDetail(user, patientId);
  }

  @Get('patients/:patientId/providers')
  @ApiOperation({ summary: 'List providers assigned to a patient' })
  patientProviders(@CurrentUser() user: AuthenticatedUser, @Param('patientId') patientId: string) {
    return this.dashboardService.patientProviders(user, patientId);
  }

  @Get('labor-bag')
  laborBag(@CurrentUser() user: AuthenticatedUser): Promise<LaborBagResponse> {
    return this.dashboardService.laborBag(user);
  }

  @Post('labor-bag')
  upsertLaborBag(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertLaborBagDto) {
    return this.dashboardService.upsertLaborBag(user, dto);
  }

  @Delete('labor-bag/:patientId')
  removeLaborBag(@CurrentUser() user: AuthenticatedUser, @Param('patientId') patientId: string) {
    return this.dashboardService.removeLaborBag(user, patientId);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List audit logs for administrators' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resourceType', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  auditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.dashboardService.auditLogs(
      user,
      action,
      resourceType,
      from,
      to,
      Math.max(page, 1),
      Math.min(Math.max(limit, 1), 100),
    );
  }
}
