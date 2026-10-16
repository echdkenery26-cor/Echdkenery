import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { AuditService } from '../../common/audit.service';
import { AdminOnly, AnyRole, AuthUser, ClientIp, CurrentUser } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';

export class LevelDto {
  @IsString()
  @Matches(/^[a-z0-9_-]{1,30}$/i, { message: 'Code : lettres, chiffres, - ou _ (30 max).' })
  code!: string;

  @IsString()
  @MaxLength(80)
  labelFr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  labelAr?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateLevelDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  labelFr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  labelAr?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class RoomDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nameAr?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nameAr?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@ApiTags('Référentiels')
@ApiBearerAuth()
@Controller('levels')
export class LevelsController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  @AnyRole()
  @Get()
  list() {
    return this.prisma.level.findMany({ orderBy: { order: 'asc' } });
  }

  @AdminOnly()
  @Post()
  async create(@Body() dto: LevelDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const row = await this.prisma.level.create({ data: dto });
    await this.audit.log(u, 'CREATE', 'Level', row.id, undefined, row, ip);
    return row;
  }

  @AdminOnly()
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLevelDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.level.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.level.update({ where: { id }, data: dto });
    await this.audit.log(u, 'UPDATE', 'Level', id, before, row, ip);
    return row;
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.level.findUniqueOrThrow({ where: { id } });
    await this.prisma.level.delete({ where: { id } });
    await this.audit.log(u, 'DELETE', 'Level', id, before, undefined, ip);
    return { ok: true };
  }
}

@ApiTags('Référentiels')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  @AnyRole()
  @Get()
  list() {
    return this.prisma.room.findMany({ orderBy: { name: 'asc' } });
  }

  @AdminOnly()
  @Post()
  async create(@Body() dto: RoomDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const row = await this.prisma.room.create({ data: dto });
    await this.audit.log(u, 'CREATE', 'Room', row.id, undefined, row, ip);
    return row;
  }

  @AdminOnly()
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.room.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.room.update({ where: { id }, data: dto });
    await this.audit.log(u, 'UPDATE', 'Room', id, before, row, ip);
    return row;
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string) {
    const before = await this.prisma.room.findUniqueOrThrow({ where: { id } });
    await this.prisma.room.delete({ where: { id } });
    await this.audit.log(u, 'DELETE', 'Room', id, before, undefined, ip);
    return { ok: true };
  }
}
