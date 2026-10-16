import { Injectable, Logger } from '@nestjs/common';
import { AuthUser, userLabel } from './decorators';
import { PrismaService } from './prisma.service';
import { sanitizeForAudit } from './utils';

export type Actor = Pick<AuthUser, 'id' | 'firstName' | 'lastName' | 'username'> | null;

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private prisma: PrismaService) {}

  /** Écrit une ligne dans le journal. Ne fait jamais échouer l'action métier. */
  async log(
    actor: Actor,
    action: string,
    entity: string,
    entityId?: string | null,
    before?: unknown,
    after?: unknown,
    ip?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: actor?.id ?? null,
          userLabel: actor ? userLabel(actor) : 'système',
          action,
          entity,
          entityId: entityId ?? null,
          before: before === undefined ? undefined : sanitizeForAudit(before),
          after: after === undefined ? undefined : sanitizeForAudit(after),
          ip,
        },
      });
    } catch (e) {
      this.logger.error(`Échec d'écriture du journal : ${(e as Error).message}`);
    }
  }
}
