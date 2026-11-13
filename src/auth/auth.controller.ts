import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConsentDto } from './dto/consent.dto';
import { VerifyContactDto } from './dto/verify-contact.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { PhoneRegistrationVerificationDto, RegistrationVerificationDto, ResendRegistrationVerificationDto } from './dto/registration-verification.dto';
import { LogoutDto, RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a pregnant mother account' })
  @ApiResponse({ status: 201, description: 'Account registered successfully' })
  @ApiResponse({ status: 409, description: 'Email or consent conflict' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate and issue a JWT access token' })
  @ApiResponse({ status: 201, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('registration/verify-email')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify registration email using the emailed code' })
  verifyRegistrationEmail(@Body() dto: RegistrationVerificationDto) {
    return this.authService.confirmRegistrationEmail(dto.email, dto.code);
  }

  @Post('registration/verify-phone')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify registration phone using the WhatsApp code' })
  verifyRegistrationPhone(@Body() dto: PhoneRegistrationVerificationDto) {
    return this.authService.confirmRegistrationPhone(dto.phone, dto.code);
  }

  @Post('registration/resend-codes')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Resend pending registration verification codes' })
  resendRegistrationCodes(@Body() dto: ResendRegistrationVerificationDto) {
    return this.authService.resendRegistrationCodes(dto.email);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getPublicProfile(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.userId, dto);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change the authenticated user password' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto);
  }

  @Patch('consent')
  @ApiOperation({ summary: 'Grant or revoke data consent' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  updateConsent(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConsentDto) {
    return this.authService.updateConsent(user.userId, dto);
  }

  @Post('verify-email/request')
  @ApiOperation({ summary: 'Request an email verification token' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  requestEmailVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.requestEmailVerification(user.userId);
  }

  @Post('verify-email/confirm')
  @ApiOperation({ summary: 'Confirm an email verification token' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  verifyEmail(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyContactDto) {
    return this.authService.verifyEmail(user.userId, dto);
  }

  @Post('verify-phone/request')
  @ApiOperation({ summary: 'Request a phone verification token' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  requestPhoneVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.requestPhoneVerification(user.userId);
  }

  @Post('verify-phone/confirm')
  @ApiOperation({ summary: 'Confirm a phone verification token' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  verifyPhone(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyPhoneDto) {
    return this.authService.verifyPhone(user.userId, dto);
  }
}
