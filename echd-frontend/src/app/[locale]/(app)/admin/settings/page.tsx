//echd-frontend/src/app/[locale]/(app)/admin/settings/page.tsx
'use client';

import { Bell, Building2, Landmark, Globe, MailCheck, MessageSquareText, ShieldCheck, Tags, Users } from 'lucide-react';
import { CategoriesField, LogoField, SBi, SMoney, SNumber, SSelect, SSwitch, SText, Section, SettingsForm, StepsField, TermsField } from '@/components/app/settings/config';
import { RevokePortalLinks } from '@/components/app/settings/portal';
import { BackupCard, RoomsAndLevels, SchoolYears } from '@/components/app/settings/reference';
import { PageHeader, Tabs } from '@/components/ui/display';
import { useLocale } from '@/lib/i18n';
import { useUrlState } from '@/lib/url-state';

type TabId = 'institute' | 'site' | 'lists' | 'alerts' | 'messages' | 'years' | 'places' | 'backup';

export default function SettingsPage() {
  const { t } = useLocale();
  const [f, set] = useUrlState({ tab: 'institute' });
  const tab = f.tab as TabId;
  return (
    <div>
      <PageHeader title={t('Paramètres', 'الإعدادات')} subtitle={t('Tout ce qui s’affiche sur le site et dans l’application se règle ici.', 'كل ما يظهر في الموقع والتطبيق يُضبط من هنا.')} />
      <Tabs
        value={tab}
        onChange={(v) => set({ tab: v })}
        tabs={[
          { value: 'institute', label: t('Institut', 'المؤسسة') },
          { value: 'site', label: t('Site public', 'الموقع العام') },
          { value: 'lists', label: t('Catégories', 'الفئات') },
          { value: 'alerts', label: t('Alertes et règles', 'التنبيهات والقواعد') },
          { value: 'messages', label: t('Messages', 'الرسائل') },
          { value: 'years', label: t('Années scolaires', 'السنوات الدراسية') },
          { value: 'places', label: t('Salles et niveaux', 'القاعات والمستويات') },
          { value: 'backup', label: t('Sauvegarde', 'النسخ الاحتياطي') },
        ]}
      />

      {tab === 'institute' && (
        <SettingsForm keys={['institute.name', 'institute.shortName', 'institute.address', 'institute.phone', 'institute.whatsapp', 'institute.email', 'institute.hours', 'institute.presentation', 'institute.defaultCountryCode', 'institute.currency', 'institute.timezone']}>
          <Section title={t('Identité', 'الهوية')} icon={<Building2 className="size-4" />}>
            <LogoField />
            <SBi k="institute.name" label={t('Nom de l’école', 'اسم المدرسة')} />
            <SText k="institute.shortName" label={t('Nom court', 'الاسم المختصر')} hint={t('Utilisé dans les petits espaces (en-tête, application).', 'يُستعمل في المساحات الصغيرة.')} />
            <SBi k="institute.presentation" label={t('Présentation', 'التعريف')} area rows={3} />
          </Section>
          <Section title={t('Coordonnées', 'بيانات الاتصال')}>
            <SBi k="institute.address" label={t('Adresse', 'العنوان')} area rows={2} />
            <div className="grid gap-4 md:grid-cols-3">
              <SText k="institute.phone" label={t('Téléphone', 'الهاتف')} dir="ltr" className="[&_input]:text-start" />
              <SText k="institute.whatsapp" label="WhatsApp" dir="ltr" className="[&_input]:text-start" />
              <SText k="institute.email" label={t('E-mail', 'البريد')} type="email" dir="ltr" className="[&_input]:text-start" />
            </div>
            <SBi k="institute.hours" label={t('Horaires d’accueil', 'مواعيد الاستقبال')} />
          </Section>
          <Section title={t('Région', 'المنطقة')}>
            <div className="grid gap-4 md:grid-cols-3">
              <SText k="institute.defaultCountryCode" label={t('Indicatif téléphonique', 'مفتاح الهاتف')} hint={t('Ex. 33 pour la France. Sert aux liens WhatsApp.', 'مثل 33 لفرنسا. يُستعمل لروابط واتساب.')} dir="ltr" className="[&_input]:text-start" />
              <SText k="institute.currency" label={t('Devise', 'العملة')} hint="EUR, GNF, USD…" dir="ltr" className="[&_input]:text-start" />
              <SText k="institute.timezone" label={t('Fuseau horaire', 'المنطقة الزمنية')} hint={t('Nom international, ex. Africa/Conakry (Guinée) ou Europe/Paris (France)', 'الاسم الدولي، مثل Africa/Conakry (غينيا) أو Europe/Paris (فرنسا)')} dir="ltr" className="[&_input]:text-start" />
            </div>
          </Section>
        </SettingsForm>
      )}

      {tab === 'site' && (
        <SettingsForm keys={['site.heroTitle', 'site.registrationOpen', 'site.registrationSteps', 'site.registrationInfo', 'site.privacyPolicy', 'site.defaultLanguage', 'display.arabicIndicDigits', 'portal.enabled', 'portal.linkDays']}>
          <Section title={t('Page d’accueil', 'الصفحة الرئيسية')} icon={<Globe className="size-4" />}>
            <SBi k="site.heroTitle" label={t('Grand titre', 'العنوان الرئيسي')} />
            <SSelect k="site.defaultLanguage" label={t('Langue par défaut', 'اللغة الافتراضية')} options={[['fr', 'Français'], ['ar', 'العربية']]} />
            <SSwitch k="display.arabicIndicDigits" label={t('Chiffres arabes orientaux (٠١٢٣)', 'الأرقام الهندية (٠١٢٣)')} hint={t('Pour la version arabe du site et de l’application.', 'للنسخة العربية من الموقع والتطبيق.')} />
          </Section>
          <Section title={t('Préinscription', 'التسجيل المسبق')}>
            <SSwitch k="site.registrationOpen" label={t('Préinscriptions ouvertes', 'التسجيل المسبق مفتوح')} hint={t('Fermé : le formulaire est remplacé par un message.', 'عند الإغلاق يُستبدل النموذج برسالة.')} />
            <StepsField k="site.registrationSteps" label={t('Étapes affichées', 'الخطوات المعروضة')} />
            <SBi k="site.registrationInfo" label={t('Information complémentaire', 'معلومة إضافية')} area rows={2} />
          </Section>
          <Section title={t('Espace parents', 'فضاء أولياء الأمور')} icon={<Users className="size-4" />} text={t('Chaque élève a un lien secret à envoyer aux parents (fiche élève → Plus d’actions). Aucun compte à créer.', 'لكل طالب رابط سري يُرسل لأولياء الأمور (بطاقة الطالب ← المزيد). لا حاجة لإنشاء حسابات.')}>
            <SSwitch k="portal.enabled" label={t('Espace parents activé', 'فضاء أولياء الأمور مفعّل')} hint={t('Désactivé : tous les liens cessent de fonctionner.', 'عند التعطيل تتوقف جميع الروابط.')} />
            <SNumber k="portal.linkDays" label={t('Durée de validité d’un lien (jours)', 'مدة صلاحية الرابط (أيام)')} min={1} max={365} />
            <RevokePortalLinks />
          </Section>
          <Section title={t('Confidentialité', 'الخصوصية')}>
            <SBi k="site.privacyPolicy" label={t('Politique de confidentialité', 'سياسة الخصوصية')} hint={t('Affichée sur le formulaire de préinscription. Laisser vide pour masquer le lien.', 'تظهر في نموذج التسجيل المسبق. اتركها فارغة لإخفاء الرابط.')} area rows={6} />
          </Section>
        </SettingsForm>
      )}

      {tab === 'lists' && (
        <SettingsForm keys={['announcement.categories', 'announcement.urgentCategory', 'course.categories']}>
          <Section title={t('Catégories d’annonces', 'فئات الإعلانات')} icon={<Tags className="size-4" />}>
            <CategoriesField k="announcement.categories" label={t('Liste', 'القائمة')} />
            <SText k="announcement.urgentCategory" label={t('Code de la catégorie « urgente »', 'رمز الفئة «العاجلة»')} hint={t('Ses annonces sont mises en avant sur le site.', 'تُبرَز إعلاناتها في الموقع.')} dir="ltr" className="[&_input]:text-start" />
          </Section>
          <Section title={t('Catégories de cours', 'فئات الدروس')}>
            <CategoriesField k="course.categories" label={t('Liste', 'القائمة')} />
          </Section>
        </SettingsForm>
      )}

      {tab === 'alerts' && (
        <SettingsForm keys={['alerts.absenceThreshold', 'alerts.dueGraceDays', 'alerts.dueCriticalDays', 'alerts.preRegPendingDays', 'alerts.digest', 'reminders.auto', 'reminders.everyDays', 'receipts.emailAuto', 'finance.openingBalanceCents', 'fees.siblingDiscountPercent', 'security.inactivityMinutes', 'retention.years', 'terms.dates']}>
          <Section title={t('Alertes', 'التنبيهات')} icon={<Bell className="size-4" />} text={t('Une vérification tourne chaque matin et crée les notifications.', 'يعمل فحص كل صباح وينشئ الإشعارات.')}>
            <div className="grid gap-4 md:grid-cols-2">
              <SNumber k="alerts.absenceThreshold" label={t('Absences avant alerte', 'عدد الغيابات قبل التنبيه')} min={1} max={20} />
              <SNumber k="alerts.preRegPendingDays" label={t('Préinscription sans réponse (jours)', 'طلب بلا ردّ (أيام)')} min={1} max={60} />
              <SNumber k="alerts.dueGraceDays" label={t('Délai de grâce paiement (jours)', 'مهلة السداد (أيام)')} hint={t('Avant de compter un retard.', 'قبل احتساب التأخر.')} min={0} max={90} />
              <SNumber k="alerts.dueCriticalDays" label={t('Retard critique après (jours)', 'تأخر حرج بعد (أيام)')} min={1} max={365} />
            </div>
            <SSelect k="alerts.digest" label={t('Récapitulatif par e-mail', 'ملخص بالبريد')} options={[['none', t('Aucun', 'بدون')], ['daily', t('Chaque jour', 'يومياً')], ['weekly', t('Chaque semaine', 'أسبوعياً')]]} />
          </Section>
          <Section title={t('Relances et reçus par e-mail', 'التذكيرات والإيصالات بالبريد')} icon={<MailCheck className="size-4" />} text={t('Nécessite un service e-mail configuré sur le serveur (Brevo ou SMTP).', 'يتطلب إعداد خدمة البريد على الخادم (Brevo أو SMTP).')}>
            <SSwitch k="reminders.auto" label={t('Relances de paiement automatiques', 'تذكيرات السداد التلقائية')} hint={t('Chaque matin, les familles en retard reçoivent le message « Relance de paiement » (onglet Messages).', 'كل صباح تتلقى الأسر المتأخرة رسالة «تذكير بالسداد» (تبويب الرسائل).')} />
            <SNumber k="reminders.everyDays" label={t('Intervalle entre deux relances (jours)', 'الفاصل بين تذكيرين (أيام)')} hint={t('Une famille n’est jamais relancée plus souvent.', 'لا تُذكَّر الأسرة أكثر من ذلك.')} min={1} max={60} />
            <SSwitch k="receipts.emailAuto" label={t('Envoyer le reçu par e-mail à chaque encaissement', 'إرسال الإيصال بالبريد عند كل دفعة')} hint={t('Si une adresse existe. Modifiable au moment d’encaisser.', 'إن وُجد عنوان. قابل للتعديل عند التحصيل.')} />
          </Section>
          <Section title={t('Caisse', 'الصندوق')} icon={<Landmark className="size-4" />} text={t('Le solde disponible = solde de départ + cotisations encaissées − dépenses.', 'الرصيد المتاح = الرصيد الابتدائي + الاشتراكات المحصّلة − المصروفات.')}>
            <SMoney k="finance.openingBalanceCents" label={t('Solde de départ', 'الرصيد الابتدائي')} hint={t('Argent déjà en caisse avant d’utiliser l’application (0 si vous partez de zéro).', 'المبلغ الموجود قبل استعمال التطبيق (0 إن بدأتم من الصفر).')} />
          </Section>
          <Section title={t('Règles', 'القواعد')} icon={<ShieldCheck className="size-4" />}>
            <div className="grid gap-4 md:grid-cols-3">
              <SNumber k="fees.siblingDiscountPercent" label={t('Remise fratrie (%)', 'خصم الإخوة (%)')} min={0} max={100} />
              <SNumber k="security.inactivityMinutes" label={t('Déconnexion après (min)', 'تسجيل الخروج بعد (دقيقة)')} hint={t('Inactivité.', 'عند الخمول.')} min={5} max={480} />
              <SNumber k="retention.years" label={t('Conservation des dossiers (ans)', 'مدة حفظ الملفات (سنوات)')} hint={t('Après le départ de l’élève.', 'بعد مغادرة الطالب.')} min={1} max={20} />
            </div>
            <TermsField />
          </Section>
        </SettingsForm>
      )}

      {tab === 'messages' && (
        <SettingsForm keys={['templates.reminder', 'templates.preregAck', 'templates.slotChange']}>
          <Section title={t('Modèles de messages', 'نماذج الرسائل')} icon={<MessageSquareText className="size-4" />} text={t('Les mots entre accolades sont remplacés automatiquement.', 'الكلمات بين الأقواس المعقوفة تُستبدل تلقائياً.')}>
            <SBi k="templates.reminder" area rows={4} label={t('Relance de paiement', 'تذكير بالسداد')} hint="{student} {amount} {period} {school}" />
            <SBi k="templates.preregAck" area rows={4} label={t('Accusé de préinscription', 'إشعار استلام التسجيل المسبق')} hint="{reference} {school}" />
            <SBi k="templates.slotChange" area rows={3} label={t('Changement d’horaire', 'تغيير الموعد')} hint="{message} {school}" />
          </Section>
        </SettingsForm>
      )}

      {tab === 'years' && <SchoolYears />}
      {tab === 'places' && <RoomsAndLevels />}
      {tab === 'backup' && <BackupCard />}
    </div>
  );
}
