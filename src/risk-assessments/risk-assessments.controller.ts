import { Body, Controller, Get, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../users/schemas/user.schema';
import { AssessRiskDto } from './dto/assess-risk.dto';
import { RiskAssessmentsService } from './risk-assessments.service';

@ApiTags('Risk assessments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Roles(Role.DOCTOR, Role.MIDWIFE, Role.ADMIN)
@Controller('risk-assessments')
export class RiskAssessmentsController {
  constructor(private readonly riskService: RiskAssessmentsService) {}

  @Post('evaluate')
  @ApiOperation({ summary: 'Skrining risiko maternal dari tekanan darah, protein urine, dan tanda bahaya' })
  assess(@CurrentUser() user: AuthenticatedUser, @Body() dto: AssessRiskDto) {
    return this.riskService.assess(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Riwayat hasil skrining untuk pasien yang ditugaskan' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('patientId') patientId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.riskService.listForPatient(user, patientId, limit);
  }
}
