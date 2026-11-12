import { BadGatewayException, BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../users/schemas/user.schema';
import { CreateEducationDto } from './dto/create-education.dto';
import { ReviewNoteDto } from './dto/review-note.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { PublishEducationDto } from './dto/publish-education.dto';
import { EducationContentStatus } from './schemas/education-content.schema';
import { EducationService } from './education.service';
import { UploadEducationImageDto } from './dto/upload-education-image.dto';

@ApiTags('Education')
@Controller('education')
export class EducationController {
  constructor(private readonly service: EducationService, private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'List published maternal education content' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(@Query('category') category?: string, @Query('page', new ParseIntPipe({ optional: true })) page = 1, @Query('limit', new ParseIntPipe({ optional: true })) limit = 20) {
    return this.service.listPublished(Math.max(page, 1), Math.min(Math.max(limit, 1), 100), category);
  }

  @Get('internal/list')
  @ApiOperation({ summary: 'List education content for editorial workflow' })
  @ApiQuery({ name: 'status', required: false, enum: EducationContentStatus })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CONTENT_EDITOR, Role.CLINICAL_REVIEWER, Role.DOCTOR, Role.ADMIN)
  listInternal(@Query('status') status?: EducationContentStatus, @Query('category') category?: string, @Query('page', new ParseIntPipe({ optional: true })) page = 1, @Query('limit', new ParseIntPipe({ optional: true })) limit = 20) {
    return this.service.listInternal(Math.max(page, 1), Math.min(Math.max(limit, 1), 100), status, category);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get published education content by slug' })
  get(@Param('slug') slug: string) {
    return this.service.getPublished(slug);
  }

  @Post('images')
  @ApiOperation({ summary: 'Upload an image for an education article' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CONTENT_EDITOR, Role.DOCTOR, Role.ADMIN)
  async uploadImage(@Body() dto: UploadEducationImageDto) {
    const { privateKey, urlEndpoint } = this.config.get<{ privateKey?: string; urlEndpoint?: string }>('imageKit', {});
    if (!privateKey || !urlEndpoint) throw new ServiceUnavailableException('ImageKit belum dikonfigurasi.');
    const match = dto.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match || match[1] !== dto.mimeType) throw new BadRequestException('Format gambar tidak sesuai.');
    const file = Buffer.from(match[2], 'base64');
    if (!file.length || file.length > 1_000_000) throw new BadRequestException('Ukuran gambar maksimal 1 MB.');
    const body = new FormData();
    body.append('file', new Blob([file], { type: dto.mimeType }), dto.name);
    body.append('fileName', `education-${Date.now()}-${dto.name}`);
    body.append('folder', '/moment-ai/education');
    body.append('isPrivateFile', 'false');
    let response: Response;
    try {
      response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}` },
        body,
      });
    } catch {
      throw new BadGatewayException('ImageKit tidak dapat dijangkau.');
    }
    const result = await response.json().catch(() => null) as { url?: string; fileId?: string } | null;
    if (!response.ok || !result?.url || !result.fileId) throw new BadGatewayException('Gambar gagal diunggah ke ImageKit.');
    return { name: dto.name, mimeType: dto.mimeType, url: result.url, fileId: result.fileId };
  }

  @Post()
  @ApiOperation({ summary: 'Create an education draft' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CONTENT_EDITOR, Role.DOCTOR, Role.ADMIN)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEducationDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an education draft' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CONTENT_EDITOR, Role.DOCTOR, Role.ADMIN)
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateEducationDto) {
    return this.service.update(user, id, dto);
  }

  @Post(':id/submit-review')
  @ApiOperation({ summary: 'Submit education content for clinical review' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CONTENT_EDITOR, Role.DOCTOR, Role.ADMIN)
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.submitReview(user, id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve education content' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLINICAL_REVIEWER, Role.DOCTOR)
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.approve(user, id);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish approved education content' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CONTENT_EDITOR, Role.DOCTOR, Role.ADMIN)
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: PublishEducationDto) {
    return this.service.publish(user, id, dto.sourceVersion);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject education content with a review note' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLINICAL_REVIEWER, Role.DOCTOR)
  reject(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReviewNoteDto) {
    return this.service.reject(user, id, dto.note);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive education content' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CONTENT_EDITOR, Role.CLINICAL_REVIEWER, Role.DOCTOR)
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.archive(user, id);
  }
}
