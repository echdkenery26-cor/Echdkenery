import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../common/audit.service';
import { AdminOnly, AuthUser, ClientIp, CurrentUser } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';
import {
  CancelPaymentDto,
  CreateDueDto,
  CreatePaymentDto,
  CreateReminderDto,
  DueQuery,
  ExemptDto,
  FeeScheduleDto,
  GenerateDuesDto,
  PaymentQuery,
  PrepareReminderDto,
  SummaryQuery,
  UpdateDueDto,
  UpdateFeeScheduleDto,
} from './finance.dto';
import { FinanceService } from './finance.service';

/**
 * Cotisations : tout le module est réservé à ADMIN + MANAGER (règle par défaut).
 * Un enseignant n'a jamais accès aux montants ni aux paiements (règle 9).
 */
@ApiTags('Cotisations')
@ApiBearerAuth()
@Controller()
export class FinanceController {
  constructor(
    private finance: FinanceService,
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  /* ───── Barème ───── */

  @Get('fees')
  fees() {
    return this.prisma.feeSchedule.findMany({
      orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
      include: { course: { select: { id: true, titleFr: true, titleAr: true } } },
    });
  }

  @AdminOnly()
  @Post('fees')
  async createFee(@Body() dto: FeeScheduleDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const row = await this.prisma.feeSchedule.create({
      data: { ...dto, period: dto.kind === 'REGISTRATION' ? 'ONCE' : (dto.period ?? 'MONTHLY') },
    });
    await this.audit.log(u, 'CREATE', 'FeeSchedule', row.id, undefined, row, ip);
    return row;
  }

  @AdminOnly()
  @Patch('fees/:id')
  async updateFee(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFeeScheduleDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.feeSchedule.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.feeSchedule.update({ where: { id }, data: dto });
    await this.audit.log(u, 'UPDATE', 'FeeSchedule', id, before, row, ip);
    return row;
  }

  @AdminOnly()
  @Delete('fees/:id')
  async removeFee(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.feeSchedule.findUniqueOrThrow({ where: { id } });
    await this.prisma.feeSchedule.delete({ where: { id } });
    await this.audit.log(u, 'DELETE', 'FeeSchedule', id, before, undefined, ip);
    return { ok: true };
  }

  /** Génère les échéances manquantes (sans doublon) pour un élève ou pour tous. */
  @Post('fees/generate')
  generate(@Body() dto: GenerateDuesDto) {
    return dto.studentId
      ? this.finance.generateForStudent(dto.studentId).then((created) => ({ students: 1, created }))
      : this.finance.generateAll();
  }

  /* ───── Échéances ───── */

  @Get('dues')
  dues(@Query() q: DueQuery) {
    return this.finance.listDues(q);
  }

  /** Un résumé par élève : reste à payer, nombre de retards, jours de retard. */
  @Get('dues/by-student')
  byStudent(@Query() q: DueQuery) {
    return this.finance.duesByStudent(q);
  }

  @Get('finance/summary')
  summary(@Query() q: SummaryQuery) {
    return this.finance.summary(q.month);
  }

  @Get('students/:id/finance')
  studentFinance(@Param('id', ParseUUIDPipe) id: string) {
    return this.finance.studentFinance(id);
  }

  @Post('dues')
  createDue(@Body() dto: CreateDueDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.finance.createDue(dto, u, ip);
  }

  @Patch('dues/:id')
  updateDue(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDueDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.finance.updateDue(id, dto, u, ip);
  }

  @Post('dues/:id/exempt')
  exempt(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ExemptDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.finance.exempt(id, dto.reason, u, ip);
  }

  @Post('dues/:id/unexempt')
  unexempt(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.finance.unexempt(id, u, ip);
  }

  @AdminOnly()
  @Delete('dues/:id')
  removeDue(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.finance.removeDue(id, u, ip);
  }

  /* ───── Paiements ───── */

  @Get('payments')
  payments(@Query() q: PaymentQuery) {
    return this.finance.listPayments(q);
  }

  @Post('payments')
  pay(@Body() dto: CreatePaymentDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.finance.createPayment(dto, u, ip);
  }

  /** Annulation avec motif obligatoire (jamais de suppression silencieuse). */
  @Post('payments/:id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelPaymentDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.finance.cancelPayment(id, dto, u, ip);
  }

  /* ───── Relances ───── */

  @Post('reminders/prepare')
  prepare(@Body() dto: PrepareReminderDto) {
    return this.finance.prepareReminder(dto);
  }

  @Post('reminders')
  logReminder(@Body() dto: CreateReminderDto, @CurrentUser() u: AuthUser) {
    return this.finance.logReminder(dto, u);
  }

  @Get('reminders')
  reminders(@Query('studentId') studentId?: string, @Query('dueId') dueId?: string) {
    return this.finance.listReminders(studentId, dueId);
  }
}
