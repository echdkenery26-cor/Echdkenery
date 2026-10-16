'use client';

import { Download, GraduationCap, Plus, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { StudentCard } from '@/components/app/student-card';
import { Button, LinkButton } from '@/components/ui/button';
import { PageHeader, Pagination } from '@/components/ui/display';
import { EmptyState, ErrorState, Modal, SkeletonCards, useToast } from '@/components/ui/feedback';
import { Chips, SearchBox, Select, Field } from '@/components/ui/form';
import { download } from '@/lib/api';
import { useApi, messageOf } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { useLookups } from '@/lib/lookups';
import { useUrlState } from '@/lib/url-state';

const PAGE = 24;

export default function StudentsPage() {
  const { t, pick, num } = useLocale();
  const toast = useToast();
  const { lk } = useLookups();
  const [f, set] = useUrlState({ q: '', audience: '', status: '', classId: '', levelId: '', paymentState: '', archived: '', page: '1' });
  const [filters, setFilters] = useState(false);

  const query = { q: f.q || undefined, audience: f.audience || undefined, status: f.status || undefined, classId: f.classId || undefined, levelId: f.levelId || undefined, paymentState: f.paymentState || undefined, archived: f.archived || undefined };
  const { data, error, loading, reload } = useApi<any>('/students', { ...query, page: Number(f.page), pageSize: PAGE });
  const advanced = [f.status, f.classId, f.levelId, f.paymentState, f.archived].filter(Boolean).length;

  async function exportList(format: 'xlsx' | 'csv') {
    try {
      await download('/exports/students', { ...query, format }, `eleves.${format}`);
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  return (
    <div>
      <PageHeader
        title={t('Élèves', 'الطلاب')}
        subtitle={data ? t(`${num(data.total)} élève(s)`, `${num(data.total)} طالباً`) : undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => exportList('xlsx')} icon={<Download className="size-4" />}>
              Excel
            </Button>
            <LinkButton href="/admin/students/new" variant="primary" icon={<Plus className="size-4" />}>
              {t('Nouvel élève', 'طالب جديد')}
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder={t('Nom, prénom ou téléphone…', 'الاسم أو الهاتف…')} className="flex-1" />
          <Button variant="outline" onClick={() => setFilters(true)} icon={<SlidersHorizontal className="size-4" />}>
            <span className="hidden sm:inline">{t('Filtres', 'تصفية')}</span>
            {advanced > 0 && <span className="num rounded-full bg-gold-500 px-1.5 text-xs font-bold text-brand-800">{num(advanced)}</span>}
          </Button>
        </div>
        <Chips
          value={f.audience}
          onChange={(v) => set({ audience: v })}
          options={[
            { value: '', label: t('Tous', 'الكل') },
            { value: 'CHILD', label: t('Enfants', 'الأطفال') },
            { value: 'ADULT', label: t('Adultes', 'الكبار') },
          ]}
        />
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={6} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-6" />}
          title={t('Aucun élève trouvé', 'لا يوجد طلاب')}
          text={f.q || advanced || f.audience ? t('Essayez d’autres filtres ou une autre recherche.', 'جرّب مرشّحات أخرى أو بحثاً مختلفاً.') : t('Ajoutez le premier élève de l’école.', 'أضف أول طالب في المدرسة.')}
          action={<LinkButton href="/admin/students/new" variant="primary" icon={<Plus className="size-4" />}>{t('Nouvel élève', 'طالب جديد')}</LinkButton>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((s: any) => (
              <StudentCard key={s.id} s={s} href={`/admin/students/${s.id}`} />
            ))}
          </div>
          <Pagination page={Number(f.page)} pageSize={PAGE} total={data.total} onChange={(p) => set({ page: String(p) }, false)} />
        </>
      )}

      <Modal
        open={filters}
        onClose={() => setFilters(false)}
        title={t('Filtres', 'تصفية')}
        footer={
          <>
            <Button variant="ghost" onClick={() => set({ status: '', classId: '', levelId: '', paymentState: '', archived: '' })}>
              {t('Réinitialiser', 'إعادة تعيين')}
            </Button>
            <Button variant="primary" onClick={() => setFilters(false)}>
              {t('Voir les résultats', 'عرض النتائج')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('Statut', 'الحالة')}>
            <Select value={f.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="">{t('Tous les statuts', 'كل الحالات')}</option>
              <option value="ENROLLED">{t('Inscrit', 'مسجّل')}</option>
              <option value="PREREGISTERED">{t('Préinscrit', 'تسجيل مسبق')}</option>
              <option value="WAITLIST">{t('Liste d’attente', 'قائمة الانتظار')}</option>
              <option value="SUSPENDED">{t('Suspendu', 'موقوف')}</option>
              <option value="LEFT">{t('Parti', 'غادر')}</option>
            </Select>
          </Field>
          <Field label={t('Classe', 'القسم')}>
            <Select value={f.classId} onChange={(e) => set({ classId: e.target.value })}>
              <option value="">{t('Toutes les classes', 'كل الأقسام')}</option>
              {lk?.classes.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('Niveau', 'المستوى')}>
            <Select value={f.levelId} onChange={(e) => set({ levelId: e.target.value })}>
              <option value="">{t('Tous les niveaux', 'كل المستويات')}</option>
              {lk?.levels.map((l) => (
                <option key={l.id} value={l.id}>{pick(l.labelFr, l.labelAr)}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('Paiements', 'المدفوعات')}>
            <Select value={f.paymentState} onChange={(e) => set({ paymentState: e.target.value })}>
              <option value="">{t('Tous', 'الكل')}</option>
              <option value="late">{t('En retard de paiement', 'متأخرون في السداد')}</option>
              <option value="ok">{t('À jour', 'محدَّث')}</option>
            </Select>
          </Field>
          <Field label={t('Dossiers', 'الملفات')}>
            <Select value={f.archived} onChange={(e) => set({ archived: e.target.value })}>
              <option value="">{t('Dossiers actifs', 'الملفات النشطة')}</option>
              <option value="true">{t('Archives', 'الأرشيف')}</option>
            </Select>
          </Field>
          <div className="pt-1">
            <Button variant="outline" onClick={() => exportList('csv')} icon={<Download className="size-4" />}>CSV</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
