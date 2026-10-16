import { Role } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PASSWORD_RULE } from '../auth/auth.dto';

export class CreateUserDto {
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  /** Identifiant de connexion ; généré automatiquement si absent. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9._-]{3,40}$/i, { message: "Identifiant : 3 à 40 caractères (lettres, chiffres, . _ -)." })
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsEnum(Role)
  role!: Role;

  /** Obligatoire pour le rôle TEACHER : fiche enseignant à relier. */
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsIn(['fr', 'ar'])
  language?: string;

  /** Mot de passe provisoire imposé ; généré automatiquement si absent. */
  @IsOptional()
  @IsString()
  @Matches(PASSWORD_RULE, { message: '8 caractères minimum, avec une lettre et un chiffre.' })
  password?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsIn(['fr', 'ar'])
  language?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ResetUserPasswordDto {
  @IsOptional()
  @IsString()
  @Matches(PASSWORD_RULE, { message: '8 caractères minimum, avec une lettre et un chiffre.' })
  password?: string;
}
