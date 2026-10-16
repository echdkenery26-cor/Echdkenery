import { Controller, Get, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { AdminOnly } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';
import { PageQuery, pageArgs, pageResult } from '../../common/utils';

class AuditQuery extends PageQuery {
  /** Type d'objet : Student, Payment, User… */
  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  action?: string;

  /** Recherche dans le nom de l'auteur */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  entityId?: string;
}

/** Journal d'audit (qui a fait quoi, quand) — consultation réservée à l'administrateur. */
@ApiTags('Journal')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @AdminOnly()
  @Get()
  async list(@Query() q: AuditQuery) {
    const where = {
      entity: q.entity || undefined,
      action: q.action || undefined,
      entityId: q.entityId || undefined,
      userLabel: q.q ? { contains: q.q, mode: 'insensitive' as const } : undefined,
    };
    const [total, items, entities] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, ...pageArgs(q), orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.groupBy({ by: ['entity'], orderBy: { entity: 'asc' } }),
    ]);
    return { ...pageResult(items, total, q), entities: entities.map((e) => e.entity) };
  }
}

@Module({ controllers: [AuditController] })
export class AuditModule {}
