import { AnnouncementStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQuery } from '../../common/utils';

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(200)
  titleFr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleAr?: string;

  @IsString()
  @MaxLength(8000)
  bodyFr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  bodyAr?: string;

  /** Code d'une catégorie (paramètre « announcement.categories ») */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  showHijri?: boolean;

  /** Publication programmée (par défaut : dès la publication) */
  @IsOptional()
  @IsDateString()
  publishAt?: string | null;

  /** Expiration programmée */
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleFr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  bodyFr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  bodyAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  showHijri?: boolean;

  @IsOptional()
  @IsDateString()
  publishAt?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

export class AnnouncementQuery extends PageQuery {
  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;
}
