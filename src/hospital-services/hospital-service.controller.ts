import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../users/schemas/user.schema';
import { CreateHospitalServiceDto } from './dto/create-hospital-service.dto';
import { UpdateHospitalServiceDto } from './dto/update-hospital-service.dto';
import { HospitalServiceStatus } from './schemas/hospital-service.schema';
import { HospitalServiceService } from './hospital-service.service';

@ApiTags('Hospital Services')
@Controller('hospital-services')
export class HospitalServiceController {
  constructor(private readonly service: HospitalServiceService) {}

  @Get()
  @ApiOperation({ summary: 'List published hospital services' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(@Query('page', new ParseIntPipe({ optional: true })) page = 1, @Query('limit', new ParseIntPipe({ optional: true })) limit = 20) {
    return this.service.list(Math.max(page, 1), Math.min(Math.max(limit, 1), 100));
  }

  @Get('internal/list')
  @ApiOperation({ summary: 'List hospital services for administration' })
  @ApiQuery({ name: 'status', required: false, enum: HospitalServiceStatus })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  listInternal(
    @Query('status') status?: HospitalServiceStatus,
    @Query('department') department?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.service.listInternal(
      Math.max(page, 1),
      Math.min(Math.max(limit, 1), 100),
      status,
      department,
    );
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published hospital service by slug' })
  get(@Param('slug') slug: string) {
    return this.service.get(slug);
  }

  @Post()
  @ApiOperation({ summary: 'Create a hospital service draft' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateHospitalServiceDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a hospital service' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateHospitalServiceDto) {
    return this.service.update(user, id, dto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a hospital service' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.publish(user, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a hospital service' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.archive(user, id);
  }
}
