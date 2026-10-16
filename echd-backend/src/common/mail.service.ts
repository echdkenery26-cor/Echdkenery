import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface MailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
    } else {
      this.logger.warn('SMTP non configuré : les e-mails sont uniquement journalisés (mode simulation).');
    }
  }

  get enabled() {
    return !!this.transporter;
  }

  /** Retourne true si le message est parti (ou simulé). N'échoue jamais bruyamment. */
  async send(input: MailInput): Promise<boolean> {
    const to = Array.isArray(input.to) ? input.to.filter(Boolean) : [input.to];
    if (!to.length) return false;
    if (!this.transporter) {
      this.logger.log(`[SIMULATION] À: ${to.join(', ')} | Objet: ${input.subject}\n${input.text}`);
      return true;
    }
    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || 'ECHD <no-reply@localhost>',
        to,
        subject: input.subject,
        text: input.text,
        html: input.html ?? this.wrap(input.subject, input.text),
      });
      return true;
    } catch (e) {
      this.logger.error(`Envoi e-mail échoué (${input.subject}) : ${(e as Error).message}`);
      return false;
    }
  }

  private wrap(title: string, text: string) {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#122B23">
<h2 style="color:#1F4A3A;border-bottom:3px solid #CFAE55;padding-bottom:8px">${esc(title)}</h2>
<div style="white-space:pre-line;line-height:1.6">${esc(text)}</div></div>`;
  }
}
