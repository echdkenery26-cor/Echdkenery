import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../../common/decorators';
import { FilesService } from '../../common/files.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { ageOn, fullName, ymd } from '../../common/utils';
import { TimetableService } from '../academic/timetable.service';
import { ProgressService } from '../progress/progress.service';

export type DocType = 'receipt' | 'student-sheet' | 'timetable' | 'bulletin';
export type Lang = 'fr' | 'ar';

/** Utilisateur technique pour les liens partagés signés (lecture seule). */
export const SHARE_USER: AuthUser = {
  id: 'share-link',
  username: 'share',
  email: null,
  firstName: 'Lien',
  lastName: 'partagé',
  role: Role.ADMIN,
  language: 'fr',
  teacherId: null,
  mustChangePassword: false,
};

const L = {
  fr: {
    receipt: 'Reçu de paiement',
    sheet: "Fiche d'inscription",
    timetable: 'Emploi du temps',
    bulletin: 'Bulletin',
    receiptNo: 'Reçu n°',
    date: 'Date',
    student: 'Élève',
    label: 'Objet',
    amount: 'Montant payé',
    method: 'Mode de paiement',
    reference: 'Référence',
    remaining: "Reste à payer sur l'échéance",
    enteredBy: 'Saisi par',
    cancelled: 'ANNULÉ',
    cancelReason: "Motif d'annulation",
    signature: 'Signature',
    thanks: 'Merci pour votre confiance.',
    identity: 'Identité',
    contact: 'Contact',
    phone: 'Téléphone',
    email: 'E-mail',
    address: 'Adresse',
    birth: 'Né(e) le',
    age: 'Âge',
    years: 'ans',
    gender: 'Sexe',
    male: 'Masculin',
    female: 'Féminin',
    audience: 'Public',
    child: 'Enfant',
    adult: 'Adulte',
    guardians: 'Responsable(s) légal(aux)',
    level: 'Niveau',
    startLevel: 'Niveau de départ',
    classes: 'Classes',
    consents: 'Consentements',
    gdpr: 'Consentement RGPD',
    imageRights: "Droit à l'image",
    yes: 'Oui',
    no: 'Non',
    enrolledOn: "Date d'inscription",
    parentSignature: 'Signature du responsable / de l’élève',
    day: 'Jour',
    hours: 'Horaires',
    course: 'Cours',
    teacher: 'Enseignant',
    room: 'Salle',
    term: 'Trimestre',
    period: 'Période',
    schoolYear: 'Année scolaire',
    progress: 'Progression',
    memorization: 'Mémorisation du Coran',
    validatedInTerm: 'Sourates validées ce trimestre',
    validatedTotal: 'Sourates validées au total',
    evaluations: 'Évaluations',
    attendance: 'Assiduité',
    present: 'Présent',
    absent: 'Absent',
    late: 'Retard',
    excused: 'Excusé',
    rate: "Taux d'assiduité",
    comments: "Commentaires de l'enseignant",
    none: '—',
    steps: 'étapes acquises',
    director: 'La direction',
    parents: 'Parents / élève',
    print: 'Imprimer / Enregistrer en PDF',
    status: { TODO: 'À commencer', IN_PROGRESS: 'En cours', DONE: 'Acquis' } as Record<string, string>,
    appr: { TO_REVIEW: 'À revoir', GOOD: 'Bien', VERY_GOOD: 'Très bien', EXCELLENT: 'Excellent' } as Record<string, string>,
    methods: { CASH: 'Espèces', CHEQUE: 'Chèque', TRANSFER: 'Virement', CARD: 'Carte (sur place)' } as Record<string, string>,
    days: ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
    surah: 'Sourate',
  },
  ar: {
    receipt: 'إيصال دفع',
    sheet: 'استمارة التسجيل',
    timetable: 'الجدول الزمني',
    bulletin: 'كشف التقدّم',
    receiptNo: 'إيصال رقم',
    date: 'التاريخ',
    student: 'الطالب',
    label: 'البيان',
    amount: 'المبلغ المدفوع',
    method: 'طريقة الدفع',
    reference: 'المرجع',
    remaining: 'المتبقي من هذا الاستحقاق',
    enteredBy: 'سجّله',
    cancelled: 'ملغى',
    cancelReason: 'سبب الإلغاء',
    signature: 'التوقيع',
    thanks: 'شكراً لثقتكم.',
    identity: 'الهوية',
    contact: 'الاتصال',
    phone: 'الهاتف',
    email: 'البريد الإلكتروني',
    address: 'العنوان',
    birth: 'تاريخ الميلاد',
    age: 'العمر',
    years: 'سنة',
    gender: 'الجنس',
    male: 'ذكر',
    female: 'أنثى',
    audience: 'الفئة',
    child: 'طفل',
    adult: 'بالغ',
    guardians: 'ولي الأمر',
    level: 'المستوى',
    startLevel: 'مستوى البداية',
    classes: 'الأقسام',
    consents: 'الموافقات',
    gdpr: 'الموافقة على معالجة البيانات',
    imageRights: 'حقوق الصورة',
    yes: 'نعم',
    no: 'لا',
    enrolledOn: 'تاريخ التسجيل',
    parentSignature: 'توقيع ولي الأمر / الطالب',
    day: 'اليوم',
    hours: 'الوقت',
    course: 'المادة',
    teacher: 'المعلّم',
    room: 'القاعة',
    term: 'الفصل',
    period: 'الفترة',
    schoolYear: 'السنة الدراسية',
    progress: 'التقدّم',
    memorization: 'حفظ القرآن الكريم',
    validatedInTerm: 'السور المعتمدة هذا الفصل',
    validatedTotal: 'مجموع السور المعتمدة',
    evaluations: 'التقييمات',
    attendance: 'الحضور',
    present: 'حاضر',
    absent: 'غائب',
    late: 'متأخر',
    excused: 'غياب بعذر',
    rate: 'نسبة الحضور',
    comments: 'ملاحظات المعلّم',
    none: '—',
    steps: 'مراحل مكتسبة',
    director: 'الإدارة',
    parents: 'ولي الأمر / الطالب',
    print: 'طباعة / حفظ PDF',
    status: { TODO: 'لم يبدأ', IN_PROGRESS: 'قيد التعلّم', DONE: 'مكتسب' } as Record<string, string>,
    appr: { TO_REVIEW: 'يحتاج مراجعة', GOOD: 'جيد', VERY_GOOD: 'جيد جداً', EXCELLENT: 'ممتاز' } as Record<string, string>,
    methods: { CASH: 'نقداً', CHEQUE: 'شيك', TRANSFER: 'تحويل بنكي', CARD: 'بطاقة' } as Record<string, string>,
    days: ['', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'],
    surah: 'سورة',
  },
};

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    private files: FilesService,
    private progress: ProgressService,
    private timetable: TimetableService,
  ) {}

  /** Vérifie que l'utilisateur a le droit de produire ce document. */
  async assertAllowed(type: DocType, id: string, user: AuthUser) {
    if (type === 'receipt' || type === 'student-sheet') {
      if (user.role === Role.TEACHER) throw new ForbiddenException('Document réservé à l’administration.');
    }
  }

  async render(type: DocType, id: string, lang: Lang, user: AuthUser, term?: number): Promise<string> {
    await this.assertAllowed(type, id, user);
    const ctx = await this.context(lang);
    switch (type) {
      case 'receipt':
        return this.receipt(id, ctx);
      case 'student-sheet':
        return this.studentSheet(id, ctx);
      case 'timetable':
        return this.timetableDoc(id, ctx, user);
      case 'bulletin':
        return this.bulletin(id, ctx, user, term ?? 1);
      default:
        throw new BadRequestException('Type de document inconnu.');
    }
  }

  /* ═══════════════ Contexte & mise en page ═══════════════ */

  private async context(lang: Lang) {
    const s = await this.settings.getMany([
      'institute.name',
      'institute.address',
      'institute.phone',
      'institute.email',
      'institute.logo',
      'institute.currency',
      'display.arabicIndicDigits',
    ]);
    const ar = lang === 'ar';
    const locale = ar ? 'ar-u-nu-latn' : 'fr-FR';
    const indic = ar && !!s['display.arabicIndicDigits'];
    const toIndic = (str: string) => str.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
    const d = (v: string | number) => (indic ? toIndic(String(v)) : String(v));
    return {
      lang,
      ar,
      t: L[lang],
      name: s['institute.name'][lang] || s['institute.name'].fr,
      address: s['institute.address'][lang] || s['institute.address'].fr,
      phone: s['institute.phone'] as string,
      email: s['institute.email'] as string,
      logo: this.files.url(s['institute.logo']),
      d,
      date: (v: Date | string) => d(new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(v))),
      money: (cents: number) => d(new Intl.NumberFormat(locale, { style: 'currency', currency: s['institute.currency'] }).format(cents / 100)),
      pick: (fr: string, arText?: string | null) => (ar && arText ? arText : fr),
    };
  }

  private layout(ctx: Awaited<ReturnType<DocumentsService['context']>>, title: string, body: string, watermark?: string) {
    const dir = ctx.ar ? 'rtl' : 'ltr';
    const fonts = `
@font-face{font-family:'Figtree';font-weight:400;src:url('/api/assets/fonts/figtree-latin-400-normal.woff2') format('woff2')}
@font-face{font-family:'Figtree';font-weight:600;src:url('/api/assets/fonts/figtree-latin-600-normal.woff2') format('woff2')}
@font-face{font-family:'Figtree';font-weight:700;src:url('/api/assets/fonts/figtree-latin-700-normal.woff2') format('woff2')}
@font-face{font-family:'Noto Serif';font-weight:700;src:url('/api/assets/fonts/noto-serif-latin-700-normal.woff2') format('woff2')}
@font-face{font-family:'Noto Naskh Arabic';font-weight:400;src:url('/api/assets/fonts/noto-naskh-arabic-arabic-400-normal.woff2') format('woff2')}
@font-face{font-family:'Noto Naskh Arabic';font-weight:700;src:url('/api/assets/fonts/noto-naskh-arabic-arabic-700-normal.woff2') format('woff2')}`;
    return `<!doctype html>
<html lang="${ctx.lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — ${esc(ctx.name)}</title>
<style>${fonts}
:root{--g:#1F4A3A;--gd:#122B23;--gold:#CFAE55;--cream:#FDFCF7;--beige:#F3EDDC;--line:#e3dcc3}
*{box-sizing:border-box}
body{margin:0;background:#e9e6da;color:var(--gd);font-family:${ctx.ar ? "'Noto Naskh Arabic'," : ''}'Figtree',system-ui,sans-serif;font-size:14px;line-height:1.55}
.page{position:relative;max-width:794px;margin:16px auto;background:#fff;padding:32px 36px;box-shadow:0 2px 14px rgba(0,0,0,.12);min-height:1000px}
h1,h2,h3{font-family:${ctx.ar ? "'Noto Naskh Arabic'," : ''}'Noto Serif',serif;color:var(--g);margin:0}
header{display:flex;align-items:center;gap:16px;border-bottom:3px solid var(--gold);padding-bottom:14px;margin-bottom:18px}
header img{height:56px;width:auto;border-radius:8px}
header .org{flex:1}header .org b{font-size:17px;color:var(--g)}header .org div{font-size:12px;color:#5b6b63}
.doc-title{font-size:22px;margin:4px 0 14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
.kv{padding:6px 0;border-bottom:1px solid var(--line)}.kv span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b776f}.kv b{font-weight:600}
.box{background:var(--cream);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:12px 0}
.big{font-size:26px;font-weight:700;color:var(--g)}
table{width:100%;border-collapse:collapse;margin:8px 0}th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:start;vertical-align:top}th{background:var(--beige);font-size:12px}
.bar{height:10px;background:var(--beige);border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:var(--g)}
.tag{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;background:var(--beige)}.tag.done{background:#d9efe2;color:#14532d}.tag.prog{background:#fbf0cf;color:#6b4f00}
.sign{display:flex;gap:40px;margin-top:48px}.sign div{flex:1;border-top:1px solid var(--gd);padding-top:6px;font-size:12px;color:#5b6b63}
.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:120px;font-weight:700;color:rgba(200,30,30,.13);transform:rotate(-24deg);pointer-events:none}
footer{margin-top:28px;font-size:11px;color:#6b776f;text-align:center}
.btn{position:fixed;inset-block-end:16px;inset-inline-end:16px;background:var(--gold);color:var(--gd);border:0;border-radius:99px;padding:12px 20px;font:600 14px inherit;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2)}
h2{font-size:16px;margin:20px 0 6px}
@media print{body{background:#fff}.page{box-shadow:none;margin:0;max-width:none;padding:0;min-height:0}.btn{display:none}@page{size:A4;margin:14mm}}
</style></head><body>
<div class="page">
${watermark ? `<div class="wm">${esc(watermark)}</div>` : ''}
<header>${ctx.logo ? `<img src="${esc(ctx.logo)}" alt="">` : ''}
<div class="org"><b>${esc(ctx.name)}</b><div>${esc([ctx.address, ctx.phone, ctx.email].filter(Boolean).join(' · '))}</div></div></header>
<h1 class="doc-title">${esc(title)}</h1>
${body}
<footer>${esc(ctx.name)}</footer>
</div>
<button class="btn" onclick="window.print()">${esc(ctx.t.print)}</button>
</body></html>`;
  }

  private kv(label: string, value: unknown) {
    return `<div class="kv"><span>${esc(label)}</span><b>${esc(value || '—')}</b></div>`;
  }

  /* ═══════════════ Reçu ═══════════════ */

  private async receipt(paymentId: string, c: Awaited<ReturnType<DocumentsService['context']>>) {
    const p = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { student: true, due: true },
    });
    if (!p) throw new NotFoundException('Paiement introuvable.');
    const t = c.t;
    const remaining = p.due.amountCents - p.due.paidCents;
    const body = `
<div class="box">
  <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap">
    <div><div style="font-size:12px;color:#6b776f">${esc(t.receiptNo)}</div><div class="big">${esc(p.receiptNumber)}</div></div>
    <div><div style="font-size:12px;color:#6b776f">${esc(t.amount)}</div><div class="big">${esc(c.money(p.amountCents))}</div></div>
  </div>
</div>
<div class="grid">
${this.kv(t.date, c.date(p.paidAt))}
${this.kv(t.student, fullName(p.student) + (c.ar && p.student.arabicName ? ` — ${p.student.arabicName}` : ''))}
${this.kv(t.label, p.periodCovered || p.due.label)}
${this.kv(t.method, t.methods[p.method])}
${p.reference ? this.kv(t.reference, p.reference) : ''}
${this.kv(t.remaining, c.money(Math.max(remaining, 0)))}
${p.createdByLabel ? this.kv(t.enteredBy, p.createdByLabel) : ''}
${p.cancelledAt ? this.kv(t.cancelReason, p.cancelReason) : ''}
</div>
<div class="sign"><div>${esc(t.signature)} — ${esc(c.name)}</div></div>
<p style="margin-top:24px;color:#5b6b63">${esc(t.thanks)}</p>`;
    return this.layout(c, t.receipt, body, p.cancelledAt ? t.cancelled : undefined);
  }

  /* ═══════════════ Fiche d'inscription ═══════════════ */

  private async studentSheet(studentId: string, c: Awaited<ReturnType<DocumentsService['context']>>) {
    const s = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        guardians: true,
        startLevel: true,
        currentLevel: true,
        enrollments: {
          where: { status: { in: ['ACTIVE', 'WAITLIST'] } },
          include: { class: { include: { course: true, teacher: true, slots: true } } },
        },
      },
    });
    if (!s) throw new NotFoundException('Élève introuvable.');
    const t = c.t;
    const today = await this.settings.today();
    const photo = this.files.url(s.photo, 3600);
    const age = ageOn(s.birthDate, today);
    const classes = s.enrollments
      .map((e) => {
        const slots = e.class.slots
          .sort((a, b) => a.weekday - b.weekday)
          .map((x) => `${t.days[x.weekday]} ${c.d(x.startTime)}–${c.d(x.endTime)}`)
          .join(' · ');
        return `<tr><td>${esc(c.pick(e.class.course.titleFr, e.class.course.titleAr))}</td><td>${esc(e.class.name)}</td><td>${esc(slots)}</td><td>${esc(e.class.teacher ? fullName(e.class.teacher) : '—')}</td></tr>`;
      })
      .join('');
    const body = `
<div style="display:flex;gap:18px;align-items:flex-start">
  ${photo ? `<img src="${esc(photo)}" alt="" style="width:110px;height:110px;object-fit:cover;border-radius:14px;border:2px solid var(--gold)">` : ''}
  <div class="grid" style="flex:1">
    ${this.kv(t.student, fullName(s))}
    ${this.kv('الاسم', s.arabicName)}
    ${this.kv(t.birth, s.birthDate ? `${c.date(s.birthDate)}${age !== null ? ` (${c.d(age)} ${t.years})` : ''}` : '')}
    ${this.kv(t.gender, s.gender ? (s.gender === 'MALE' ? t.male : t.female) : '')}
    ${this.kv(t.audience, s.audience === 'CHILD' ? t.child : t.adult)}
    ${this.kv(t.startLevel, s.startLevel ? c.pick(s.startLevel.labelFr, s.startLevel.labelAr) : '')}
  </div>
</div>
<h2>${esc(t.contact)}</h2>
<div class="grid">
  ${this.kv(t.phone, s.phone)}
  ${this.kv(t.email, s.email)}
  ${this.kv(t.address, [s.address, s.postalCode, s.city].filter(Boolean).join(', '))}
  ${this.kv(t.enrolledOn, s.enrolledAt ? c.date(s.enrolledAt) : '')}
</div>
${s.guardians.length ? `<h2>${esc(t.guardians)}</h2><table><tbody>${s.guardians.map((g) => `<tr><td><b>${esc(g.name)}</b> ${g.relationship ? `(${esc(g.relationship)})` : ''}</td><td>${esc(g.phone)}</td><td>${esc(g.email)}</td></tr>`).join('')}</tbody></table>` : ''}
<h2>${esc(t.classes)}</h2>
<table><thead><tr><th>${esc(t.course)}</th><th>${esc(t.classes)}</th><th>${esc(t.hours)}</th><th>${esc(t.teacher)}</th></tr></thead><tbody>${classes || `<tr><td colspan="4">${esc(t.none)}</td></tr>`}</tbody></table>
<h2>${esc(t.consents)}</h2>
<div class="grid">${this.kv(t.gdpr, s.gdprConsentAt ? `${t.yes} — ${c.date(s.gdprConsentAt)}` : t.no)}${this.kv(t.imageRights, s.imageRightsConsent ? t.yes : t.no)}</div>
<div class="sign"><div>${esc(t.parentSignature)}</div><div>${esc(t.director)}</div></div>`;
    return this.layout(c, t.sheet, body);
  }

  /* ═══════════════ Emploi du temps ═══════════════ */

  private async timetableDoc(studentId: string, c: Awaited<ReturnType<DocumentsService['context']>>, user: AuthUser) {
    const s = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!s) throw new NotFoundException('Élève introuvable.');
    const tt = await this.timetable.get({ studentId }, user);
    const t = c.t;
    const rows = tt.slots
      .map(
        (x) =>
          `<tr><td><b>${esc(t.days[x.weekday])}</b></td><td>${esc(c.d(x.startTime))} – ${esc(c.d(x.endTime))}</td><td>${esc(c.pick(x.course.titleFr, x.course.titleAr))}<div style="font-size:12px;color:#6b776f">${esc(x.className)}</div></td><td>${esc(x.teacher ? fullName(x.teacher) : '—')}</td><td>${esc(x.room ? c.pick(x.room.name, x.room.nameAr) : '—')}</td></tr>`,
      )
      .join('');
    const upcoming = tt.occurrences
      .filter((o) => o.status !== 'NORMAL')
      .slice(0, 8)
      .map((o) => `<li>${esc(c.date(o.date))} — ${o.status === 'CANCELLED' ? esc(c.ar ? 'ملغى' : 'cours annulé') : o.status === 'MOVED' ? esc(c.ar ? `موعد جديد ${o.startTime}–${o.endTime}` : `déplacé ${o.startTime}–${o.endTime}`) : esc(c.ar ? 'مغلق' : 'fermé')}${o.reason ? ` (${esc(o.reason)})` : ''}</li>`)
      .join('');
    const body = `
<div class="grid">${this.kv(t.student, fullName(s) + (c.ar && s.arabicName ? ` — ${s.arabicName}` : ''))}</div>
<table><thead><tr><th>${esc(t.day)}</th><th>${esc(t.hours)}</th><th>${esc(t.course)}</th><th>${esc(t.teacher)}</th><th>${esc(t.room)}</th></tr></thead><tbody>${rows || `<tr><td colspan="5">${esc(t.none)}</td></tr>`}</tbody></table>
${upcoming ? `<h2>${esc(c.ar ? 'تغييرات قادمة' : 'Changements à venir')}</h2><ul>${upcoming}</ul>` : ''}`;
    return this.layout(c, t.timetable, body);
  }

  /* ═══════════════ Bulletin trimestriel ═══════════════ */

  private async bulletin(studentId: string, c: Awaited<ReturnType<DocumentsService['context']>>, user: AuthUser, term: number) {
    const b = await this.progress.bulletinData(studentId, term, user);
    const t = c.t;
    const s = b.student;
    const classes = s.enrollments.map((e) => `${c.pick(e.class.course.titleFr, e.class.course.titleAr)} — ${e.class.name}`).join(' · ');
    const pathways = b.progress.pathways
      .map(
        (p) => `
<div class="box">
  <div style="display:flex;justify-content:space-between;gap:12px"><b>${esc(c.pick(p.pathway.titleFr, p.pathway.titleAr))}</b><b>${esc(c.d(p.percent))}%</b></div>
  <div class="bar" style="margin:6px 0 8px"><i style="width:${p.percent}%"></i></div>
  <div style="font-size:12px;color:#5b6b63">${esc(c.d(p.doneCount))} / ${esc(c.d(p.total))} ${esc(t.steps)}</div>
  <div style="margin-top:6px">${p.steps.map((st) => `<span class="tag ${st.status === 'DONE' ? 'done' : st.status === 'IN_PROGRESS' ? 'prog' : ''}" style="margin:2px">${esc(c.pick(st.titleFr, st.titleAr))} · ${esc(t.status[st.status])}</span>`).join('')}</div>
</div>`,
      )
      .join('');
    const memo = b.validatedSurahsInTerm.map((m) => esc(c.ar ? m.nameAr : m.nameLatin)).join('، ');
    const evals = b.evaluations
      .map((e) => `<tr><td>${esc(c.date(e.date))}</td><td><b>${esc(t.appr[e.appreciation])}</b>${e.score != null ? ` · ${esc(c.d(e.score))}` : ''}</td><td>${esc(e.comment)}</td></tr>`)
      .join('');
    const a = b.attendance;
    const body = `
<div class="grid">
  ${this.kv(t.student, fullName(s) + (c.ar && s.arabicName ? ` — ${s.arabicName}` : ''))}
  ${this.kv(t.schoolYear, b.year.name)}
  ${this.kv(t.term, `${c.d(b.term.index)} (${c.date(b.term.start)} → ${c.date(b.term.end)})`)}
  ${this.kv(t.level, b.progress.level.current ? c.pick(b.progress.level.current.labelFr, b.progress.level.current.labelAr) : '')}
  ${this.kv(t.classes, classes)}
</div>
<h2>${esc(t.progress)} — ${esc(c.d(b.progress.percent))}%</h2>
${pathways || `<p>${esc(t.none)}</p>`}
<h2>${esc(t.memorization)}</h2>
<div class="grid">${this.kv(t.validatedInTerm, memo)}${this.kv(t.validatedTotal, c.d(b.progress.memorizationSummary.validated))}</div>
<h2>${esc(t.attendance)}</h2>
<div class="grid">${this.kv(t.rate, a.rate === null ? '—' : `${c.d(a.rate)}%`)}${this.kv(`${t.present} / ${t.late} / ${t.absent} / ${t.excused}`, `${c.d(a.present)} / ${c.d(a.late)} / ${c.d(a.absent)} / ${c.d(a.excused)}`)}</div>
<h2>${esc(t.evaluations)}</h2>
<table><tbody>${evals || `<tr><td>${esc(t.none)}</td></tr>`}</tbody></table>
<div class="sign"><div>${esc(t.director)}</div><div>${esc(t.parents)}</div></div>`;
    return this.layout(c, `${t.bulletin} — ${t.term} ${c.d(b.term.index)}`, body);
  }
}
