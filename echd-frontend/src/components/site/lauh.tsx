import { StarMark } from '@/components/brand';
import { Locale, formatTime, intlLocale, pickFor, trFor, weekdayName } from '@/lib/locale';
import { PubSlot, byWeekday, groupSlots } from '@/lib/schedule';

/**
 * La « lauh » : la tablette sur laquelle on écrit le Coran à l'école coranique.
 * Elle sert ici de carte d'horaires de la semaine.
 */
export function Lauh({ slots, locale, arabicIndic }: { slots: PubSlot[]; locale: Locale; arabicIndic?: boolean }) {
  const t = trFor(locale);
  const pick = pickFor(locale);
  const loc = intlLocale(locale, arabicIndic);
  const days = byWeekday(groupSlots(slots));
  return (
    <div className="mx-auto w-full max-w-[24rem] rounded-t-[12rem] rounded-b-[1.75rem] bg-gradient-to-b from-gold-300 via-gold-500 to-gold-600 p-[3px] shadow-[0_30px_60px_-24px_rgb(0_0_0/0.6)]">
      <div className="rounded-t-[11.8rem] rounded-b-[1.6rem] bg-paper px-5 pb-6 pt-9 sm:px-6">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <StarMark className="size-9 text-gold-500" />
          <p className="font-serif text-lg font-bold text-brand-800">{t('Nos horaires', 'مواعيدنا')}</p>
        </div>
        {days.length === 0 && <p className="text-center text-sm text-brand-400">{t('Les horaires seront bientôt publiés.', 'سيتم نشر المواعيد قريباً.')}</p>}
        <div className="space-y-5">
          {days.map(([wd, groups]) => (
            <div key={wd}>
              <p className="mb-2 text-sm font-semibold text-gold-700">{weekdayName(wd, loc)}</p>
              <ul className="space-y-2.5">
                {groups.slice(0, 6).map((g) => (
                  <li key={g.key} className="flex items-baseline gap-3 border-b border-dashed border-sand-300 pb-2.5 last:border-0 last:pb-0">
                    <span dir="ltr" className="num shrink-0 font-serif text-[0.95rem] font-bold text-brand-700">
                      {formatTime(g.startTime, loc)}–{formatTime(g.endTime, loc)}
                    </span>
                    <span className="min-w-0 text-sm leading-snug text-brand-600">{pick(g.course.titleFr, g.course.titleAr)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
