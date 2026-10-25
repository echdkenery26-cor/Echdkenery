//echd-backend/src/common/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { NotificationType, Role } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { PushService } from './push.service';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  /** Même clé = une seule notification par utilisateur (évite les doublons des tâches planifiées). */
  dedupeKey?: string;
  roles?: Role[];
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  /** Crée la notification pour chaque compte actif concerné (ADMIN + MANAGER par défaut). */
  async notifyStaff(n: NotifyInput): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: { active: true, role: { in: n.roles ?? [Role.ADMIN, Role.MANAGER] } },
      select: { id: true },
    });
    if (!users.length) return 0;
    const res = await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: n.type,
        title: n.title,
        body: n.body,
        entityType: n.entityType,
        entityId: n.entityId,
        dedupeKey: n.dedupeKey,
      })),
      skipDuplicates: true,
    });
    // Push seulement si de nouvelles notifications ont réellement été créées (pas pour les doublons des tâches planifiées)
    if (res.count > 0 && this.push.enabled) {
      void this.push
        .sendToUsers(users.map((u) => u.id), { title: n.title, body: n.body, path: this.pathFor(n), tag: n.dedupeKey ?? n.type })
        .catch(() => undefined);
    }
    return res.count;
  }

  /** Page à ouvrir quand on touche la notification. */
  private pathFor(n: NotifyInput): string {
    if (n.entityType === 'Student' && n.entityId) return `/admin/students/${n.entityId}`;
    if (n.entityType === 'Class' && n.entityId) return `/admin/classes/${n.entityId}`;
    if (n.entityType === 'PreRegistration') return '/admin/pre-registrations';
    return '/admin';
  }
}
