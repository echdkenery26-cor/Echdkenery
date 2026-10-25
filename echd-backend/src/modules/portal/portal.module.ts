//echd-backend/src/modules/portal/portal.module.ts
import { Module } from '@nestjs/common';
import { AcademicModule } from '../academic/academic.module';
import { ProgressModule } from '../progress/progress.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [AcademicModule, ProgressModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
