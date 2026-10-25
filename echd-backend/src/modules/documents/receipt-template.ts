//echd-backend/src/modules/documents/receipt-template.ts
/**
 * Gabarit du reçu de paiement : fonction pure (données déjà formatées → page HTML imprimable).
 * Reprend l'identité de la plateforme : vert profond, or, crème, étoile à huit branches (khatam).
 */

export const FONT_FACES = `
@font-face{font-family:'Figtree';font-weight:400;src:url('/api/assets/fonts/figtree-latin-400-normal.woff2') format('woff2')}
@font-face{font-family:'Figtree';font-weight:600;src:url('/api/assets/fonts/figtree-latin-600-normal.woff2') format('woff2')}
@font-face{font-family:'Figtree';font-weight:700;src:url('/api/assets/fonts/figtree-latin-700-normal.woff2') format('woff2')}
@font-face{font-family:'Noto Serif';font-weight:700;src:url('/api/assets/fonts/noto-serif-latin-700-normal.woff2') format('woff2')}
@font-face{font-family:'Noto Naskh Arabic';font-weight:400;src:url('/api/assets/fonts/noto-naskh-arabic-arabic-400-normal.woff2') format('woff2')}
@font-face{font-family:'Noto Naskh Arabic';font-weight:700;src:url('/api/assets/fonts/noto-naskh-arabic-arabic-700-normal.woff2') format('woff2')}`;

export interface ReceiptLabels {
  receipt: string;
  receiptNo: string;
  date: string;
  student: string;
  label: string;
  amount: string;
  method: string;
  reference: string;
  enteredBy: string;
  cancelled: string;
  cancelReason: string;
  signature: string;
  thanks: string;
  print: string;
  dueTotal: string;
  alreadyPaid: string;
  thisPayment: string;
  remainingAfter: string;
  settled: string;
  partial: string;
  stampPaid: string;
  issuedOn: string;
  keepProof: string;
}

