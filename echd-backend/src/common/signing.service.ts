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

  verify(payload: string, exp: number, sig: string): boolean {
    if (!sig || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.sign(payload, exp));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
