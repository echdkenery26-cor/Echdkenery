import { Controller, Get, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnyRole, AuthUser, CurrentUser } from '../../common/decorators';
import { AlertsModule } from '../alerts/alerts.module';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { FinanceModule } from '../finance/finance.module';
import { DashboardService } from './dashboard.service';

@ApiTags('Tableau de bord')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  /** Administration/gestionnaire : chiffres clés + « À traiter ». Enseignant : ses classes du jour. */
  @AnyRole()
  @Get()
  get(@CurrentUser() u: AuthUser) {
    return this.dashboard.get(u);
  }
}

@Module({
  imports: [AlertsModule, FinanceModule, AnnouncementsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
