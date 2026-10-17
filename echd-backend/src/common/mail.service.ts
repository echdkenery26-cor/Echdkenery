import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface MailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

/**
 * Envoi d'e-mails. Trois modes, choisis selon les variables d'environnement :
 *  1. BREVO_API_KEY  → API HTTPS de Brevo (fonctionne là où le SMTP sortant est bloqué, ex. Render Free)
 *  2. SMTP_HOST      → SMTP classique (Gmail, OVH, etc.)
 *  3. rien           → simulation : les messages sont seulement écrits dans les logs
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private transporter: nodemailer.Transporter | null = null;
  private readonly brevoKey = (process.env.BREVO_API_KEY || '').trim();

  constructor() {
    if (this.brevoKey) {
      this.logger.log('Envoi des e-mails : API Brevo (HTTPS)');
    } else if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        // Évite de bloquer la requête pendant 2 minutes si le port SMTP est filtré
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
      this.logger.log(`Envoi des e-mails : SMTP ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}`);
    } else {
      this.logger.warn('E-mail non configuré : les e-mails sont uniquement journalisés (mode simulation).');
    }
  }

  get enabled() {
    return !!this.transporter || !!this.brevoKey;
  }

  /** Retourne true si le message est parti (ou simulé). N'échoue jamais bruyamment. */
  async send(input: MailInput): Promise<boolean> {
    const to = (Array.isArray(input.to) ? input.to : [input.to]).filter(Boolean);
    if (!to.length) return false;
    if (!this.enabled) {
      this.logger.log(`[SIMULATION] À: ${to.join(', ')} | Objet: ${input.subject}\n${input.text}`);
      return true;
    }
    try {
      if (this.brevoKey) await this.sendBrevo(to, input);
      else await this.sendSmtp(to, input);
      return true;
    } catch (e) {
      this.logger.error(`Envoi e-mail échoué (${input.subject}) : ${(e as Error).message}`);
      return false;
    }
  }

  private async sendSmtp(to: string[], input: MailInput) {
    await this.transporter!.sendMail({
      from: process.env.MAIL_FROM || 'ECHD <no-reply@localhost>',
      to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? this.wrap(input.subject, input.text),
    });
  }

  private async sendBrevo(to: string[], input: MailInput) {
    const sender = this.parseFrom(process.env.MAIL_FROM || '');
    if (!sender.email) throw new Error('MAIL_FROM manquant : indique une adresse expéditrice validée chez Brevo');
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': this.brevoKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender,
        to: to.map((email) => ({ email })),
        subject: input.subject,
        textContent: input.text,
        htmlContent: input.html ?? this.wrap(input.subject, input.text),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Brevo HTTP ${res.status} ${body.slice(0, 300)}`);
    }
  }

  /** "ECHD <adresse@exemple.org>" → { name, email } */
  private parseFrom(raw: string): { name?: string; email: string } {
    const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    if (m) return { name: m[1].trim() || undefined, email: m[2].trim() };
    return { email: raw.trim() };
  }

  private wrap(title: string, text: string) {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#122B23">
<h2 style="color:#1F4A3A;border-bottom:3px solid #CFAE55;padding-bottom:8px">${esc(title)}</h2>
<div style="white-space:pre-line;line-height:1.6">${esc(text)}</div></div>`;
  }
}
