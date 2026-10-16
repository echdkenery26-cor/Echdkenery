export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/** Nettoie un objet de formulaire avant envoi : chaînes vides → undefined, espaces retirés. */
export function clean<T extends Record<string, any>>(o: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') {
      const s = v.trim();
      if (s !== '') out[k] = s;
    } else if (v !== undefined && v !== null) out[k] = v;
  }
  return out as Partial<T>;
}

export const euroToCents = (v: string | number) => Math.round(Number(String(v).replace(',', '.')) * 100);
export const centsToEuro = (c: number) => (c / 100).toString().replace('.', ',');

/** wa.me n'accepte que des chiffres, avec indicatif pays */
export const waLink = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export function debounce<A extends any[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
