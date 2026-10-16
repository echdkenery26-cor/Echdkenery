import { Module } from '@nestjs/common';
import { StaffController, TeachersController } from './staff.controller';
import { TeachersService } from './teachers.service';

@Module({
  controllers: [TeachersController, StaffController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class StaffModule {}
