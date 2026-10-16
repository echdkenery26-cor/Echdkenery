import { Audience, Gender, PreRegStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageQuery } from '../../common/utils';

export class PreRegPersonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

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

  /** Clé retournée par POST /public/uploads/photo */
  @IsOptional()
  @Matches(/^private\/tmp\/[A-Za-z0-9_-]+\.webp$/, { message: 'Clé de photo invalide.' })
  photoKey?: string;

  /** Niveau estimé */
  @IsOptional()
  @IsUUID()
  levelId?: string;

  @IsOptional()
  @IsBoolean()
  imageRights?: boolean;
}

export class CreatePreRegDto {
  @IsEnum(Audience)
  audience!: Audience;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  /** Responsable légal (enfant) ou personne à contacter */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  relationship?: string;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone!: string;

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

  /** Un adulte, ou un ou plusieurs enfants d'une même fratrie */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => PreRegPersonDto)
  persons!: PreRegPersonDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  /** Consentement RGPD obligatoire */
  @IsBoolean()
  @Equals(true, { message: 'Le consentement est obligatoire.' })
  consent!: boolean;

  /** Champ piège anti-spam : doit rester vide (masqué côté formulaire) */
  @IsOptional()
  @IsString()
  website?: string;
}

export class PreRegQuery extends PageQuery {
  @IsOptional()
  @IsEnum(PreRegStatus)
  status?: PreRegStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class UpdatePreRegDto {
  @IsOptional()
  @IsEnum(PreRegStatus)
  status?: PreRegStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNotes?: string;
}

export class ConvertPreRegDto {
  /** Inscrit directement les élèves créés dans cette classe */
  @IsOptional()
  @IsUUID()
  classId?: string;

  /** Ignore l'avertissement de doublon */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
