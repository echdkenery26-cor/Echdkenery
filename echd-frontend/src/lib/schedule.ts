// Regroupe les créneaux pour l'affichage public (plusieurs classes au même horaire = une seule ligne).

export interface PubSlot {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  course: {
    id: string;
    titleFr: string;
    titleAr: string;
    audience: 'CHILD' | 'ADULT';
    color: string;
    icon: string;
    level?: { labelFr: string; labelAr: string } | null;
  };
  teacher?: { firstName: string; lastName: string } | null;
  room?: { name: string; nameAr: string } | null;
}

export interface SlotGroup {
  key: string;
  weekday: number;
  startTime: string;
  endTime: string;
  course: PubSlot['course'];
  teachers: string[];
  rooms: string[];
}

export function groupSlots(slots: PubSlot[]): SlotGroup[] {
  const map = new Map<string, SlotGroup>();
  for (const s of slots) {
    const key = `${s.weekday}|${s.startTime}|${s.endTime}|${s.course.id}`;
    let g = map.get(key);
    if (!g) {
      g = { key, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, course: s.course, teachers: [], rooms: [] };
      map.set(key, g);
    }
    if (s.teacher?.firstName) {
      const n = s.teacher.firstName;
      if (!g.teachers.includes(n)) g.teachers.push(n);
    }
    if (s.room?.name && !g.rooms.includes(s.room.name)) g.rooms.push(s.room.name);
  }
  return [...map.values()].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
}

export function byWeekday(groups: SlotGroup[]): Array<[number, SlotGroup[]]> {
  const m = new Map<number, SlotGroup[]>();
  for (const g of groups) m.set(g.weekday, [...(m.get(g.weekday) || []), g]);
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}
