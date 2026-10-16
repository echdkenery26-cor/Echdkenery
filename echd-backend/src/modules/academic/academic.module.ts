import { Module } from '@nestjs/common';
import { ClassesController, CoursesController, SchoolYearsController, TimetableController } from './academic.controller';
import { ClassesService } from './classes.service';
import { TimetableService } from './timetable.service';

@Module({
  controllers: [CoursesController, SchoolYearsController, ClassesController, TimetableController],
  providers: [ClassesService, TimetableService],
  exports: [ClassesService, TimetableService],
})
export class AcademicModule {}
