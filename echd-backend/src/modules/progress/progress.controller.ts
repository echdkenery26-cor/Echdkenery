import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnly, AnyRole, AuthUser, ClientIp, CurrentUser, StaffOnly } from '../../common/decorators';
import {
  AssignPathwayDto,
  CreatePathwayDto,
  EvaluationDto,
  MemorizationDto,
  PromoteLevelDto,
  UpdatePathwayDto,
  UpdateProgressDto,
} from './progress.dto';
import { ProgressService } from './progress.service';

@ApiTags('Progression')
@ApiBearerAuth()
@Controller()
export class ProgressController {
  constructor(private progress: ProgressService) {}

  /* ───── Parcours (configuration) ───── */

  @AnyRole()
  @Get('pathways')
  list(@Query('all') all?: string) {
    return this.progress.listPathways(all === 'true');
  }

  @AnyRole()
  @Get('pathways/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.progress.getPathway(id);
  }

  @AdminOnly()
  @Post('pathways')
  create(@Body() dto: CreatePathwayDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.progress.createPathway(dto, u, ip);
  }

  @AdminOnly()
  @Patch('pathways/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePathwayDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.progress.updatePathway(id, dto, u, ip);
  }

  @AdminOnly()
  @Delete('pathways/:id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.progress.removePathway(id, u, ip);
  }

  /* ───── Suivi d'un élève ───── */

  /** Parcours, étapes, % d'avancement, mémorisation, évaluations, courbe et proposition de passage de niveau. */
  @AnyRole()
  @Get('students/:id/progress')
  student(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.progress.studentProgress(id, u);
  }

  @AnyRole()
  @Put('students/:id/progress')
  update_(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProgressDto, @CurrentUser() u: AuthUser) {
    return this.progress.updateProgress(id, dto.updates, u);
  }

  @AnyRole()
  @Post('students/:id/pathways')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignPathwayDto, @CurrentUser() u: AuthUser) {
    return this.progress.assign(id, dto.pathwayId, u);
  }

  @StaffOnly()
  @Delete('students/:id/pathways/:pathwayId')
  unassign(@Param('id', ParseUUIDPipe) id: string, @Param('pathwayId', ParseUUIDPipe) pathwayId: string, @CurrentUser() u: AuthUser) {
    return this.progress.unassign(id, pathwayId, u);
  }

  @AnyRole()
  @Post('students/:id/promote-level')
  promote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PromoteLevelDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    return this.progress.promoteLevel(id, dto.levelId, u, ip);
  }

  @AnyRole()
  @Put('students/:id/memorization')
  memo(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MemorizationDto, @CurrentUser() u: AuthUser) {
    return this.progress.saveMemorization(id, dto, u);
  }

  @AnyRole()
  @Delete('students/:id/memorization/:surah')
  removeMemo(@Param('id', ParseUUIDPipe) id: string, @Param('surah', ParseIntPipe) surah: number, @CurrentUser() u: AuthUser) {
    return this.progress.removeMemorization(id, surah, u);
  }

  @AnyRole()
  @Post('students/:id/evaluations')
  addEval(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EvaluationDto, @CurrentUser() u: AuthUser) {
    return this.progress.addEvaluation(id, dto, u);
  }

  @AnyRole()
  @Delete('evaluations/:id')
  removeEval(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.progress.removeEvaluation(id, u);
  }

  /** Vue d'ensemble de la classe : avancement, assiduité, dernière évaluation de chaque élève. */
  @AnyRole()
  @Get('classes/:id/progress-overview')
  overview(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) {
    return this.progress.classOverview(id, u);
  }
}
