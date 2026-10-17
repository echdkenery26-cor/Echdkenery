import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { SigningService } from './signing.service';

export type Scope = 'public' | 'private';
export type ImageKind = 'portrait' | 'image' | 'logo';

const KINDS: Record<ImageKind, { w: number; h: number; fit: 'cover' | 'inside' }> = {
  portrait: { w: 480, h: 480, fit: 'cover' }, // recadrage automatique carré
  image: { w: 1600, h: 1600, fit: 'inside' },
  logo: { w: 512, h: 512, fit: 'inside' },
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const REL = /^(public|private)\/[a-z0-9_-]+\/[A-Za-z0-9_-]+\.webp$/;

/**
 * Stockage des images :
 *  - si CLOUDINARY_URL est défini → Cloudinary (conservé entre les déploiements, idéal en production) ;
 *  - sinon → dossier local UPLOAD_DIR (développement, ou serveur avec disque persistant).
 * Dans les deux cas, la base de données ne garde que la clé « scope/dossier/uuid.webp ».
 */
export const USE_CLOUDINARY = !!process.env.CLOUDINARY_URL;
if (USE_CLOUDINARY) cloudinary.config({ secure: true });

@Injectable()
export class FilesService {
  private readonly logger = new Logger('Files');
  readonly root = resolve(process.env.UPLOAD_DIR || 'uploads');

  constructor(private signing: SigningService) {
    this.logger.log(USE_CLOUDINARY ? 'Stockage des images : Cloudinary' : `Stockage des images : disque (${this.root})`);
  }

  /* ───── Cloudinary : correspondances clé ↔ identifiant ───── */

  private pid(rel: string) {
    this.check(rel);
    return 'echd/' + rel.replace(/\.webp$/, '');
  }
  private ctype(rel: string) {
    return rel.startsWith('public/') ? 'upload' : 'authenticated';
  }
  private cloudUrl(rel: string) {
    return cloudinary.url(this.pid(rel), {
      resource_type: 'image',
      type: this.ctype(rel),
      sign_url: this.ctype(rel) === 'authenticated',
      secure: true,
      format: 'webp',
    });
  }
  private uploadBuffer(buf: Buffer, rel: string) {
    return new Promise<void>((ok, ko) => {
      cloudinary.uploader
        .upload_stream(
          { public_id: this.pid(rel), resource_type: 'image', type: this.ctype(rel), overwrite: false, invalidate: true },
          (err) => (err ? ko(err) : ok()),
        )
        .end(buf);
    });
  }

  /** Contenu d'un fichier (null s'il n'existe pas). */
  async read(rel: string): Promise<Buffer | null> {
    if (USE_CLOUDINARY) {
      try {
        const res = await fetch(this.cloudUrl(rel));
        return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
      } catch {
        return null;
      }
    }
    try {
      return await fs.readFile(this.abs(rel));
    } catch {
      return null;
    }
  }

  /** Valide, recadre, compresse (WebP) et enregistre une image. Retourne le chemin relatif. */
  async saveImage(buffer: Buffer, scope: Scope, folder: string, kind: ImageKind = 'portrait'): Promise<string> {
    if (!buffer?.length) throw new BadRequestException('Fichier vide.');
    if (buffer.length > MAX_UPLOAD_BYTES) throw new BadRequestException('Image trop lourde (5 Mo maximum).');
    const cfg = KINDS[kind];
    let out: Buffer;
    try {
      out = await sharp(buffer, { failOn: 'error', limitInputPixels: 50_000_000 })
        .rotate()
        .resize(cfg.w, cfg.h, { fit: cfg.fit, withoutEnlargement: cfg.fit === 'inside' })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestException("Le fichier n'est pas une image valide (JPEG, PNG ou WebP).");
    }
    const rel = `${scope}/${folder}/${randomUUID()}.webp`;
    if (USE_CLOUDINARY) {
      try {
        await this.uploadBuffer(out, rel);
      } catch (e) {
        this.logger.error(`Envoi Cloudinary impossible : ${(e as Error)?.message ?? e}`);
        throw new BadRequestException("L'image n'a pas pu être enregistrée. Réessayez dans un instant.");
      }
      return rel;
    }
    const abs = this.abs(rel);
    await fs.mkdir(join(abs, '..'), { recursive: true });
    await fs.writeFile(abs, out);
    return rel;
  }

  /** Copie un fichier existant vers un autre dossier (ex. photo de préinscription → fiche élève). */
  async copy(rel: string, scope: Scope, folder: string): Promise<string | null> {
    try {
      const dest = `${scope}/${folder}/${randomUUID()}.webp`;
      if (USE_CLOUDINARY) {
        const buf = await this.read(rel);
        if (!buf) return null;
        await this.uploadBuffer(buf, dest);
        return dest;
      }
      await fs.mkdir(join(this.abs(dest), '..'), { recursive: true });
      await fs.copyFile(this.abs(rel), this.abs(dest));
      return dest;
    } catch {
      return null;
    }
  }

  async move(rel: string, scope: Scope, folder: string): Promise<string | null> {
    const dest = await this.copy(rel, scope, folder);
    if (dest) await this.remove(rel);
    return dest;
  }

  async exists(rel: string): Promise<boolean> {
    if (USE_CLOUDINARY) {
      try {
        await cloudinary.api.resource(this.pid(rel), { resource_type: 'image', type: this.ctype(rel) });
        return true;
      } catch {
        return false;
      }
    }
    try {
      await fs.access(this.abs(rel));
      return true;
    } catch {
      return false;
    }
  }

  async remove(rel?: string | null) {
    if (!rel) return;
    if (USE_CLOUDINARY) {
      try {
        await cloudinary.uploader.destroy(this.pid(rel), { resource_type: 'image', type: this.ctype(rel), invalidate: true });
      } catch {
        /* déjà absent */
      }
      return;
    }
    try {
      await fs.unlink(this.abs(rel));
    } catch {
      /* déjà absent */
    }
  }

  /** Supprime les fichiers temporaires de plus de `hours` heures. */
  async cleanTmp(hours = 24) {
    if (USE_CLOUDINARY) {
      try {
        const limit = Date.now() - hours * 3600_000;
        const r = await cloudinary.api.resources({ resource_type: 'image', type: 'authenticated', prefix: 'echd/private/tmp/', max_results: 100 });
        const old: string[] = (r.resources || []).filter((x: any) => new Date(x.created_at).getTime() < limit).map((x: any) => x.public_id);
        if (old.length) await cloudinary.api.delete_resources(old, { resource_type: 'image', type: 'authenticated' });
      } catch {
        /* nettoyage facultatif */
      }
      return;
    }
    const dir = join(this.root, 'private', 'tmp');
    try {
      const files = await fs.readdir(dir);
      const limit = Date.now() - hours * 3600_000;
      for (const f of files) {
        const p = join(dir, f);
        const st = await fs.stat(p);
        if (st.mtimeMs < limit) await fs.unlink(p);
      }
    } catch {
      /* dossier absent */
    }
  }

  /** Chemin absolu sécurisé (interdit toute sortie du dossier d'upload). */
  abs(rel: string): string {
    this.check(rel);
    return join(this.root, rel);
  }

  private check(rel: string) {
    if (!REL.test(rel)) throw new BadRequestException('Chemin de fichier invalide.');
  }

  private base() {
    return (process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
  }

  /** URL utilisable par le navigateur : publique, ou signée (6 h) pour les fichiers privés. */
  url(rel?: string | null, ttlSeconds = 6 * 3600): string | null {
    if (!rel) return null;
    const [scope, folder, name] = rel.split('/');
    if (scope === 'public') return USE_CLOUDINARY ? this.cloudUrl(rel) : `${this.base()}/api/files/public/${folder}/${name}`;
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = this.signing.sign(rel, exp);
    return `${this.base()}/api/files/private/${folder}/${name}?exp=${exp}&sig=${sig}`;
  }

  /** Remplace `photo` par une URL prête à l'emploi (conserve le chemin dans photoPath). */
  withPhoto<T extends { photo?: string | null }>(obj: T): T & { photoUrl: string | null } {
    return { ...obj, photoUrl: this.url(obj.photo) };
  }
}
