//echd-backend/src/common/signing.service.ts
import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/** Signature HMAC pour les liens temporaires (photos privées, documents partagés). */
@Injectable()
export class SigningService {
  private secret() {
    return process.env.FILES_SECRET || process.env.JWT_SECRET || 'dev-secret';
  }

  sign(payload: string, exp: number): string {
    return createHmac('sha256', this.secret()).update(`${payload}|${exp}`).digest('base64url');
  }

  /**
   * Lien temporaire vers un document imprimable (même format que POST /documents/share).
   * Utilisé par les e-mails de reçu et l'espace parents.
   */
  documentUrl(type: string, id: string, lang: 'fr' | 'ar', hours: number, term?: number): { url: string; expiresAt: Date } {
    const exp = Math.floor(Date.now() / 1000) + hours * 3600;
    const sig = this.sign(`${type}|${id}|${lang}|${term ?? ''}`, exp);
    const base = (process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
    const qs = new URLSearchParams({ lang, exp: String(exp), sig, ...(term ? { term: String(term) } : {}) });
    return { url: `${base}/api/documents/shared/${type}/${id}?${qs}`, expiresAt: new Date(exp * 1000) };
  }

  verify(payload: string, exp: number, sig: string): boolean {
    if (!sig || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.sign(payload, exp));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
