import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { User, UserDocument } from './schemas/user.schema';
import { PasswordReset, PasswordResetDocument } from './schemas/password-reset.schema';
import {
  PendingRegistration,
  PendingRegistrationDocument,
} from './schemas/pending-registration.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../mail/mail.service';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

/** Returned by register(): the account isn't created until the email is verified. */
export interface PendingVerification {
  requiresVerification: true;
  email: string;
}

const BCRYPT_ROUNDS = 10;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PasswordReset.name)
    private resetModel: Model<PasswordResetDocument>,
    @InjectModel(PendingRegistration.name)
    private pendingModel: Model<PendingRegistrationDocument>,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
  ) {}

  /**
   * Step 1 of sign-up: park the details in a pending collection and email an OTP.
   * The real User is NOT created yet — so the email stays free until it's verified.
   */
  async register(dto: RegisterDto): Promise<PendingVerification> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.pendingModel
      .updateOne(
        { email },
        { $set: { email, name: dto.name.trim(), passwordHash, codeHash, expiresAt, attempts: 0 } },
        { upsert: true },
      )
      .exec();

    await this.mailService.sendEmailVerificationOtp(email, dto.name.trim(), otp, OTP_TTL_MINUTES);
    this.logger.log(`Registration pending email verification: ${email}`);
    return { requiresVerification: true, email };
  }

  /**
   * Step 2 of sign-up: verify the OTP, then actually create the account and log in.
   */
  async verifyRegistration(rawEmail: string, otp: string): Promise<AuthResult> {
    const email = rawEmail.toLowerCase().trim();
    const pending = await this.pendingModel.findOne({ email }).exec();

    if (!pending || pending.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Mã không hợp lệ hoặc đã hết hạn');
    }

    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      await this.pendingModel.deleteOne({ email }).exec();
      throw new BadRequestException('Bạn đã nhập sai quá nhiều lần. Vui lòng đăng ký lại.');
    }

    const valid = await bcrypt.compare(otp, pending.codeHash);
    if (!valid) {
      await this.pendingModel.updateOne({ email }, { $inc: { attempts: 1 } }).exec();
      throw new BadRequestException('Mã xác thực không đúng');
    }

    // Guard against a race: someone may have registered this email meanwhile.
    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      await this.pendingModel.deleteOne({ email }).exec();
      throw new ConflictException('Email đã được sử dụng');
    }

    const user = await this.userModel.create({
      email,
      name: pending.name,
      passwordHash: pending.passwordHash,
    });
    await this.pendingModel.deleteOne({ email }).exec();

    this.logger.log(`New user registered (email verified): ${email}`);
    return this.issueTokens(user);
  }

  /** Re-issue a fresh verification OTP for a pending sign-up. */
  async resendRegistrationOtp(rawEmail: string): Promise<void> {
    const email = rawEmail.toLowerCase().trim();
    const pending = await this.pendingModel.findOne({ email }).exec();
    if (!pending) {
      // Nothing pending (expired or never started) — stay quiet, same as forgot-password.
      this.logger.log(`Resend verification requested with no pending sign-up: ${email}`);
      return;
    }

    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await this.pendingModel
      .updateOne({ email }, { $set: { codeHash, expiresAt, attempts: 0 } })
      .exec();

    await this.mailService.sendEmailVerificationOtp(email, pending.name, otp, OTP_TTL_MINUTES);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userModel
      .findOne({ email })
      .select('+passwordHash')
      .exec();

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // OAuth-only account (created via Google) has no password.
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Tài khoản này đăng nhập bằng Google. Vui lòng dùng "Đăng nhập với Google".',
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    return this.issueTokens(user);
  }

  /**
   * Sign in (or sign up) with a Google ID token from Google Identity Services.
   * Verifies the token against our OAuth client id, then finds-or-creates the user
   * by email (linking googleId to an existing email/password account if needed).
   */
  async googleLogin(idToken: string): Promise<AuthResult> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException('Đăng nhập Google chưa được cấu hình');
    }

    let payload: import('google-auth-library').TokenPayload | undefined;
    try {
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Google token không hợp lệ');
    }

    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Email Google chưa được xác minh');
    }

    const email = payload.email.toLowerCase().trim();
    const googleId = payload.sub;
    const name = payload.name?.trim() || email.split('@')[0];
    const avatarUrl = payload.picture;

    let user = await this.userModel.findOne({ email }).exec();
    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedException('Tài khoản đã bị vô hiệu hoá');
      }
      // Link the Google identity to the existing account if not already linked.
      if (user.googleId !== googleId || (avatarUrl && user.avatarUrl !== avatarUrl)) {
        await this.userModel
          .updateOne({ _id: user._id }, { $set: { googleId, ...(avatarUrl ? { avatarUrl } : {}) } })
          .exec();
      }
    } else {
      user = await this.userModel.create({ email, name, googleId, avatarUrl });
      this.logger.log(`New user via Google: ${email}`);
    }

    return this.issueTokens(user);
  }

  /** Validate refresh token against the stored hash, then rotate (issue a fresh pair). */
  async refresh(userId: string, refreshToken: string): Promise<AuthResult> {
    const user = await this.userModel
      .findById(userId)
      .select('+refreshTokenHash')
      .exec();

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { $unset: { refreshTokenHash: 1 } })
      .exec();
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.userModel.findById(userId).exec();
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    return this.toPublicUser(user);
  }

  /**
   * Start a password reset: generate a 6-digit OTP, email it, and store only its
   * hash (upsert — a new request replaces any prior code).
   *
   * By product choice we tell the caller when the email isn't registered (clearer UX),
   * instead of the anti-enumeration "always succeed" pattern. Edge cases handled:
   *   - no account            → 404 "Email chưa được đăng ký"
   *   - account deactivated   → 403 "Tài khoản đã bị vô hiệu hoá"
   *   - email delivery fails  → 502 so the user knows to retry (no silent success)
   */
  async requestPasswordReset(rawEmail: string): Promise<void> {
    const email = rawEmail.toLowerCase().trim();
    const user = await this.userModel.findOne({ email }).exec();

    if (!user) {
      throw new NotFoundException('Email chưa được đăng ký');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hoá, vui lòng liên hệ hỗ trợ');
    }

    // 6-digit code, 000000–999999. crypto.randomInt is cryptographically secure.
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.resetModel
      .updateOne(
        { email },
        { $set: { email, codeHash, expiresAt, attempts: 0 } },
        { upsert: true },
      )
      .exec();

    try {
      await this.mailService.sendPasswordResetOtp(email, user.name, otp, OTP_TTL_MINUTES);
    } catch {
      // Roll back the stored code so a later attempt starts clean, and surface the failure.
      await this.resetModel.deleteOne({ email }).exec();
      throw new ServiceUnavailableException('Không gửi được email, vui lòng thử lại sau');
    }
  }

  /**
   * Complete a password reset. Verifies the OTP (hash compare, expiry, attempt cap),
   * sets the new password, revokes existing sessions, and burns the reset request.
   */
  async resetPassword(rawEmail: string, otp: string, newPassword: string): Promise<void> {
    const email = rawEmail.toLowerCase().trim();
    const reset = await this.resetModel.findOne({ email }).exec();

    if (!reset || reset.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Mã không hợp lệ hoặc đã hết hạn');
    }

    if (reset.attempts >= OTP_MAX_ATTEMPTS) {
      await this.resetModel.deleteOne({ email }).exec();
      throw new BadRequestException('Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.');
    }

    const valid = await bcrypt.compare(otp, reset.codeHash);
    if (!valid) {
      await this.resetModel.updateOne({ email }, { $inc: { attempts: 1 } }).exec();
      throw new BadRequestException('Mã xác thực không đúng');
    }

    const user = await this.userModel.findOne({ email }).exec();
    if (!user || !user.isActive) {
      await this.resetModel.deleteOne({ email }).exec();
      throw new BadRequestException('Mã không hợp lệ hoặc đã hết hạn');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    // Set the new password AND revoke any active session (force re-login everywhere).
    await this.userModel
      .updateOne({ _id: user._id }, { $set: { passwordHash }, $unset: { refreshTokenHash: 1 } })
      .exec();
    await this.resetModel.deleteOne({ email }).exec();

    this.logger.log(`Password reset completed for ${email}`);
  }

  /** Sign access + refresh tokens and persist the refresh-token hash for rotation. */
  private async issueTokens(user: UserDocument): Promise<AuthResult> {
    const id = String(user._id);
    const payload = { sub: id, email: user.email };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m',
    } as JwtSignOptions);

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d',
    } as JwtSignOptions);

    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
    await this.userModel
      .updateOne({ _id: id }, { $set: { refreshTokenHash } })
      .exec();

    return { user: this.toPublicUser(user), accessToken, refreshToken };
  }

  private toPublicUser(user: UserDocument): PublicUser {
    return { id: String(user._id), email: user.email, name: user.name };
  }
}
