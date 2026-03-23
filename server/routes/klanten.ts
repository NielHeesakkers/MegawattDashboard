import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { upload, deletePhoto, uploadsDir } from '../middleware/upload';
import { logAudit } from '../lib/audit';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const router = Router();
const prisma = new PrismaClient();

const KLANTEN_SUBDIR = 'Klanten';

/** Try to fetch a usable image buffer from a URL. Returns null if too small or failed. */
async function tryFetchImage(url: string, minSize = 1000): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { redirect: 'follow' });
    const contentType = response.headers.get('content-type') || '';
    // Skip non-image responses
    if (!contentType.startsWith('image/')) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 500) return null;
    return buffer;
  } catch {
    return null;
  }
}

/** Try to fetch a logo via Google Favicons. */
async function autoFetchLogo(name: string): Promise<string | null> {
  try {
    const cleaned = name.toLowerCase().replace(/\b(b\.?v\.?|n\.?v\.?|bv|nv|holding|group|groep)\b/gi, '').trim();
    const slug = cleaned.replace(/\s+/g, '');

    for (const tld of ['.com', '.nl']) {
      const buffer = await tryFetchImage(`https://www.google.com/s2/favicons?domain=${slug}${tld}&sz=128`);
      if (buffer) return await saveLogoFile(buffer, name);
    }
    return null;
  } catch {
    return null;
  }
}

/** Save an uploaded logo buffer to uploads/Klanten/ with white background. */
async function saveLogoFile(buffer: Buffer, klantName?: string): Promise<string> {
  const targetDir = path.join(uploadsDir, KLANTEN_SUBDIR);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  // Generate a readable filename from klant name, or fallback to timestamp
  const slug = klantName
    ? klantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : `${Date.now()}`;
  const filename = `${slug}.jpg`;
  const outputPath = path.join(targetDir, filename);

  await sharp(buffer)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 85 })
    .toFile(outputPath);

  return `/uploads/${KLANTEN_SUBDIR}/${filename}`;
}

// List all klanten
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const klanten = await prisma.klant.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { projects: true } } },
  });
  res.json(klanten);
});

// Get single klant
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const klant = await prisma.klant.findUnique({
    where: { id: Number(req.params.id) },
    include: { projects: true },
  });
  if (!klant) {
    res.status(404).json({ error: 'Klant niet gevonden' });
    return;
  }
  res.json(klant);
});

// Create klant
router.post(
  '/',
  authMiddleware,
  upload.single('logo'),
  async (req: AuthRequest, res: Response) => {
    const { name, contactPerson, email } = req.body;

    let logo: string | null = null;
    if (req.file) {
      logo = await saveLogoFile(req.file.buffer, name);
    } else {
      // Auto-search logo online
      logo = await autoFetchLogo(name);
    }

    try {
      const klant = await prisma.klant.create({
        data: { name, contactPerson, email, logo },
      });
      await logAudit('CREATE', 'Klant', klant.id, { name, contactPerson, email }, req.adminUsername!);
      res.status(201).json(klant);
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === 'P2002') {
        res.status(400).json({ error: 'Er bestaat al een klant met deze naam' });
        return;
      }
      throw err;
    }
  }
);

// Update klant
router.put(
  '/:id',
  authMiddleware,
  upload.single('logo'),
  async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = await prisma.klant.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Klant niet gevonden' });
      return;
    }

    const { name, contactPerson, email, removeLogo } = req.body;

    let logo: string | null | undefined;

    if (req.file) {
      // New logo uploaded — delete old one if present
      if (existing.logo) deletePhoto(existing.logo);
      logo = await saveLogoFile(req.file.buffer, name || existing?.name);
    } else if (removeLogo === 'true') {
      // Explicitly remove logo
      if (existing.logo) deletePhoto(existing.logo);
      logo = null;
    }

    const resolvedLogo = logo !== undefined ? logo : existing.logo;

    try {
      const klant = await prisma.klant.update({
        where: { id },
        data: {
          name: name ?? existing.name,
          contactPerson: contactPerson !== undefined ? (contactPerson || null) : existing.contactPerson,
          email: email !== undefined ? (email || null) : existing.email,
          logo: resolvedLogo,
        },
      });
      await logAudit('UPDATE', 'Klant', klant.id, { name, contactPerson, email }, req.adminUsername!);
      res.json(klant);
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr.code === 'P2002') {
        res.status(400).json({ error: 'Er bestaat al een klant met deze naam' });
        return;
      }
      throw err;
    }
  }
);

// Delete klant (only if no linked projects)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.klant.findUnique({ where: { id } });
  const projectCount = await prisma.project.count({ where: { klantId: id } });
  if (projectCount > 0) {
    res.status(400).json({ error: 'Kan klant niet verwijderen: er zijn nog projecten gekoppeld' });
    return;
  }
  if (existing?.logo) deletePhoto(existing.logo);
  await prisma.klant.delete({ where: { id } });
  await logAudit('DELETE', 'Klant', id, {}, req.adminUsername!);
  res.json({ success: true });
});

// Re-fetch logos for all klanten without a logo
router.post('/refetch-logos', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const klanten = await prisma.klant.findMany({ where: { logo: null } });
  const results: { name: string; found: boolean }[] = [];
  for (const klant of klanten) {
    const logo = await autoFetchLogo(klant.name);
    if (logo) {
      await prisma.klant.update({ where: { id: klant.id }, data: { logo } });
      results.push({ name: klant.name, found: true });
    } else {
      results.push({ name: klant.name, found: false });
    }
  }
  res.json({ results });
});

export default router;
