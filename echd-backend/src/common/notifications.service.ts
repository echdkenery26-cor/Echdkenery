import { Injectable } from '@nestjs/common';
import { NotificationType, Role } from '@prisma/client';
import { PrismaService } from './prisma.service';

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
  constructor(private prisma: PrismaService) {}

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
    return res.count;
  }
}
