import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { AcademicModule } from './modules/academic/academic.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ExportsModule } from './modules/exports/exports.module';
import { FinanceModule } from './modules/finance/finance.module';
import { PreRegModule } from './modules/prereg/prereg.module';
import { ProgressModule } from './modules/progress/progress.module';
import { PublicModule } from './modules/public/public.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StaffModule } from './modules/staff/staff.module';
import { StudentsModule } from './modules/students/students.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Limite générale : 300 requêtes / minute / IP (les routes sensibles ont leurs propres limites)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    CommonModule,
    AuthModule,
    AuditModule,
    SettingsModule,
    StaffModule,
    AcademicModule,
    FinanceModule,
    ProgressModule,
    StudentsModule,
    AttendanceModule,
    PreRegModule,
    AnnouncementsModule,
    AlertsModule,
    DashboardModule,
    DocumentsModule,
    ExportsModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [
    // L'ordre compte : limitation de débit → authentification → rôles
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
