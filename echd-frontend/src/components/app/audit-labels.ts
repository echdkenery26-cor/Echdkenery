//echd-frontend/src/components/app/audit-labels.ts
type T = (fr: string, ar: string) => string;

const ACTIONS: Record<string, [string, string]> = {
  CREATE: ['Création', 'إنشاء'],
  UPDATE: ['Modification', 'تعديل'],
  DELETE: ['Suppression', 'حذف'],
  STATUS: ['Changement de statut', 'تغيير الحالة'],
  ARCHIVE: ['Archivage', 'أرشفة'],
  UNARCHIVE: ['Désarchivage', 'إلغاء الأرشفة'],
  UPDATE_PHOTO: ['Photo modifiée', 'تغيير الصورة'],
  ENROLL: ['Inscription en classe', 'تسجيل في قسم'],
  ENROLLMENT_END: ['Fin d’inscription', 'إنهاء التسجيل'],
  ENROLLMENT_TRANSFER: ['Changement de classe', 'تغيير القسم'],
  PAYMENT: ['Paiement', 'دفعة'],
  PAYMENT_CANCEL: ['Paiement annulé', 'إلغاء دفعة'],
  CANCEL: ['Annulation', 'إلغاء'],
  EXEMPT: ['Exonération', 'إعفاء'],
  REMINDER: ['Relance envoyée', 'تذكير مُرسل'],
  PROMOTE_LEVEL: ['Passage de niveau', 'انتقال مستوى'],
  LOGIN: ['Connexion', 'تسجيل دخول'],
  LOGIN_FAILED: ['Échec de connexion', 'فشل الدخول'],
  PASSWORD_CHANGE: ['Mot de passe changé', 'تغيير كلمة المرور'],
  PASSWORD_RESET: ['Mot de passe réinitialisé', 'إعادة تعيين كلمة المرور'],
  BACKUP_EXPORT: ['Sauvegarde exportée', 'تصدير نسخة احتياطية'],
  CONVERT: ['Préinscription convertie', 'تحويل تسجيل مسبق'],
  PUBLISH: ['Publication', 'نشر'],
  UNPUBLISH: ['Dépublication', 'إلغاء النشر'],
  SETTINGS: ['Paramètres modifiés', 'تعديل الإعدادات'],
  PORTAL_LINK: ['Lien parents créé', 'إنشاء رابط الأولياء'],
  PORTAL_REVOKE_ALL: ['Liens parents révoqués', 'إلغاء روابط الأولياء'],
  ACCOUNTING_EXPORT: ['Export comptable', 'تصدير محاسبي'],
  CONVERT_PARTIAL: ['Préinscription convertie (partielle)', 'تحويل جزئي لتسجيل مسبق'],
  EMAIL_CHANGE: ['E-mail modifié', 'تغيير البريد الإلكتروني'],
  CANCEL_EXPENSE: ['Dépense annulée', 'إلغاء مصروف'],
  EXPENSES_EXPORT: ['Export des dépenses', 'تصدير المصروفات'],
  CANCEL_PAYMENT: ['Paiement annulé', 'إلغاء دفعة'],
  UNEXEMPT: ['Exonération retirée', 'إلغاء إعفاء'],
  TRANSFER: ['Changement de classe', 'تغيير القسم'],
  ENROLLMENT_PROMOTE: ['Passage de classe', 'ترقية قسم'],
  DUPLICATE: ['Duplication', 'نسخ'],
  LINK_SIBLING: ['Frère/sœur rattaché', 'ربط أخ/أخت'],
  UNLINK_SIBLING: ['Frère/sœur détaché', 'فك ربط أخ/أخت'],
  ASSIGN_PATHWAY: ['Parcours attribué', 'إسناد مسار'],
  UNASSIGN_PATHWAY: ['Parcours retiré', 'سحب مسار'],
  PASSWORD_RESET_BY_ADMIN: ['Mot de passe réinitialisé (admin)', 'إعادة تعيين كلمة المرور (مشرف)'],
};

const ENTITIES: Record<string, [string, string]> = {
  Student: ['Élève', 'طالب'],
  Enrollment: ['Inscription', 'تسجيل'],
  Payment: ['Paiement', 'دفعة'],
  Expense: ['Dépense', 'مصروف'],
  Due: ['Échéance', 'استحقاق'],
  User: ['Compte', 'حساب'],
  Teacher: ['Enseignant', 'معلّم'],
  Staff: ['Équipe', 'فريق'],
  Course: ['Cours', 'درس'],
  SchoolClass: ['Classe', 'قسم'],
  Slot: ['Créneau', 'موعد'],
  Announcement: ['Annonce', 'إعلان'],
  PreRegistration: ['Préinscription', 'تسجيل مسبق'],
  Pathway: ['Parcours', 'مسار'],
  Setting: ['Paramètre', 'إعداد'],
  SchoolYear: ['Année scolaire', 'سنة دراسية'],
  Reminder: ['Relance', 'تذكير'],
  System: ['Système', 'النظام'],
};

export const actionLabel = (a: string, t: T) => (ACTIONS[a] ? t(...ACTIONS[a]) : a.replace(/_/g, ' ').toLowerCase());
export const entityLabel = (e: string, t: T) => (ENTITIES[e] ? t(...ENTITIES[e]) : e);

export function actionTone(a: string): 'ok' | 'warn' | 'bad' | 'info' | 'neutral' {
  if (/DELETE|CANCEL|FAILED/.test(a)) return 'bad';
  if (/CREATE|ENROLL$|PAYMENT$|PUBLISH$|CONVERT/.test(a)) return 'ok';
  if (/STATUS|ARCHIVE|EXEMPT|RESET|BACKUP/.test(a)) return 'warn';
  return 'info';
}
