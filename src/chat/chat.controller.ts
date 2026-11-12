import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AppointmentChatActionDto, AppointmentSlotOptionsDto, RescheduleAppointmentChatDto } from './dto/appointment-chat-action.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Daftar percakapan milik pengguna atau pasien yang ditugaskan' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<unknown[]> {
    return this.chatService.listConversations(user);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Buat atau buka percakapan dengan AI atau tim layanan' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(user, dto);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Riwayat pesan percakapan' })
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
  ) {
    return this.chatService.listMessages(user, id, limit);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Kirim pesan ke tim layanan atau AI pendamping' })
  send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(user, id, dto);
  }

  @Post('conversations/:id/appointment-actions/confirm')
  @ApiOperation({ summary: 'Konfirmasi kehadiran appointment ANC dari kartu chat' })
  confirmAppointment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AppointmentChatActionDto) {
    return this.chatService.confirmAppointmentFromChat(user, id, dto);
  }

  @Post('conversations/:id/appointment-actions/reschedule-options')
  @ApiOperation({ summary: 'Cari slot konsultasi dokter dari Google Sheets' })
  rescheduleOptions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AppointmentSlotOptionsDto) {
    return this.chatService.getAppointmentSlotOptions(user, id, dto);
  }

  @Post('conversations/:id/appointment-actions/reschedule')
  @ApiOperation({ summary: 'Pilih slot dan jadwalkan ulang appointment ANC' })
  rescheduleAppointment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RescheduleAppointmentChatDto) {
    return this.chatService.rescheduleAppointmentFromChat(user, id, dto);
  }
}
