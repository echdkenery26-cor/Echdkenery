import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { ProgressModule } from '../progress/progress.module';
import { EnrollmentsService } from './enrollments.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [FinanceModule, ProgressModule],
  controllers: [StudentsController],
  providers: [StudentsService, EnrollmentsService],
  exports: [StudentsService, EnrollmentsService],
})
export class StudentsModule {}
