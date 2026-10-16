import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { AuditService } from './audit.service';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MailService } from './mail.service';
import { NotificationsService } from './notifications.service';
import { PrismaService } from './prisma.service';
import { SettingsService } from './settings.service';
import { SigningService } from './signing.service';

@Global()
@Module({
  controllers: [FilesController],
  providers: [
    PrismaService,
    SettingsService,
    AuditService,
    MailService,
    SigningService,
    FilesService,
    NotificationsService,
    AccessService,
  ],
  exports: [
    PrismaService,
    SettingsService,
    AuditService,
    MailService,
    SigningService,
    FilesService,
    NotificationsService,
    AccessService,
  ],
})
export class CommonModule {}
