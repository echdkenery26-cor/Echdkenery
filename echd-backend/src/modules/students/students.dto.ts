import { OmitType, PartialType } from '@nestjs/swagger';
import { Audience, Gender, StudentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PageQuery } from '../../common/utils';

export class GuardianDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  /** père, mère, tuteur… */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  relationship?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CreateStudentDto {
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MaxLength(80)
  lastName!: string;

  /** Nom en arabe (facultatif) */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  arabicName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsEnum(Audience)
  audience!: Audience;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsUUID()
  startLevelId?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsDateString()
  enrolledAt?: string;

  /** Notes internes — visibles de l'administration seulement */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  /** Consentement RGPD recueilli (horodaté à l'enregistrement) */
  @IsOptional()
  @IsBoolean()
  gdprConsent?: boolean;

  /** Autorisation de droit à l'image (case séparée, facultative) */
  @IsOptional()
  @IsBoolean()
  imageRightsConsent?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => GuardianDto)
  guardians?: GuardianDto[];

  /** Relie le nouvel élève à la fratrie de cet élève */
  @IsOptional()
  @IsUUID()
  siblingOfStudentId?: string;

  /** Inscrit directement dans ces classes (étape 2 de l'assistant) */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsUUID('all', { each: true })
  classIds?: string[];

  /** Ignore l'avertissement de doublon présumé */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class UpdateStudentDto extends PartialType(
  OmitType(CreateStudentDto, ['classIds', 'force', 'siblingOfStudentId', 'status', 'gdprConsent'] as const),
) {}

export class BatchStudentsDto {
  /** Plusieurs enfants d'une même fratrie, ou plusieurs personnes à la fois */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => CreateStudentDto)
  students!: CreateStudentDto[];

  @IsOptional()
  @IsBoolean()
  sameFamily?: boolean = true;
}

export class StudentStatusDto {
  @IsEnum(StudentStatus)
  status!: StudentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  reason?: string;
}

export class LinkSiblingDto {
  @IsUUID()
  studentId!: string;
}

export class StudentQuery extends PageQuery {
  /** Recherche : nom, prénom, nom arabe ou téléphone */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(Audience)
  audience?: Audience;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  levelId?: string;

  /** late = au moins une échéance en retard · ok = aucune échéance en retard */
  @IsOptional()
  @IsString()
  paymentState?: 'late' | 'ok';

  /** "true" pour voir les archivés */
  @IsOptional()
  @IsString()
  archived?: string;

  /** name (défaut) | recent */
  @IsOptional()
  @IsString()
  sort?: string;
}

export class EnrollDto {
  @IsUUID()
  classId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Ignore les avertissements (public, âge minimum, chevauchement d'horaires) */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class EndEnrollmentDto {
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class TransferDto {
  @IsUUID()
  toClassId!: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
