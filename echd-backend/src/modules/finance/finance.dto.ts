//echd-backend/src/modules/finance/finance.dto.ts
import { DueStatus, FeeKind, FeePeriod, PaymentMethod, ReminderChannel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQuery } from '../../common/utils';

export class FeeScheduleDto {
  @IsString()
  @MaxLength(150)
  titleFr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  titleAr?: string;

  @IsEnum(FeeKind)
  kind!: FeeKind;

  /** Montant en centimes (ex. 10 € = 1000) */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountCents!: number;

  @IsOptional()
  @IsEnum(FeePeriod)
  period?: FeePeriod;

  /** Vide = s'applique à tous les cours */
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateFeeScheduleDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  titleFr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  titleAr?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountCents?: number;

  @IsOptional()
  @IsEnum(FeePeriod)
  period?: FeePeriod;

  @IsOptional()
  @IsUUID()
  courseId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class GenerateDuesDto {
  /** Vide = tous les élèves inscrits */
  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class CreateDueDto {
  @IsUUID()
  studentId!: string;

  @IsString()
  @MaxLength(200)
  label!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsEnum(FeeKind)
  kind?: FeeKind;

  @IsOptional()
  @IsUUID()
  courseId?: string;
}

export class UpdateDueDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class ExemptDto {
  @IsString()
  @MaxLength(250)
  reason!: string;
}

export class DueQuery extends PageQuery {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  /** Mois de l'échéance : YYYY-MM */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Mois au format YYYY-MM.' })
  month?: string;

  @IsOptional()
  @IsEnum(DueStatus)
  status?: DueStatus;

  /** "late" = LATE + CRITICAL */
  @IsOptional()
  @IsIn(['late', 'open'])
  state?: 'late' | 'open';

  @IsOptional()
  @IsEnum(FeeKind)
  kind?: FeeKind;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CreatePaymentDto {
  @IsUUID()
  dueId!: string;

  /** Montant en centimes ; paiement partiel possible */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  periodCovered?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class CancelPaymentDto {
  @IsString()
  @MaxLength(250)
  reason!: string;
}

export class PaymentQuery extends PageQuery {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  includeCancelled?: string;
}

export class PrepareReminderDto {
  @IsOptional()
  @IsUUID()
  dueId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsIn(['fr', 'ar'])
  lang?: 'fr' | 'ar';
}

export class CreateReminderDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  dueId?: string;

  @IsEnum(ReminderChannel)
  channel!: ReminderChannel;

  @IsString()
  @MaxLength(2000)
  message!: string;
}

export class SummaryQuery {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Mois au format YYYY-MM.' })
  month?: string;
}

/** Encaissements d'une période : le mois, le trimestre ou l'année civile qui contient `ref` (par défaut aujourd'hui). */
export class CollectionsQuery {
  @IsOptional()
  @IsIn(['month', 'quarter', 'year'], { message: 'Période : month, quarter ou year.' })
  period?: 'month' | 'quarter' | 'year';

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Référence au format YYYY-MM.' })
  ref?: string;
}
