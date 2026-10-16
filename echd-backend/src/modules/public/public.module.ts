import { Module } from '@nestjs/common';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { PreRegModule } from '../prereg/prereg.module';
import { PublicController } from './public.controller';

@Module({
  imports: [AnnouncementsModule, PreRegModule],
  controllers: [PublicController],
})
export class PublicModule {}
