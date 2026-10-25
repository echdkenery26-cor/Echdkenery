//echd-frontend/src/app/[locale]/(site)/suivi/[token]/page.tsx
import { BookOpen, CalendarCheck, CalendarClock, Phone, Printer, Star, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHero, Section } from '@/components/site/blocks';
import { Avatar, Badge, Card, CardTitle, ProgressBar } from '@/components/ui/display';
import { formatDate, formatMoney, formatNumber, formatTime, intlLocale, isLocale, pickFor, trFor, weekdayName } from '@/lib/locale';
import { portalGet } from '@/lib/server-api';
import { telLink } from '@/lib/utils';

// Page personnelle : jamais indexée, jamais mise en cache, aucune adresse transmise aux sites tiers.
export const metadata: Metadata = {
  title: 'Suivi',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};
export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'neutral' | 'info'> = { PAID: 'ok', PARTIAL: 'warn', LATE: 'bad', CRITICAL: 'bad', UPCOMING: 'neutral' };

export default async function ParentPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  const t = trFor(locale);
  const pick = pickFor(locale);
  const { status, data: d } = await portalGet(token);

  if (!d) {
    const expired = status === 403 || status === 404;
    return (
      <>
        <PageHero title={t('Suivi de l’élève', 'متابعة الطالب')} />
        <Section>
          <Card className="mx-auto max-w-xl text-center">
            <p className="font-serif text-xl font-bold text-brand-800">{expired ? t('Ce lien n’est plus valable', 'هذا الرابط لم يعد صالحاً') : t('Le suivi est momentanément indisponible', 'المتابعة غير متاحة مؤقتاً')}</p>
            <p className="mt-2 text-brand-500">
              {expired
                ? t('Il a peut-être expiré. Demandez un nouveau lien à l’école.', 'ربما انتهت صلاحيته. اطلب رابطاً جديداً من المدرسة.')
                : t('Réessayez dans quelques minutes.', 'أعد المحاولة بعد دقائق.')}
            </p>
          </Card>
        </Section>
      </>
    );
  }

  const loc = intlLocale(locale, !!d.school.arabicIndicDigits);
  const money = (c: number) => formatMoney(c, loc, d.school.currency);
  const num = (n: number) => formatNumber(n, loc);
  const date = (v: string) => formatDate(v, loc, 'medium');
  const time = (v: string) => `⁦${formatTime(v, loc)}⁩`;
  const schoolName = pick(d.school.name.fr, d.school.name.ar);
  const methods: Record<string, string> = { CASH: t('Espèces', 'نقداً'), CHEQUE: t('Chèque', 'شيك'), TRANSFER: t('Virement', 'تحويل'), CARD: t('Carte', 'بطاقة') };
  const dueStatus: Record<string, string> = { PAID: t('Réglé', 'مسدَّد'), PARTIAL: t('Partiel', 'جزئي'), LATE: t('En retard', 'متأخر'), CRITICAL: t('En retard', 'متأخر'), UPCOMING: t('À venir', 'قادم') };
  const attStatus: Record<string, string> = { ABSENT: t('Absent', 'غائب'), LATE: t('En retard', 'متأخر'), EXCUSED: t('Excusé', 'بعذر') };
  const appr: Record<string, string> = { TO_REVIEW: t('À revoir', 'يحتاج مراجعة'), GOOD: t('Bien', 'جيد'), VERY_GOOD: t('Très bien', 'جيد جداً'), EXCELLENT: t('Excellent', 'ممتاز') };
  const att = d.attendance;
  const hasLate = d.finance.dues.some((x: any) => x.status === 'LATE' || x.status === 'CRITICAL');

  return (
    <>
      <PageHero
        title={t(`Suivi de ${d.student.firstName}`, `متابعة ${d.student.firstName}`)}
        text={t('Présences, progression et cotisations. Ce lien est personnel : ne le partagez pas.', 'الحضور والتقدّم والاشتراكات. هذا الرابط شخصي: لا تشاركه.')}
      />
      <Section>
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Élève */}
          <Card className="flex flex-wrap items-center gap-4">
            <Avatar src={d.student.photoUrl} first={d.student.firstName} last={d.student.name.split(' ').slice(1).join(' ')} size={72} />
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-2xl font-bold text-brand-800">{d.student.name}</h2>
              {d.student.arabicName && <p dir="rtl" className="font-arabic text-lg text-brand-500">{d.student.arabicName}</p>}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {d.student.level && <Badge tone="gold">{pick(d.student.level.labelFr, d.student.level.labelAr)}</Badge>}
                {d.classes.map((c: any) => (
                  <Badge key={c.className}>{pick(c.courseFr, c.courseAr)} · {c.className}</Badge>
                ))}
              </div>
            </div>
          </Card>

          {/* Prochaines séances */}
          <Card>
            <CardTitle icon={<CalendarClock className="size-4" />}>{t('Prochaines séances', 'الحصص القادمة')}</CardTitle>
            {d.upcoming.length ? (
              <ul className="divide-y divide-sand-200">
                {d.upcoming.map((o: any, i: number) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="font-medium text-brand-700">{formatDate(o.date, loc, 'long')}</span>
                    <span className="flex items-center gap-2 text-sm text-brand-500">
                      {time(o.startTime)}–{time(o.endTime)}
                      {o.status === 'CANCELLED' && <Badge tone="bad">{t('Annulé', 'ملغى')}</Badge>}
                      {o.status === 'MOVED' && <Badge tone="warn">{t('Déplacé', 'مؤجَّل')}</Badge>}
                      {o.status === 'CLOSED' && <Badge tone="neutral">{t('Fermé', 'مغلق')}</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-brand-500">{t('Aucune séance prévue prochainement.', 'لا توجد حصص مبرمجة قريباً.')}</p>
            )}
          </Card>

          {/* Assiduité */}
          <Card>
            <CardTitle icon={<CalendarCheck className="size-4" />}>{t('Assiduité (90 derniers jours)', 'الحضور (آخر 90 يوماً)')}</CardTitle>
            {att.rate === null ? (
              <p className="text-sm text-brand-500">{t('Pas encore de présence enregistrée.', 'لم يُسجَّل حضور بعد.')}</p>
            ) : (
              <>
                <p className="num font-serif text-3xl font-bold text-brand-800">{num(att.rate)} %</p>
                <div className="my-2"><ProgressBar value={att.rate} tone={att.rate >= 80 ? 'ok' : att.rate >= 60 ? 'gold' : 'bad'} label={t('Assiduité', 'الحضور')} /></div>
                <p className="text-sm text-brand-500">
                  {t(`${num(att.present)} présent · ${num(att.late)} en retard · ${num(att.absent)} absent · ${num(att.excused)} excusé`, `${num(att.present)} حاضر · ${num(att.late)} متأخر · ${num(att.absent)} غائب · ${num(att.excused)} بعذر`)}
                </p>
              </>
            )}
            {att.recentIssues.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-sand-200 pt-3 text-sm">
                {att.recentIssues.map((a: any, i: number) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-brand-600">
                    <span>{date(a.date)} · {a.className}</span>
                    <Badge tone={a.status === 'ABSENT' ? 'bad' : 'warn'}>{attStatus[a.status] ?? a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Progression */}
          <Card>
            <CardTitle icon={<BookOpen className="size-4" />}>{t('Progression', 'التقدّم')}</CardTitle>
            <p className="num font-serif text-3xl font-bold text-brand-800">{num(d.progress.percent)} %</p>
            <div className="my-2"><ProgressBar value={d.progress.percent} tone="gold" label={t('Avancement global', 'التقدّم العام')} /></div>
            <div className="mt-4 space-y-3">
              {d.progress.pathways.map((p: any, i: number) => (
                <div key={i}>
                  <div className="mb-1 flex justify-between gap-3 text-sm"><span className="font-medium text-brand-700">{pick(p.titleFr, p.titleAr)}</span><span className="num text-brand-500">{num(p.doneCount)}/{num(p.total)}</span></div>
                  <ProgressBar value={p.percent} tone={p.percent >= 100 ? 'ok' : 'gold'} label={pick(p.titleFr, p.titleAr)} />
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-sand-200 pt-3 text-sm text-brand-600">
              <p className="font-semibold text-brand-700">{t(`Sourates validées : ${num(d.progress.memorization.validated)}`, `السور المعتمدة: ${num(d.progress.memorization.validated)}`)}{d.progress.memorization.inProgress > 0 && ` · ${t(`${num(d.progress.memorization.inProgress)} en cours`, `${num(d.progress.memorization.inProgress)} قيد الحفظ`)}`}</p>
              {d.progress.memorization.recent.length > 0 && (
                <p className="mt-1 text-brand-500">{d.progress.memorization.recent.map((m: any) => (locale === 'ar' ? m.nameAr : m.nameLatin)).join(' · ')}</p>
              )}
            </div>
          </Card>

          {/* Évaluations */}
          {d.evaluations.length > 0 && (
            <Card>
              <CardTitle icon={<Star className="size-4" />}>{t('Dernières évaluations', 'آخر التقييمات')}</CardTitle>
              <ul className="divide-y divide-sand-200">
                {d.evaluations.map((e: any, i: number) => (
                  <li key={i} className="py-2.5">
                    <div className="flex items-center justify-between gap-2"><span className="text-sm text-brand-500">{date(e.date)}</span><Badge tone="gold">{appr[e.appreciation] ?? e.appreciation}{e.score != null && ` · ${num(e.score)}`}</Badge></div>
                    {e.comment && <p className="mt-1 text-sm text-brand-600">{e.comment}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Cotisations */}
          <Card>
            <CardTitle icon={<Wallet className="size-4" />}>{t('Cotisations', 'الاشتراكات')}</CardTitle>
            <div className={`rounded-2xl p-3 ${d.finance.remainingCents > 0 ? (hasLate ? 'bg-bad-soft' : 'bg-warn-soft') : 'bg-ok-soft'}`}>
              <p className="text-sm text-brand-600">{d.finance.remainingCents > 0 ? t('Reste à payer', 'المتبقي للسداد') : t('Tout est à jour', 'كل شيء مسدَّد')}</p>
              <p className="num font-serif text-2xl font-bold text-brand-800">{money(d.finance.remainingCents)}</p>
            </div>
            {d.finance.dues.length > 0 && (
              <ul className="mt-3 divide-y divide-sand-200">
                {d.finance.dues.map((x: any, i: number) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0"><p className="truncate font-medium text-brand-700">{x.label}</p><p className="text-xs text-brand-400">{date(x.dueDate)}</p></div>
                    <div className="text-end"><p className="num text-sm font-semibold text-brand-700">{money(x.amountCents)}</p><Badge tone={STATUS_TONE[x.status] ?? 'neutral'}>{dueStatus[x.status] ?? x.status}</Badge></div>
                  </li>
                ))}
              </ul>
            )}
            {d.finance.payments.length > 0 && (
              <>
                <p className="mb-1 mt-4 text-sm font-semibold text-brand-700">{t('Paiements reçus', 'الدفعات المستلمة')}</p>
                <ul className="divide-y divide-sand-200">
                  {d.finance.payments.map((p: any, i: number) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0"><p className="num text-sm font-semibold text-brand-700">{money(p.amountCents)}</p><p className="text-xs text-brand-400">{date(p.date)} · {methods[p.method] ?? p.method}</p></div>
                      <a href={locale === 'ar' ? p.receiptUrlAr : p.receiptUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 rounded-xl bg-sand-100 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-sand-200">
                        <Printer className="size-3.5" /> {t('Reçu', 'الإيصال')} {p.receiptNumber}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* Contact */}
          <Card className="text-center">
            <p className="font-serif font-bold text-brand-800">{schoolName}</p>
            <p className="mt-1 text-sm text-brand-500">{t('Une question ? Contactez l’école.', 'سؤال؟ تواصل مع المدرسة.')}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {d.school.phone && (
                <a href={telLink(d.school.phone)} dir="ltr" className="inline-flex items-center gap-1.5 rounded-xl bg-sand-100 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-sand-200"><Phone className="size-4" /> {d.school.phone}</a>
              )}
            </div>
            <p className="mt-3 text-xs text-brand-400">{t(`Lien valable jusqu’au ${date(d.expiresAt)}`, `الرابط صالح حتى ${date(d.expiresAt)}`)}</p>
          </Card>
        </div>
      </Section>
    </>
  );
}
