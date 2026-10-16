import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const PASSWORD_MSG = 'Le mot de passe doit contenir 8 caractères minimum, avec au moins une lettre et un chiffre.';

export class LoginDto {
  /** Identifiant (nom d'utilisateur) ou adresse e-mail */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  newPassword!: string;
}

export class UpdateMeDto {
  @IsOptional()
  @IsIn(['fr', 'ar'])
  language?: string;

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
}
