import { Audience, ClosureType, ExceptionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_MSG = 'Heure au format HH:mm (ex. 10:00).';

/* ───── Années scolaires ───── */

export class CreateSchoolYearDto {
  @IsString()
  @MaxLength(30)
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class UpdateSchoolYearDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class DuplicateSchoolYearDto {
  @IsString()
  @MaxLength(30)
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  /** Copie aussi les classes (enseignant, salle, capacité) et leurs créneaux. */
  @IsOptional()
  @IsBoolean()
  copyClasses?: boolean = true;

  @IsOptional()
  @IsBoolean()
  makeCurrent?: boolean;
}

export class ClosureDto {
  @IsEnum(ClosureType)
  type!: ClosureType;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @MaxLength(120)
  labelFr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  labelAr?: string;
}

/* ───── Cours ───── */

export class CreateCourseDto {
  @IsString()
  @MaxLength(150)
  titleFr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  titleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsEnum(Audience)
  audience!: Audience;

  @IsOptional()
  @IsUUID()
  levelId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  minAge?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionFr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionAr?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  keyPointsFr?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  keyPointsAr?: string[];

  /** Nom d'icône (ex. « book-open ») affiché sur la carte. */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  icon?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Couleur au format #RRGGBB.' })
  color?: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;
}

export class UpdateCourseDto {
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
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsEnum(Audience)
  audience?: Audience;

  @IsOptional()
  @IsUUID()
  levelId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  minAge?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionFr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionAr?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  keyPointsFr?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  keyPointsAr?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  icon?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Couleur au format #RRGGBB.' })
  color?: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;
}

/* ───── Classes & créneaux ───── */

export class SlotDto {
  /** 1 = lundi … 6 = samedi, 7 = dimanche */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @Matches(TIME, { message: TIME_MSG })
  startTime!: string;

  @Matches(TIME, { message: TIME_MSG })
  endTime!: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;
}

export class UpdateSlotDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  weekday?: number;

  @IsOptional()
  @Matches(TIME, { message: TIME_MSG })
  startTime?: string;

  @IsOptional()
  @Matches(TIME, { message: TIME_MSG })
  endTime?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;
}

export class CreateClassDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  /** Par défaut : année scolaire courante. */
  @IsOptional()
  @IsUUID()
  schoolYearId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  capacity!: number;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(14)
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots?: SlotDto[];
}

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  /** null pour retirer l'enseignant */
  @IsOptional()
  @IsUUID()
  teacherId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  capacity?: number;

  @IsOptional()
  @IsUUID()
  roomId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ClassQuery {
  @IsOptional()
  @IsUUID()
  schoolYearId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsString()
  active?: string; // "true" | "false"
}

export class SlotExceptionDto {
  @IsDateString()
  date!: string;

  @IsEnum(ExceptionType)
  type!: ExceptionType;

  @IsOptional()
  @Matches(TIME, { message: TIME_MSG })
  newStartTime?: string;

  @IsOptional()
  @Matches(TIME, { message: TIME_MSG })
  newEndTime?: string;

  @IsOptional()
  @IsUUID()
  newRoomId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  reason?: string;
}

export class TimetableQuery {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
