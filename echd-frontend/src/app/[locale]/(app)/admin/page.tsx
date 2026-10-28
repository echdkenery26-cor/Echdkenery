//echd-frontend/src/app/[locale]/(app)/admin/page.tsx
'use client';

import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardX, GraduationCap, Hourglass, Megaphone, UserPlus, Users, Wallet } from 'lucide-react';
import { BalanceHero } from '@/components/app/balance-hero';
import { CollectionsCard } from '@/components/app/collections-card';
import { SessionCard } from '@/components/app/session-card';
import { Badge, Card, CardTitle, SectionTitle, StatCard } from '@/components/ui/display';
import { Link } from '@/components/ui/button';
import { EmptyState, ErrorState, SkeletonCards } from '@/components/ui/feedback';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { todayISO } from '@/lib/locale';

export default function DashboardPage() {
  const { t, pick, date, money, num } = useLocale();
  const { data, error, loading, reload } = useApi<any>('/dashboard');

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data) return <SkeletonCards n={6} />;

  const k = data.kpis;
  const todo = data.todo;

  return (
    <div className="space-y-6">
      <BalanceHero today={date(data.today || todayISO(), 'long')} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<GraduationCap />} value={num(k.students.total)} label={t('Élèves inscrits', 'الطلاب المسجّلون')} hint={`${num(k.students.children)} ${t('enfants', 'أطفال')} · ${num(k.students.adults)} ${t('adultes', 'كبار')}`} href="/admin/students" />
        <StatCard icon={<Users />} tone="gold" value={num(k.seatsLeft)} label={t('Places libres', 'مقاعد شاغرة')} hint={t(`sur ${num(k.seatsTotal)}`, `من أصل ${num(k.seatsTotal)}`)} href="/admin/classes" />
        <StatCard icon={<UserPlus />} tone={k.newPreRegistrations ? 'warn' : 'neutral'} value={num(k.newPreRegistrations)} label={t('Nouvelles préinscriptions', 'طلبات جديدة')} href="/admin/pre-registrations" />
        <StatCard icon={<AlertTriangle />} tone={k.lateStudents ? 'bad' : 'ok'} value={num(k.lateStudents)} label={t('Élèves en retard', 'طلاب متأخرون')} hint={t('de paiement', 'في السداد')} href="/admin/finance?state=late" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        {/* À traiter */}
        <Card className="!p-0">
          <div className="p-4 pb-2 sm:p-5 sm:pb-2">
            <CardTitle icon={<ClipboardX className="size-4" />} action={todo.total > 0 && <Badge tone="gold">{num(todo.total)}</Badge>}>
              {t('À traiter', 'للمعالجة')}
            </CardTitle>
          </div>
          {todo.total === 0 ? (
            <div className="flex items-center gap-3 px-5 pb-6 text-ok">
              <CheckCircle2 className="size-6" />
              <p className="font-semibold">{t('Tout est à jour. Rien en attente.', 'كل شيء محدَّث. لا شيء في الانتظار.')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-sand-200 pb-2">
              {todo.preRegistrations.count > 0 && (
                <TodoGroup icon={<UserPlus className="size-4" />} tone="gold" title={t('Préinscriptions à traiter', 'طلبات تسجيل مسبق')} count={todo.preRegistrations.count} href="/admin/pre-registrations">
                  {todo.preRegistrations.items.map((p: any) => (
                    <TodoRow key={p.id} href={`/admin/pre-registrations?open=${p.id}`} title={p.names} meta={`${p.reference} · ${p.waitingDays > 0 ? t(`${num(p.waitingDays)} j`, `${num(p.waitingDays)} ي`) : t('aujourd’hui', 'اليوم')}`} />
                  ))}
                </TodoGroup>
              )}
              {todo.lateDues.students > 0 && (
                <TodoGroup icon={<Wallet className="size-4" />} tone="bad" title={t('Cotisations en retard', 'اشتراكات متأخرة')} count={todo.lateDues.students} href="/admin/finance?state=late" extra={money(todo.lateDues.remainingCents)}>
                  {todo.lateDues.items.map((d: any) => (
                    <TodoRow key={d.student.id} href={`/admin/students/${d.student.id}?tab=finance`} title={`${d.student.firstName} ${d.student.lastName}`} meta={`${money(d.remainingCents)} · ${t(`${num(d.daysLate)} j de retard`, `${num(d.daysLate)} يوماً تأخير`)}`} />
                  ))}
                </TodoGroup>
              )}
              {todo.absences.count > 0 && (
                <TodoGroup icon={<ClipboardX className="size-4" />} tone="warn" title={t('Absences répétées', 'غيابات متكررة')} count={todo.absences.count} href="/admin/attendance">
                  {todo.absences.items.map((a: any) => (
                    <TodoRow key={a.studentId} href={`/admin/students/${a.studentId}?tab=attendance`} title={a.name} meta={`${a.className} · ${t(`${num(a.count)} absences d’affilée`, `${num(a.count)} غيابات متتالية`)}`} />
                  ))}
                </TodoGroup>
              )}
              {todo.fullClasses.count > 0 && (
                <TodoGroup icon={<Users className="size-4" />} tone="info" title={t('Classes complètes', 'أقسام ممتلئة')} count={todo.fullClasses.count} href="/admin/classes">
                  {todo.fullClasses.items.map((c: any) => (
                    <TodoRow key={c.id} href={`/admin/classes/${c.id}`} title={c.name} meta={`${num(c.active)}/${num(c.capacity)}${c.waitlist ? ` · ${num(c.waitlist)} ${t('en attente', 'في الانتظار')}` : ''}`} />
                  ))}
                </TodoGroup>
              )}
              {todo.studentsWithoutClass.count > 0 && (
                <TodoGroup icon={<Hourglass className="size-4" />} tone="warn" title={t('Élèves sans classe', 'طلاب بلا قسم')} count={todo.studentsWithoutClass.count} href="/admin/students">
                  {todo.studentsWithoutClass.items.map((s: any) => (
                    <TodoRow key={s.id} href={`/admin/students/${s.id}`} title={`${s.firstName} ${s.lastName}`} meta={t('À inscrire dans une classe', 'يحتاج إلى تسجيل في قسم')} />
                  ))}
                </TodoGroup>
              )}
              {todo.yearEnd && (
                <TodoGroup icon={<CalendarClock className="size-4" />} tone="info" title={t('Fin d’année scolaire', 'نهاية العام الدراسي')} count={1} href="/admin/settings">
                  <TodoRow href="/admin/settings" title={todo.yearEnd.name} meta={t(`Dans ${num(todo.yearEnd.daysLeft)} jours : préparez la nouvelle année`, `بعد ${num(todo.yearEnd.daysLeft)} يوماً: جهّزوا السنة الجديدة`)} />
                </TodoGroup>
              )}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <CollectionsCard />

          {data.recentAnnouncements?.length > 0 && (
            <Card>
              <CardTitle icon={<Megaphone className="size-4" />} action={<Link href="/admin/announcements" className="text-sm font-semibold text-brand-600 hover:underline">{t('Tout voir', 'عرض الكل')}</Link>}>
                {t('Annonces', 'الإعلانات')}
              </CardTitle>
              <ul className="space-y-2.5">
                {data.recentAnnouncements.map((a: any) => (
                  <li key={a.id}>
                    <Link href={`/admin/announcements?open=${a.id}`} className="flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-brand-50">
                      <span className="min-w-0 truncate text-sm font-medium text-brand-800">{pick(a.titleFr, a.titleAr)}</span>
                      <Badge tone={a.status === 'PUBLISHED' ? 'ok' : 'neutral'}>{a.status === 'PUBLISHED' ? t('En ligne', 'منشور') : t('Brouillon', 'مسودة')}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <section>
        <SectionTitle action={<Link href="/admin/timetable" className="text-sm font-semibold text-brand-600 hover:underline">{t('Emploi du temps', 'الجدول')}</Link>}>
          {t('Prochaines séances', 'الحصص القادمة')}
        </SectionTitle>
        {data.nextSessions?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.nextSessions.slice(0, 6).map((s: any) => (
              <SessionCard key={`${s.slotId}-${s.date}`} s={s} href={`/admin/attendance?classId=${s.classId}&date=${s.date}`} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<CalendarClock className="size-6" />} title={t('Aucune séance prévue', 'لا توجد حصص مبرمجة')} text={t('Créez des classes avec leurs créneaux pour voir le planning ici.', 'أنشئوا أقساماً بمواعيدها لتظهر الحصص هنا.')} />
        )}
      </section>
    </div>
  );
}

function TodoGroup({ icon, tone, title, count, href, extra, children }: { icon: React.ReactNode; tone: 'gold' | 'bad' | 'warn' | 'info'; title: string; count: number; href: string; extra?: string; children: React.ReactNode }) {
  const { num } = useLocale();
  const bubble = { gold: 'bg-gold-200 text-gold-700', bad: 'bg-bad-soft text-bad', warn: 'bg-warn-soft text-warn', info: 'bg-info-soft text-info' }[tone];
  return (
    <li className="px-4 py-3 sm:px-5">
      <Link href={href} className="mb-1.5 flex items-center gap-3">
        <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${bubble}`}>{icon}</span>
        <span className="flex-1 font-semibold text-brand-800">{title}</span>
        {extra && <span className="num text-sm font-semibold text-bad">{extra}</span>}
        <span className="num rounded-full bg-sand-200 px-2.5 py-0.5 text-sm font-bold text-brand-600">{num(count)}</span>
      </Link>
      <ul className="ms-11 space-y-0.5">{children}</ul>
    </li>
  );
}

function TodoRow({ href, title, meta }: { href: string; title: string; meta: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-11 flex-col justify-center rounded-lg px-2 py-1 hover:bg-brand-50 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <span className="text-sm font-medium text-brand-700">{title}</span>
        <span className="text-xs text-brand-400">{meta}</span>
      </Link>
    </li>
  );
}
