import { Module } from '@nestjs/common';
import { LevelsController, RoomsController } from './reference.controller';
import { LookupsController, SettingsController } from './settings.controller';

@Module({
  controllers: [SettingsController, LookupsController, LevelsController, RoomsController],
})
export class SettingsModule {}
