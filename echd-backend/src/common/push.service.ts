//echd-backend/src/common/push.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from './prisma.service';

export interface PushPayload {
  title: string;
  body?: string;
  /** Chemin à ouvrir au clic (ex. /admin/students/…) — la langue de l'utilisateur est ajoutée devant */
  path?: string;
  tag?: string;
}

/**
 * Notifications push (navigateur / application installée) pour l'équipe.
 * Active seulement si VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY sont définies :
 *   npx web-push generate-vapid-keys
 * Sans clés, tout reste silencieux : le centre de notifications (cloche) fonctionne comme avant.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');
  private readonly publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  private readonly ready: boolean;

  constructor(private prisma: PrismaService) {
    const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
    this.ready = !!(this.publicKey && priv);
    if (this.ready) {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${process.env.MAIL_FROM_ADDRESS || 'contact@example.org'}`, this.publicKey, priv);
      this.logger.log('Notifications push activées');
    }
  }

  get enabled() {
    return this.ready;
  }

  getPublicKey() {
    return this.ready ? this.publicKey : null;
  }

  async subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
    // Un même appareil ne doit appartenir qu'à un seul compte à la fois
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 250) },
      create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 250) },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  async count(userId: string) {
    return this.prisma.pushSubscription.count({ where: { userId } });
  }

  /** Envoie à tous les appareils des utilisateurs donnés. N'échoue jamais : les erreurs sont journalisées. */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
    if (!this.ready || !userIds.length) return 0;
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
      include: { user: { select: { language: true } } },
    });
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        const lang = s.user.language === 'ar' ? 'ar' : 'fr';
        const body = JSON.stringify({
          title: payload.title,
          body: payload.body ?? '',
          url: `/${lang}${payload.path ?? '/admin'}`,
          tag: payload.tag,
        });
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 24 * 3600 });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            // appareil désinscrit côté navigateur : on nettoie
            await this.prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } }).catch(() => undefined);
          } else {
            this.logger.warn(`Envoi push impossible (${code ?? 'réseau'}) : ${(e as Error).message}`);
          }
        }
      }),
    );
    return sent;
  }
}
