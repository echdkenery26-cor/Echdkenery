import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { AdminOnly, AnyRole, AuthUser, CurrentUser, StaffOnly } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';
import { PageQuery, pageArgs, pageResult } from '../../common/utils';
import { AlertsService } from './alerts.service';

class NotificationQuery extends PageQuery {
  @IsOptional()
  @IsString()
  unreadOnly?: string;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller()
export class AlertsController {
  constructor(
    private alerts: AlertsService,
    private prisma: PrismaService,
  ) {}

  /** Carte « À traiter » du tableau de bord. */
  @StaffOnly()
  @Get('alerts/todo')
  todo() {
    return this.alerts.todo();
  }

  /** Lance la tâche quotidienne à la main (retards, notifications, e-mail récapitulatif). */
  @AdminOnly()
  @HttpCode(200)
  @Post('alerts/run')
  run() {
    return this.alerts.runDaily();
  }

  /** Envoie le résumé par e-mail maintenant. */
  @AdminOnly()
  @HttpCode(200)
  @Post('alerts/digest')
  async digest() {
    return { sent: await this.alerts.sendDigest() };
  }

  /* ───── Centre de notifications (cloche + pastille) ───── */

  @AnyRole()
  @Get('notifications')
  async list(@Query() q: NotificationQuery, @CurrentUser() u: AuthUser) {
    const where = { userId: u.id, ...(q.unreadOnly === 'true' ? { read: false } : {}) };
    const [total, rows, unread] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({ where, ...pageArgs(q), orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count({ where: { userId: u.id, read: false } }),
    ]);
    return { ...pageResult(rows, total, q), unread };
  }

  @AnyRole()
  @Get('notifications/unread-count')
  async unread(@CurrentUser() u: AuthUser) {
    return { count: await this.prisma.notification.count({ where: { userId: u.id, read: false } }) };
  }

  @AnyRole()
  @HttpCode(200)
  @Post('notifications/read-all')
  async readAll(@CurrentUser() u: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: u.id, read: false }, data: { read: true, readAt: new Date() } });
    return { ok: true };
  }

  @AnyRole()
  @HttpCode(200)
  @Post('notifications/:id/read')
  async read(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    await this.prisma.notification.updateMany({ where: { id, userId: u.id }, data: { read: true, readAt: new Date() } });
    return { ok: true };
  }
}
