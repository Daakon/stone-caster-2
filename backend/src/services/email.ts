/**
 * Email Service
 * Phase B5: Stub email service for access request notifications
 * Wire to Resend/SES/Postmark later
 */

export type EmailTemplate = 'access_approved' | 'access_denied';

export interface EmailService {
  send(to: string, template: EmailTemplate, vars: Record<string, string>): Promise<void>;
}

/**
 * Stub email service implementation
 * TODO: Wire to actual email provider (Resend/SES/Postmark)
 */
class StubEmailService implements EmailService {
  async send(to: string, template: EmailTemplate, vars: Record<string, string>): Promise<void> {
    // Log for now; replace with actual email sending
    console.log(`[EmailService] Would send ${template} to ${to}`, vars);
    // In production, this would call:
    // - Resend API
    // - AWS SES
    // - Postmark API
    // etc.
  }
}

export const emailService: EmailService = new StubEmailService();

