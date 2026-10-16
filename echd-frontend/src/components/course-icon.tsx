import { BookOpen, Bookmark, GraduationCap, Languages, Library, Moon, Mic, PenLine, Sparkles, Star, Type, Users } from 'lucide-react';

export const COURSE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'book-open': BookOpen,
  bookmark: Bookmark,
  'graduation-cap': GraduationCap,
  languages: Languages,
  library: Library,
  moon: Moon,
  mic: Mic,
  'pen-line': PenLine,
  sparkles: Sparkles,
  star: Star,
  type: Type,
  users: Users,
};

export function CourseIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && COURSE_ICONS[name]) || BookOpen;
  return <Icon className={className} />;
}
