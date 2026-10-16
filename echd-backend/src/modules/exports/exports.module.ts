import { Controller, Get, Module, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { Response } from 'express';
import { AdminOnly, AuthUser, ClientIp, CurrentUser } from '../../common/decorators';
import { AuditService } from '../../common/audit.service';
import { DueQuery, PaymentQuery } from '../finance/finance.dto';
import { FinanceModule } from '../finance/finance.module';
import { StudentQuery } from '../students/students.dto';
import { StudentsModule } from '../students/students.module';
import { ExportFile, ExportsService } from './exports.service';

class StudentsExportQuery extends StudentQuery {
  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv';
}

class DuesExportQuery extends DueQuery {
  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv';
}

class PaymentsExportQuery extends PaymentQuery {
  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv';
}

/** Exports Excel / CSV de la liste filtrée + sauvegarde complète (administrateur). */
@ApiTags('Exports')
@ApiBearerAuth()
@Controller('exports')
export class ExportsController {
  constructor(
    private exports: ExportsService,
    private audit: AuditService,
  ) {}

  private send(res: Response, f: ExportFile) {
    res.setHeader('Content-Type', f.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${f.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(f.buffer);
  }

  @Get('students')
  async students(@Query() q: StudentsExportQuery, @CurrentUser() u: AuthUser, @Res() res: Response) {
    this.send(res, await this.exports.students_(q, u, q.format ?? 'xlsx'));
  }

  @Get('dues')
  async dues(@Query() q: DuesExportQuery, @Res() res: Response) {
    this.send(res, await this.exports.dues(q, q.format ?? 'xlsx'));
  }

  @Get('payments')
  async payments(@Query() q: PaymentsExportQuery, @Res() res: Response) {
    this.send(res, await this.exports.payments(q, q.format ?? 'xlsx'));
  }

  /** Export complet des données (JSON). */
  @AdminOnly()
  @Get('backup')
  async backup(@CurrentUser() u: AuthUser, @ClientIp() ip: string, @Res() res: Response) {
    await this.audit.log(u, 'BACKUP_EXPORT', 'System', null, undefined, undefined, ip);
    this.send(res, await this.exports.backup());
  }
}

@Module({
  imports: [StudentsModule, FinanceModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
