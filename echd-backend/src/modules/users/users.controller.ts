import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnly, AuthUser, ClientIp, CurrentUser } from '../../common/decorators';
import { CreateUserDto, ResetUserPasswordDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

/** Gestion des comptes : réservée à l'administrateur. */
@ApiTags('Comptes')
@ApiBearerAuth()
@AdminOnly()
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser, @ClientIp() ip: string) {
    return this.users.create(dto, actor, ip);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.users.update(id, dto, actor, ip);
  }

  @Post(':id/reset-password')
  reset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip: string,
  ) {
    return this.users.resetPassword(id, dto.password, actor, ip);
  }
}
