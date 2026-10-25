//echd-frontend/src/components/app/nav.tsx
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  HandCoins,
  Home,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  School,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserCog,
  UserPlus,
  Wallet,
} from 'lucide-react';
import type { Role } from '@/lib/auth';

export interface NavItem {
  href: string;
  label: [string, string];
  /** Libellé court pour la barre du bas (mobile) */
  short?: [string, string];
  icon: React.ComponentType<{ className?: string }>;
  /** Pastille de comptage : 'prereg' */
  badge?: 'prereg';
  roles?: Role[];
  /** Éléments affichés dans la barre du bas sur mobile */
  tab?: boolean;
}

export interface NavGroup {
  title: [string, string];
  items: NavItem[];
}

export const STAFF_NAV: NavGroup[] = [
  {
    title: ['Général', 'عام'],
    items: [
      { href: '/admin', label: ['Tableau de bord', 'لوحة القيادة'], short: ['Accueil', 'الرئيسية'], icon: LayoutDashboard, tab: true },
      { href: '/admin/students', label: ['Élèves', 'الطلاب'], icon: GraduationCap, tab: true },
      { href: '/admin/pre-registrations', label: ['Préinscriptions', 'التسجيل المسبق'], icon: UserPlus, badge: 'prereg' },
    ],
  },
  {
    title: ['École', 'المدرسة'],
    items: [
      { href: '/admin/classes', label: ['Classes', 'الأقسام'], icon: School },
      { href: '/admin/timetable', label: ['Emploi du temps', 'الجدول'], icon: CalendarDays },
      { href: '/admin/attendance', label: ['Présences', 'الحضور'], icon: ClipboardCheck, tab: true },
      { href: '/admin/progress', label: ['Progression', 'التقدّم'], icon: TrendingUp },
      { href: '/admin/courses', label: ['Cours', 'الدروس'], icon: BookOpen },
    ],
  },
  {
    title: ['Gestion', 'التسيير'],
    items: [
      { href: '/admin/finance', label: ['Cotisations', 'الاشتراكات'], icon: Wallet, tab: true },
      { href: '/admin/expenses', label: ['Dépenses', 'المصروفات'], icon: HandCoins, roles: ['ADMIN'] },
      { href: '/admin/announcements', label: ['Annonces', 'الإعلانات'], icon: Megaphone },
      { href: '/admin/team', label: ['Équipe', 'الفريق'], icon: UserCog },
    ],
  },
  {
    title: ['Administration', 'الإدارة'],
    items: [
      { href: '/admin/settings', label: ['Paramètres', 'الإعدادات'], icon: Settings, roles: ['ADMIN'] },
      { href: '/admin/users', label: ['Comptes', 'الحسابات'], icon: KeyRound, roles: ['ADMIN'] },
      { href: '/admin/audit', label: ['Journal', 'السجل'], icon: ShieldCheck, roles: ['ADMIN'] },
    ],
  },
];

export const TEACHER_NAV: NavGroup[] = [
  {
    title: ['Mon espace', 'فضائي'],
    items: [
      { href: '/teacher', label: ['Accueil', 'الرئيسية'], icon: Home, tab: true },
      { href: '/teacher/classes', label: ['Mes classes', 'أقسامي'], icon: School, tab: true },
      { href: '/teacher/attendance', label: ['Présences', 'الحضور'], icon: ClipboardCheck, tab: true },
    ],
  },
];

export const roleLabel = (role: Role, t: (fr: string, ar: string) => string) =>
  role === 'ADMIN' ? t('Administrateur', 'مدير') : role === 'MANAGER' ? t('Gestionnaire', 'مسؤول') : t('Enseignant', 'معلم');
