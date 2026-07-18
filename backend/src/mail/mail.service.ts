import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Thin wrapper around nodemailer.
 *
 * SMTP is OPTIONAL: if it isn't configured the service degrades gracefully —
 * it logs the message (including the OTP) so the reset flow still works in
 * local/dev without a mail server. Configure SMTP_* in .env for real delivery.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly from: string;
  private readonly appName = 'CardPro';

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.from =
      this.config.get<string>('MAIL_FROM') ??
      (user ? `${this.appName} <${user}>` : `${this.appName} <no-reply@cardpro.local>`);

    if (host && user && pass) {
      const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        // 465 → implicit TLS; otherwise STARTTLS is negotiated on 587.
        secure: this.config.get<string>('SMTP_SECURE') === 'true' || port === 465,
        auth: { user, pass },
      });
      this.logger.log(`SMTP configured (${host}:${port})`);
    } else {
      this.logger.warn(
        'SMTP not configured — emails will be logged to console instead of sent. ' +
          'Set SMTP_HOST / SMTP_USER / SMTP_PASS to enable real delivery.',
      );
    }
  }

  /** Send the password-reset one-time code. */
  async sendPasswordResetOtp(to: string, name: string, otp: string, ttlMinutes: number): Promise<void> {
    const subject = `${this.appName} — Mã đặt lại mật khẩu`;
    const html = this.passwordResetTemplate(name, otp, ttlMinutes);
    const text =
      `Xin chào ${name || ''},\n\n` +
      `Mã đặt lại mật khẩu của bạn là: ${otp}\n` +
      `Mã có hiệu lực trong ${ttlMinutes} phút.\n\n` +
      `Nếu bạn không yêu cầu, hãy bỏ qua email này.`;

    if (!this.transporter) {
      this.logger.warn(`[DEV] Password reset OTP for ${to}: ${otp} (valid ${ttlMinutes}m)`);
      return;
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, text });
      this.logger.log(`Password reset OTP sent to ${to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send reset OTP to ${to}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  /** Send the email-verification one-time code for a new sign-up. */
  async sendEmailVerificationOtp(to: string, name: string, otp: string, ttlMinutes: number): Promise<void> {
    const subject = `${this.appName} — Mã xác minh email`;
    const html = this.otpTemplate({
      name,
      otp,
      ttlMinutes,
      heading: 'Xác minh email',
      intro: 'Cảm ơn bạn đã đăng ký! Dùng mã dưới đây để xác minh email và hoàn tất tạo tài khoản.',
      ignoreNote: 'Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.',
    });
    const text =
      `Xin chào ${name || ''},\n\n` +
      `Mã xác minh email của bạn là: ${otp}\n` +
      `Mã có hiệu lực trong ${ttlMinutes} phút.\n\n` +
      `Nếu bạn không đăng ký, hãy bỏ qua email này.`;

    if (!this.transporter) {
      this.logger.warn(`[DEV] Email verification OTP for ${to}: ${otp} (valid ${ttlMinutes}m)`);
      return;
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, text });
      this.logger.log(`Email verification OTP sent to ${to}`);
    } catch (err) {
      this.logger.error(
        `Failed to send verification OTP to ${to}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  private passwordResetTemplate(name: string, otp: string, ttlMinutes: number): string {
    return this.otpTemplate({
      name,
      otp,
      ttlMinutes,
      heading: 'Đặt lại mật khẩu',
      intro: 'Dùng mã xác thực dưới đây để đặt lại mật khẩu cho tài khoản của bạn.',
      ignoreNote: 'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — tài khoản của bạn vẫn an toàn.',
    });
  }

  /** Clean, table-based responsive HTML — renders reliably across mail clients. */
  private otpTemplate(opts: {
    name: string;
    otp: string;
    ttlMinutes: number;
    heading: string;
    intro: string;
    ignoreNote: string;
  }): string {
    const { name, otp, ttlMinutes, heading, intro, ignoreNote } = opts;
    const brand = '#1677ff';
    const greeting = name ? `Xin chào ${this.escape(name)},` : 'Xin chào,';
    return `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- header -->
        <tr><td style="background:linear-gradient(135deg,${brand} 0%,#0b4bd4 100%);padding:28px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:40px;height:40px;background:rgba(255,255,255,0.18);border-radius:10px;text-align:center;vertical-align:middle;font-size:20px;">💳</td>
            <td style="padding-left:12px;color:#ffffff;font-size:20px;font-weight:700;">${this.appName}</td>
          </tr></table>
        </td></tr>
        <!-- body -->
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${this.escape(heading)}</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
            ${greeting}<br>${this.escape(intro)}
          </p>
          <div style="text-align:center;margin:24px 0;">
            <div style="display:inline-block;background:#f0f5ff;border:1px solid #d6e4ff;border-radius:12px;padding:16px 28px;">
              <span style="font-size:34px;font-weight:700;letter-spacing:10px;color:${brand};font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;">${this.escape(otp)}</span>
            </div>
          </div>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">
            Mã có hiệu lực trong <strong>${ttlMinutes} phút</strong>.
          </p>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#9ca3af;border-top:1px solid #f0f0f0;padding-top:16px;">
            ${this.escape(ignoreNote)}
          </p>
        </td></tr>
      </table>
      <p style="max-width:480px;margin:16px auto 0;font-size:12px;color:#9ca3af;text-align:center;">
        © ${this.appName}. Email tự động, vui lòng không trả lời.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private escape(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
    );
  }
}
