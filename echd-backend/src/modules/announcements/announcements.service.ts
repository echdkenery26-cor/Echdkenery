import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Announcement, Prisma } from '@prisma/client';
import { Actor, AuditService } from '../../common/audit.service';
import { FilesService } from '../../common/files.service';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../../common/settings.service';
import { pageArgs, pageResult } from '../../common/utils';
import { AnnouncementQuery, CreateAnnouncementDto, UpdateAnnouncementDto } from './announcements.dto';

export type Visibility = 'draft' | 'scheduled' | 'live' | 'expired';

@Injectable()
export class AnnouncementsService {
  constructor(
    private prisma: PrismaService,
    private files: FilesService,
    private settings: SettingsService,
    private audit: AuditService,
  ) {}

  private visibility(a: Announcement, now = new Date()): Visibility {
    if (a.status === 'DRAFT') return 'draft';
    if (a.expiresAt && a.expiresAt <= now) return 'expired';
    if (a.publishAt && a.publishAt > now) return 'scheduled';
    return 'live';
  }

  private present(a: Announcement) {
    return { ...a, imageUrl: this.files.url(a.image), visibility: this.visibility(a) };
  }

  /** Conditions « visible sur le site maintenant ». */
  private liveWhere(now = new Date()): Prisma.AnnouncementWhereInput {
    return {
      status: 'PUBLISHED',
      AND: [
        { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    };
  }

  private async assertCategory(code?: string) {
    if (!code) return;
    const cats = await this.settings.get<{ code: string }[]>('announcement.categories');
    if (!cats.some((c) => c.code === code)) throw new BadRequestException(`Catégorie inconnue : ${code}.`);
  }

  private checkDates(publishAt?: string | null, expiresAt?: string | null) {
    if (publishAt && expiresAt && new Date(expiresAt) <= new Date(publishAt)) {
      throw new BadRequestException("La date d'expiration doit être après la date de publication.");
    }
  }

  /* ───────── Administration ───────── */

  async list(q: AnnouncementQuery) {
    const where: Prisma.AnnouncementWhereInput = {
      status: q.status,
      category: q.category,
      ...(q.q?.trim()
        ? { OR: [{ titleFr: { contains: q.q.trim(), mode: 'insensitive' } }, { titleAr: { contains: q.q.trim() } }] }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({ where, ...pageArgs(q), orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }] }),
    ]);
    return pageResult(rows.map((r) => this.present(r)), total, q);
  }

  async get(id: string) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Annonce introuvable.');
    return this.present(a);
  }

  async create(dto: CreateAnnouncementDto, actor: Actor & { id: string }, ip?: string) {
    await this.assertCategory(dto.category);
    this.checkDates(dto.publishAt, dto.expiresAt);
    const a = await this.prisma.announcement.create({
      data: {
        ...dto,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: actor.id,
      },
    });
    await this.audit.log(actor, 'CREATE', 'Announcement', a.id, undefined, a, ip);
    return this.present(a);
  }

  async update(id: string, dto: UpdateAnnouncementDto, actor: Actor, ip?: string) {
    const before = await this.prisma.announcement.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Annonce introuvable.');
    await this.assertCategory(dto.category);
    this.checkDates(dto.publishAt === undefined ? before.publishAt?.toISOString() : dto.publishAt, dto.expiresAt === undefined ? before.expiresAt?.toISOString() : dto.expiresAt);
    const a = await this.prisma.announcement.update({
      where: { id },
      data: {
        ...dto,
        publishAt: dto.publishAt === undefined ? undefined : dto.publishAt ? new Date(dto.publishAt) : null,
        expiresAt: dto.expiresAt === undefined ? undefined : dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    await this.audit.log(actor, 'UPDATE', 'Announcement', id, before, a, ip);
    return this.present(a);
  }

  async setStatus(id: string, status: 'DRAFT' | 'PUBLISHED', actor: Actor, ip?: string) {
    return this.update(id, { status }, actor, ip);
  }

  async setImage(id: string, buffer: Buffer) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Annonce introuvable.');
    const image = await this.files.saveImage(buffer, 'public', 'announcements', 'image');
    await this.prisma.announcement.update({ where: { id }, data: { image } });
    await this.files.remove(a.image);
    return { imageUrl: this.files.url(image) };
  }

  async removeImage(id: string) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Annonce introuvable.');
    await this.prisma.announcement.update({ where: { id }, data: { image: null } });
    await this.files.remove(a.image);
    return { ok: true };
  }

  async remove(id: string, actor: Actor, ip?: string) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Annonce introuvable.');
    await this.prisma.announcement.delete({ where: { id } });
    await this.files.remove(a.image);
    await this.audit.log(actor, 'DELETE', 'Announcement', id, a, undefined, ip);
    return { ok: true };
  }

  /* ───────── Site public ───────── */

  async publicList(opts: { limit?: number; category?: string; page?: number }) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const where: Prisma.AnnouncementWhereInput = { ...this.liveWhere(), category: opts.category };
    const [total, rows] = await Promise.all([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { publishAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: limit,
        skip: ((opts.page ?? 1) - 1) * limit,
      }),
    ]);
    return { items: rows.map((r) => this.publicShape(r)), total };
  }

  async publicGet(id: string) {
    const a = await this.prisma.announcement.findFirst({ where: { id, ...this.liveWhere() } });
    if (!a) throw new NotFoundException('Annonce introuvable.');
    return this.publicShape(a);
  }

  /** Bandeau d'alerte : annonces urgentes actuellement en ligne. */
  async banner() {
    const urgent = await this.settings.get<string>('announcement.urgentCategory');
    const rows = await this.prisma.announcement.findMany({
      where: { ...this.liveWhere(), category: urgent },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 3,
    });
    return rows.map((r) => this.publicShape(r));
  }

  private publicShape(a: Announcement) {
    return {
      id: a.id,
      titleFr: a.titleFr,
      titleAr: a.titleAr,
      bodyFr: a.bodyFr,
      bodyAr: a.bodyAr,
      category: a.category,
      pinned: a.pinned,
      showHijri: a.showHijri,
      publishedAt: a.publishAt ?? a.createdAt,
      imageUrl: this.files.url(a.image),
    };
  }
}
