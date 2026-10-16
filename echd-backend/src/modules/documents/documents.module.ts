import { Module } from '@nestjs/common';
import { AcademicModule } from '../academic/academic.module';
import { ProgressModule } from '../progress/progress.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AcademicModule, ProgressModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
