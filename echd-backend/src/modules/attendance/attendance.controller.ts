import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnyRole, AuthUser, CurrentUser } from '../../common/decorators';
import { HistoryQuery, SaveSheetDto, SheetQuery } from './attendance.dto';
import { AttendanceService } from './attendance.service';

@ApiTags('Présences')
@ApiBearerAuth()
@AnyRole()
@Controller()
export class AttendanceController {
  constructor(private attendance: AttendanceService) {}

  /** Feuille d'appel d'une classe pour une date (élèves actifs uniquement). */
  @Get('attendance/sheet')
  sheet(@Query() q: SheetQuery, @CurrentUser() u: AuthUser) {
    return this.attendance.sheet(q.classId, q.date, u);
  }

  /** Enregistre (ou corrige) l'appel : Présent · Absent · Retard · Excusé. */
  @Put('attendance/sheet')
  save(@Body() dto: SaveSheetDto, @CurrentUser() u: AuthUser) {
    return this.attendance.save(dto, u);
  }

  @Get('classes/:id/attendance')
  classHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.attendance.classHistory(id, u);
  }

  /** Historique + taux d'assiduité d'un élève. */
  @Get('students/:id/attendance')
  student(@Param('id', ParseUUIDPipe) id: string, @Query() q: HistoryQuery, @CurrentUser() u: AuthUser) {
    return this.attendance.studentHistory(id, q.from, q.to, u);
  }
}
