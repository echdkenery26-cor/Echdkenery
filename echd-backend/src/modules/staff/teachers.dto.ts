import { Audience } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PASSWORD_RULE } from '../auth/auth.dto';

export class TeacherAccountDto {
  /** Identifiant ; généré automatiquement (prenom.nom) si absent. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9._-]{3,40}$/i, { message: 'Identifiant : 3 à 40 caractères (lettres, chiffres, . _ -).' })
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(PASSWORD_RULE, { message: '8 caractères minimum, avec une lettre et un chiffre.' })
  password?: string;
}

export class CreateTeacherDto {
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialty?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Audience, { each: true })
  audiences?: Audience[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  showOnSite?: boolean;

  /** Si présent, crée en même temps le compte de connexion (rôle Enseignant). */
  @IsOptional()
  @ValidateNested()
  @Type(() => TeacherAccountDto)
  account?: TeacherAccountDto;
}

export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialty?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Audience, { each: true })
  audiences?: Audience[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  showOnSite?: boolean;
}

export class CreateStaffDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(120)
  roleFr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  roleAr?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  roleFr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  roleAr?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}
