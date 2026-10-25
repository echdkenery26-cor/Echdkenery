//echd-backend/src/modules/expenses/expenses.controller.ts
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnly, AuthUser, ClientIp, CurrentUser } from '../../common/decorators';
import { BalanceQuery, CancelExpenseDto, CreateExpenseDto, ExpenseQuery, UpdateExpenseDto } from './expenses.dto';
import { ExpensesService } from './expenses.service';

/**
 * Dépenses de l'école et solde : réservés à l'administrateur
 * (les salaires et le solde de caisse ne sont pas visibles des gestionnaires).
 */
@AdminOnly()
@ApiTags('Dépenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @Get()
  list(@Query() q: ExpenseQuery) {
    return this.expenses.list(q);
  }

  /** Encaissements − dépenses sur un mois, un trimestre ou une année, + solde disponible cumulé. */
  @Get('balance')
  balance(@Query() q: BalanceQuery) {
    return this.expenses.balance(q.period, q.ref);
  }

  @Post()
  create(@Body() dto: CreateExpenseDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.expenses.create(dto, u, ip);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExpenseDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.expenses.update(id, dto, u, ip);
  }

  /** Annulation avec motif obligatoire (jamais de suppression silencieuse). */
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelExpenseDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.expenses.cancel(id, dto, u, ip);
  }
}
