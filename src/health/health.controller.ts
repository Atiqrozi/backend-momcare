import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({ summary: 'Check API liveness' })
  @ApiResponse({ status: 200, description: 'Application is running' })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check API and database readiness' })
  @ApiResponse({ status: 200, description: 'Application and database are ready' })
  @ApiResponse({ status: 503, description: 'Application dependencies are not ready' })
  ready() {
    if (this.connection.readyState !== 1) {
      throw new ServiceUnavailableException('Database belum siap');
    }
    return { status: 'ready', database: 'connected', timestamp: new Date().toISOString() };
  }
}
