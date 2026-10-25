//echd-backend/src/modules/expenses/expenses.dto.ts
import { ExpenseCategory, PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PageQuery } from '../../common/utils';

export class CreateExpenseDto {
  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  /** Objet de la dépense (obligatoire ; pour « Autres », c'est ici que l'on précise la nature) */
  @IsString()
  @MinLength(2, { message: 'Précisez l’objet de la dépense.' })
  @MaxLength(200)
  label!: string;

  /** Bénéficiaire : enseignant payé, fournisseur… */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  beneficiary?: string;

  /** Montant en centimes */
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Le montant doit être supérieur à zéro.' })
  @Max(2_000_000_000)
  amountCents!: number;

  /** Jour de la dépense (aujourd'hui par défaut) */
  @IsOptional()
  @IsDateString()
  spentAt?: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Précisez l’objet de la dépense.' })
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  beneficiary?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  amountCents?: number;

  @IsOptional()
  @IsDateString()
  spentAt?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class CancelExpenseDto {
  @IsString()
  @MinLength(3, { message: 'Indiquez le motif de l’annulation.' })
  @MaxLength(250)
  reason!: string;
}

export class ExpenseQuery extends PageQuery {
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /** Recherche : objet, bénéficiaire, référence ou numéro */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  includeCancelled?: string;
}

/** Solde d'une période : le mois, le trimestre ou l'année civile qui contient `ref` (par défaut aujourd'hui). */
export class BalanceQuery {
  @IsOptional()
  @IsIn(['month', 'quarter', 'year'], { message: 'Période : month, quarter ou year.' })
  period?: 'month' | 'quarter' | 'year';

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Référence au format YYYY-MM.' })
  ref?: string;
}
