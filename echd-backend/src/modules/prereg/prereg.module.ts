import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { PreRegController } from './prereg.controller';
import { PreRegService } from './prereg.service';

@Module({
  imports: [StudentsModule],
  controllers: [PreRegController],
  providers: [PreRegService],
  exports: [PreRegService],
})
export class PreRegModule {}
