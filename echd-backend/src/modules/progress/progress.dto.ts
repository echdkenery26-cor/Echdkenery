import { Appreciation, MemorizationStatus, ProgressStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StepDto {
  /** Présent pour modifier une étape existante, absent pour en créer une */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(200)
  titleFr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleAr?: string;
}

export class CreatePathwayDto {
  @IsString()
  @MaxLength(150)
  titleFr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  titleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionFr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionAr?: string;

  /** Cours auquel le parcours est rattaché : affecté automatiquement aux élèves inscrits */
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** Étapes ordonnées (l'ordre du tableau fait foi) */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps?: StepDto[];
}

export class UpdatePathwayDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  titleFr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  titleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionFr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionAr?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** Si fourni : remplace la liste des étapes (les étapes retirées perdent leur historique) */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps?: StepDto[];
}

export class AssignPathwayDto {
  @IsUUID()
  pathwayId!: string;
}

export class ProgressItemDto {
  @IsUUID()
  stepId!: string;

  @IsEnum(ProgressStatus)
  status!: ProgressStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class UpdateProgressDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ProgressItemDto)
  updates!: ProgressItemDto[];
}

export class MemorizationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(114)
  surah!: number;

  /** Dernier verset atteint (0 = pas commencé) */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  verse!: number;

  @IsOptional()
  @IsEnum(MemorizationStatus)
  status?: MemorizationStatus;

  @IsOptional()
  @IsDateString()
  lastReviewAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class EvaluationDto {
  @IsEnum(Appreciation)
  appreciation!: Appreciation;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;
}

export class PromoteLevelDto {
  @IsUUID()
  levelId!: string;
}