export interface ReceiptView {
  lang: 'fr' | 'ar';
  ar: boolean;
  t: ReceiptLabels;
  org: { name: string; shortName?: string; address: string; phone: string; email: string; logo: string | null };
  number: string;
  amount: string;
  date: string;
  student: string;
  studentArabic?: string | null;
  label: string;
  method: string;
  reference?: string | null;
  enteredBy?: string | null;
  /** Échéance : montants formatés + parts (en %) pour la barre */
  due: { total: string; before: string; remaining: string; beforePct: number; thisPct: number; settled: boolean };
  cancelled: boolean;
  cancelReason?: string | null;
  issuedOn: string;
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Étoile à huit branches de la plateforme */
const STAR = 'M36 4l8 13.6L59.5 13l-4.5 15.7L68 36l-13 7.3 4.5 15.7L44 54.4 36 68l-8-13.6L12.5 59 17 43.3 4 36l13-7.3L12.5 13 28 17.6z';

const initials = (name: string) =>
  Array.from(name.split(/\s+/).filter((w) => /\p{L}/u.test(w)).slice(0, 2).map((w) => Array.from(w)[0]).join('')).join('').toUpperCase();

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

function starMark(color: string, size: string) {
  return `<svg viewBox="0 0 72 72" width="${size}" height="${size}" aria-hidden="true"><path d="${STAR}" fill="${color}"/><circle cx="36" cy="36" r="9" fill="#1f4a3a"/><circle cx="36" cy="36" r="4" fill="${color}"/></svg>`;
}

/** Tampon rond : nom de l'école en arc, logo au centre, « PAYÉ » et la date en bas. */
function stamp(v: ReceiptView) {
  const ink = v.cancelled ? '#b4413a' : '#1f4a3a';
  const letter = v.ar ? '0' : '1.2';
  // Le nom court tient mieux sur l'arc ; sans nom court, le nom complet est réduit puis tronqué.
  const raw = (v.org.shortName?.trim() || v.org.name).trim();
  const topText = raw.length > 40 ? `${Array.from(raw).slice(0, 39).join('')}…` : raw;
  const len = Array.from(topText).length;
  const topSize = len <= 16 ? 12 : len <= 24 ? 10.5 : 8.5;
  const natural = len * (topSize * 0.58 + (v.ar ? 0 : 1.2));
  const topLength = natural > 118 ? ' textLength="118" lengthAdjust="spacingAndGlyphs"' : '';
  const bottom = esc(v.cancelled ? v.t.cancelled : `${v.t.stampPaid} · ${v.date}`);
  const bottomLength = Array.from(bottom).length * 10 > 150 ? ' textLength="150" lengthAdjust="spacingAndGlyphs"' : '';
  const center = v.cancelled
    ? `<text x="80" y="88" text-anchor="middle" font-size="19" font-weight="700" fill="${ink}" transform="rotate(-12 80 80)">${esc(v.t.cancelled)}</text>`
    : v.org.logo
      ? `<clipPath id="stc"><circle cx="80" cy="80" r="40"/></clipPath><circle cx="80" cy="80" r="42" fill="#fff"/><image href="${esc(v.org.logo)}" x="38" y="38" width="84" height="84" preserveAspectRatio="xMidYMid meet" clip-path="url(#stc)"/>`
      : `<g transform="translate(40.4 40.4) scale(1.1)"><path d="${STAR}" fill="${ink}"/><circle cx="36" cy="36" r="9" fill="#fdfcf7"/><circle cx="36" cy="36" r="4" fill="${ink}"/></g>`;
  return `<svg class="stamp" viewBox="0 0 160 160" role="img" aria-label="${esc(v.cancelled ? v.t.cancelled : v.t.stampPaid)}">
<defs><path id="arcT" d="M 80,80 m -57,0 a 57,57 0 1,1 114,0"/><path id="arcB" d="M 80,80 m -67,0 a 67,67 0 0,0 134,0"/></defs>
<g fill="none" stroke="${ink}"><circle cx="80" cy="80" r="77" stroke-width="2.6"/><circle cx="80" cy="80" r="72.5" stroke-width=".8"/><circle cx="80" cy="80" r="47" stroke-width="1.4"/></g>
<g fill="${ink}" font-family="inherit" font-weight="700" letter-spacing="${letter}">
<text font-size="${topSize}" text-anchor="middle"><textPath href="#arcT" startOffset="50%"${topLength}>${esc(topText)}</textPath></text>
<text font-size="10.5" text-anchor="middle"><textPath href="#arcB" startOffset="50%"${bottomLength}>${bottom}</textPath></text>
</g>
<g fill="${ink}"><path transform="translate(8.5 73) scale(.11)" d="${STAR}"/><path transform="translate(143.5 73) scale(.11)" d="${STAR}"/></g>
${center}
</svg>`;
}

export function renderReceiptHtml(v: ReceiptView): string {
  const t = v.t;
  const dir = v.ar ? 'rtl' : 'ltr';
  const serif = `${v.ar ? "'Noto Naskh Arabic'," : ''}'Noto Serif',serif`;
  const sans = `${v.ar ? "'Noto Naskh Arabic'," : ''}'Figtree',system-ui,sans-serif`;
  const logoTile = v.org.logo
    ? `<img src="${esc(v.org.logo)}" alt="" onerror="this.outerHTML=this.dataset.fb" data-fb="${esc(starMark('#cfae55', '34'))}">`
    : starMark('#cfae55', '34');
  const watermarkLogo = v.org.logo
    ? `<img src="${esc(v.org.logo)}" alt="" onerror="this.remove()">`
    : starMark('#1f4a3a', '100%');
  const chip = v.cancelled
    ? `<span class="chip bad">${esc(t.cancelled)}</span>`
    : v.due.settled
      ? `<span class="chip ok"><svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>${esc(t.settled)}</span>`
      : `<span class="chip gold">${esc(t.partial)}</span>`;
  const contact = [v.org.address, v.org.phone, v.org.email].filter(Boolean);
  const studentInitials = esc(initials(v.student));

  return `<!doctype html>
<html lang="${v.lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.receipt)} ${esc(v.number)} — ${esc(v.org.name)}</title>
<style>${FONT_FACES}
:root{--b6:#1f4a3a;--b7:#183b2e;--b8:#122b23;--b5:#2e6b55;--b2:#b3d1c2;--b1:#d9e8e0;--b0:#eef5f1;--g5:#cfae55;--g3:#e3cc8b;--g2:#efe0b4;--g7:#8a6f2c;--paper:#fdfcf7;--s1:#f8f5ea;--s2:#f3eddc;--s3:#e8dfc4;--ok:#1e7a45;--oks:#e3f5ea;--bad:#b4413a;--bads:#fbe6e3;--mute:#5f7168}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#e6e2d3;color:var(--b8);font-family:${sans};font-size:14px;line-height:1.5}
.sheet{position:relative;overflow:hidden;width:210mm;margin:18px auto;background:var(--paper);box-shadow:0 10px 40px rgba(18,43,35,.22)}
.wm{position:absolute;inset-inline:0;top:52%;height:420px;margin-top:-210px;display:flex;align-items:center;justify-content:center;opacity:.045;pointer-events:none}
.wm img,.wm svg{width:420px;height:420px;object-fit:contain}
.top{position:relative;color:#fff;background:linear-gradient(135deg,var(--b7) 0%,var(--b6) 55%,var(--b5) 100%);padding:30px 40px 34px;overflow:hidden}
.top::after{content:"";position:absolute;inset-inline:0;bottom:0;height:5px;background:linear-gradient(90deg,var(--g5),var(--g3),var(--g5))}
.pat{position:absolute;inset:0;width:100%;height:100%;opacity:.16}
.top-in{position:relative;display:flex;align-items:center;justify-content:space-between;gap:24px}
.brand{display:flex;align-items:center;gap:16px;min-width:0}
.tile{flex:none;width:68px;height:68px;border-radius:20px;background:#fff;display:grid;place-items:center;padding:8px;box-shadow:0 6px 18px rgba(0,0,0,.28),0 0 0 3px rgba(207,174,85,.65)}
.tile img{max-width:100%;max-height:100%;object-fit:contain;border-radius:8px}
.tile svg{background:var(--b6);border-radius:12px;padding:6px;width:100%;height:100%}
.org{font-family:${serif};font-size:21px;font-weight:700;line-height:1.2}
.meta{margin-top:4px;font-size:11.5px;color:rgba(255,255,255,.76)}
.kind{text-align:end;flex:none}
.kind small{display:block;font-size:${v.ar ? '13px' : '11px'};font-weight:700;letter-spacing:${v.ar ? '0' : '.16em'};text-transform:uppercase;color:var(--g3)}
.kind b{display:block;margin-top:2px;font-family:${serif};font-size:25px;letter-spacing:.01em;direction:ltr;unicode-bidi:isolate}
.kind span{display:block;font-size:11.5px;color:rgba(255,255,255,.76);margin-top:2px}
.body{position:relative;padding:0 40px 8px}
.hero{position:relative;margin-top:-22px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:#fff;border-radius:22px;padding:22px 26px;box-shadow:0 12px 32px rgba(18,43,35,.14);border-inline-start:6px solid var(--g5)}
.lbl{font-size:${v.ar ? '12.5px' : '11px'};font-weight:700;letter-spacing:${v.ar ? '0' : '.12em'};text-transform:uppercase;color:var(--mute)}
.amount{font-family:${serif};font-size:42px;line-height:1.1;font-weight:700;color:var(--b6)}
.amount.void{color:#9aa79f;text-decoration:line-through}
.chip{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:99px;font-weight:700;font-size:13px}
.chip.ok{background:var(--oks);color:var(--ok)}.chip.gold{background:var(--g2);color:var(--g7)}.chip.bad{background:var(--bads);color:var(--bad)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}
.cell{background:#fff;border:1px solid var(--s3);border-radius:16px;padding:12px 15px}
.cell b{display:block;margin-top:3px;font-size:15px;font-weight:600;word-break:break-word}
.wide{grid-column:1/-1}
.who{display:flex;align-items:center;gap:14px}
.av{flex:none;width:46px;height:46px;border-radius:99px;background:var(--b6);color:var(--g3);display:grid;place-items:center;font-weight:700;font-size:16px;font-family:${serif}}
.who b{margin:0;font-size:17px;font-family:${serif}}
.who small{display:block;color:var(--mute);font-size:13px;margin-top:1px}
.due{margin-top:18px;background:linear-gradient(180deg,var(--s1),var(--s2));border-radius:18px;padding:16px 20px}
.due-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.due-h b{font-family:${serif};font-size:17px;color:var(--b6)}
.bar{display:flex;height:12px;border-radius:99px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 1px var(--s3);margin:10px 0}
.bar i{display:block;height:100%}
.legend{display:flex;gap:18px;flex-wrap:wrap;font-size:12.5px;color:var(--mute)}
.legend span{display:inline-flex;align-items:center;gap:6px}.legend em{width:10px;height:10px;border-radius:99px;display:inline-block}
.legend strong{color:var(--b8);font-weight:700;margin-inline-start:2px}
.void-note{margin-top:14px;background:var(--bads);color:var(--bad);border-radius:14px;padding:11px 15px;font-size:13.5px}
.sign{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-top:22px;break-inside:avoid}
.sig{flex:1;max-width:300px}
.sig div{height:84px;border-bottom:1.5px solid var(--b8)}
.sig p{margin:6px 0 0;font-size:12px;color:var(--mute)}
.stamp{flex:none;width:170px;height:170px;transform:rotate(-9deg);opacity:.92;mix-blend-mode:multiply;margin-inline-end:6px;font-family:${sans}}
.foot{margin-top:18px;border-top:1px solid var(--s3);padding:14px 40px 24px;text-align:center;color:var(--mute);font-size:11.5px;position:relative}
.foot .thanks{font-family:${serif};font-size:15px;color:var(--b6);margin-bottom:3px}
.foot::before{content:"";display:block;width:56px;height:3px;border-radius:9px;background:var(--g5);margin:-15px auto 12px}
.btn{position:fixed;inset-block-end:16px;inset-inline-end:16px;background:var(--g5);color:var(--b8);border:0;border-radius:99px;padding:12px 20px;font:600 14px ${sans};cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
.void-mark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:130px;font-weight:700;color:rgba(180,65,58,.13);transform:rotate(-24deg);pointer-events:none;z-index:5;font-family:${serif}}
@media (max-width:820px){.sheet{width:100%;margin:0}.top{padding:24px 20px 30px}.body{padding:0 16px}.top-in{flex-wrap:wrap}.kind{text-align:start}.grid{grid-template-columns:1fr 1fr}.amount{font-size:34px}.foot{padding-inline:16px}}
@media print{body{background:#fff}.sheet{margin:0;box-shadow:none;width:100%;page-break-after:avoid;break-inside:avoid}.btn{display:none}@page{size:A4;margin:0}}
</style></head><body>
<main class="sheet">
${v.cancelled ? `<div class="void-mark">${esc(t.cancelled)}</div>` : ''}
<div class="wm">${watermarkLogo}</div>
<header class="top">
  <svg class="pat" aria-hidden="true"><defs><pattern id="kt" width="64" height="64" patternUnits="userSpaceOnUse"><path transform="translate(14 14) scale(.5)" d="${STAR}" fill="none" stroke="#e3cc8b" stroke-width="1.4"/><circle cx="0" cy="0" r="2.2" fill="#e3cc8b"/><circle cx="64" cy="64" r="2.2" fill="#e3cc8b"/><circle cx="0" cy="64" r="2.2" fill="#e3cc8b"/><circle cx="64" cy="0" r="2.2" fill="#e3cc8b"/></pattern></defs><rect width="100%" height="100%" fill="url(#kt)"/></svg>
  <div class="top-in">
    <div class="brand"><div class="tile">${logoTile}</div>
      <div><div class="org">${esc(v.org.name)}</div>${contact.length ? `<div class="meta">${esc(contact.join(' · '))}</div>` : ''}</div></div>
    <div class="kind"><small>${esc(t.receipt)}</small><b>${esc(v.number)}</b><span>${esc(v.date)}</span></div>
  </div>
</header>
<div class="body">
  <section class="hero">
    <div><div class="lbl">${esc(t.amount)}</div><div class="amount${v.cancelled ? ' void' : ''}">${esc(v.amount)}</div></div>
    ${chip}
  </section>
  <section class="grid">
    <div class="cell wide who"><span class="av">${studentInitials}</span><div><div class="lbl">${esc(t.student)}</div><b>${esc(v.student)}</b>${v.studentArabic && v.ar ? `<small>${esc(v.studentArabic)}</small>` : ''}</div></div>
    <div class="cell"><div class="lbl">${esc(t.date)}</div><b>${esc(v.date)}</b></div>
    <div class="cell"><div class="lbl">${esc(t.method)}</div><b>${esc(v.method)}</b></div>
    <div class="cell"><div class="lbl">${esc(v.reference ? t.reference : t.enteredBy)}</div><b>${esc(v.reference || v.enteredBy || '—')}</b></div>
    <div class="cell wide"><div class="lbl">${esc(t.label)}</div><b>${esc(v.label)}</b></div>
  </section>
  <section class="due">
    <div class="due-h"><b>${esc(t.dueTotal)}</b><b>${esc(v.due.total)}</b></div>
    <div class="bar" role="img" aria-label="${esc(t.dueTotal)}"><i style="width:${clamp(v.due.beforePct)}%;background:var(--b2)"></i><i style="width:${v.cancelled ? 0 : clamp(v.due.thisPct)}%;background:var(--b6)"></i></div>
    <div class="legend">
      <span><em style="background:var(--b2)"></em>${esc(t.alreadyPaid)} <strong>${esc(v.due.before)}</strong></span>
      <span><em style="background:var(--b6)"></em>${esc(t.thisPayment)} <strong>${esc(v.cancelled ? '—' : v.amount)}</strong></span>
      <span><em style="background:#fff;box-shadow:inset 0 0 0 1.5px var(--s3)"></em>${esc(t.remainingAfter)} <strong>${esc(v.due.remaining)}</strong></span>
    </div>
  </section>
  ${v.cancelled && v.cancelReason ? `<div class="void-note"><b>${esc(t.cancelReason)} :</b> ${esc(v.cancelReason)}</div>` : ''}
  <section class="sign">
    <div class="sig"><div></div><p>${esc(t.signature)} — ${esc(v.org.name)}</p></div>
    ${stamp(v)}
  </section>
</div>
<footer class="foot">
  <div class="thanks">${esc(t.thanks)}</div>
  <div>${esc(t.keepProof)} · ${esc(t.issuedOn)} ${esc(v.issuedOn)}</div>
</footer>
</main>
<button class="btn" onclick="window.print()">${esc(t.print)}</button>
</body></html>`;
}
