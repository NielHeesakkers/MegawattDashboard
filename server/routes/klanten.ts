import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { upload, deletePhoto } from '../middleware/upload';
import { logAudit } from '../lib/audit';
import { saveLogoFile, autoFetchLogo } from '../lib/logo';

const router = Router();
const prisma = new PrismaClient();

const KLANTEN_SUBDIR = 'Klanten';

// List all klanten
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const klanten = await prisma.klant.findMany({
    orderBy: { name: 'asc' },
    include: {
      contacts: { orderBy: { order: 'asc' } },
      _count: { select: { projects: true } },
    },
  });
  res.json(klanten);
});

// Get single klant
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const klant = await prisma.klant.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      contacts: { orderBy: { order: 'asc' } },
      projects: true,
    },
  });
  if (!klant) {
    res.status(404).json({ error: 'Klant niet gevonden' });
    return;
  }
  res.json(klant);
});

interface KlantContactInput { naam: string; email?: string | null; telefoon?: string | null }

function parseContacts(raw: unknown): KlantContactInput[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c: KlantContactInput) => c && (c.naam?.trim() || c.email?.trim() || c.telefoon?.trim()))
      .map((c: KlantContactInput) => ({
        naam: (c.naam ?? '').trim(),
        email: c.email?.trim() || null,
        telefoon: c.telefoon?.trim() || null,
      }));
  } catch {
    return [];
  }
}

// Create klant
router.post(
  '/',
  authMiddleware,
  upload.single('logo'),
  async (req: AuthRequest, res: Response) => {
    const { name, contactPerson, email, adres, postcode, stad, land } = req.body;
    const contacts = parseContacts(req.body.contacts);

    let logo: string | null = null;
    if (req.file) {
      logo = await saveLogoFile(KLANTEN_SUBDIR, req.file.buffer, name);
    } else {
      // Auto-search logo online
      logo = await autoFetchLogo(KLANTEN_SUBDIR, name);
    }

    try {
      const klant = await prisma.klant.create({
        data: {
          name,
          contactPerson: contactPerson || null,
          email: email || null,
          logo,
          adres: adres || null,
          postcode: postcode || null,
          stad: stad || null,
          land: land || null,
          contacts: { create: contacts.map((c, i) => ({ ...c, order: i })) },
        },
        include: { contacts: { orderBy: { order: 'asc' } } },
      });
      await logAudit('CREATE', 'Klant', klant.id, { name, contacts: contacts.length }, req.adminUsername!);
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

    const { name, contactPerson, email, removeLogo, adres, postcode, stad, land } = req.body;
    const hasContactsField = req.body.contacts !== undefined;
    const contacts = parseContacts(req.body.contacts);

    let logo: string | null | undefined;

    if (req.file) {
      // New logo uploaded — delete old one if present
      if (existing.logo) deletePhoto(existing.logo);
      logo = await saveLogoFile(KLANTEN_SUBDIR, req.file.buffer, name || existing?.name);
    } else if (removeLogo === 'true') {
      // Explicitly remove logo
      if (existing.logo) deletePhoto(existing.logo);
      logo = null;
    }

    const resolvedLogo = logo !== undefined ? logo : existing.logo;

    try {
      const klant = await prisma.$transaction(async (tx) => {
        if (hasContactsField) {
          await tx.klantContact.deleteMany({ where: { klantId: id } });
        }
        return tx.klant.update({
          where: { id },
          data: {
            name: name ?? existing.name,
            contactPerson: contactPerson !== undefined ? (contactPerson || null) : existing.contactPerson,
            email: email !== undefined ? (email || null) : existing.email,
            logo: resolvedLogo,
            adres: adres !== undefined ? (adres || null) : existing.adres,
            postcode: postcode !== undefined ? (postcode || null) : existing.postcode,
            stad: stad !== undefined ? (stad || null) : existing.stad,
            land: land !== undefined ? (land || null) : existing.land,
            ...(hasContactsField
              ? { contacts: { create: contacts.map((c, i) => ({ ...c, order: i })) } }
              : {}),
          },
          include: { contacts: { orderBy: { order: 'asc' } } },
        });
      });
      await logAudit('UPDATE', 'Klant', klant.id, { name, contacts: contacts.length }, req.adminUsername!);
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

// Delete klant (only if no linked projecten/loc-projecten)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.klant.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'Klant niet gevonden' }); return; }

  const projectCount = await prisma.project.count({ where: { klantId: id } });
  if (projectCount > 0) {
    res.status(400).json({ error: `Kan klant niet verwijderen: er ${projectCount === 1 ? 'is' : 'zijn'} nog ${projectCount} project${projectCount === 1 ? '' : 'en'} gekoppeld` });
    return;
  }

  // Row-delete eerst, dan pas logo-file weg — zo blijft bij een fout de logo-referentie consistent.
  await prisma.klant.delete({ where: { id } });
  if (existing.logo) deletePhoto(existing.logo);
  await logAudit('DELETE', 'Klant', id, {}, req.adminUsername!);
  res.json({ success: true });
});

// Re-fetch logos for all klanten without a logo
router.post('/refetch-logos', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const klanten = await prisma.klant.findMany({ where: { logo: null } });
  const results: { name: string; found: boolean }[] = [];
  for (const klant of klanten) {
    const logo = await autoFetchLogo(KLANTEN_SUBDIR, klant.name);
    if (logo) {
      await prisma.klant.update({ where: { id: klant.id }, data: { logo } });
      results.push({ name: klant.name, found: true });
    } else {
      results.push({ name: klant.name, found: false });
    }
  }
  res.json({ results });
});

// POST /api/klanten/:id/refresh-logo — handmatig logo opnieuw zoeken
router.post('/:id/refresh-logo', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const klant = await prisma.klant.findUnique({ where: { id } });
  if (!klant) { res.status(404).json({ error: 'Klant niet gevonden' }); return; }
  const logo = await autoFetchLogo(KLANTEN_SUBDIR, klant.name);
  if (!logo) { res.status(404).json({ error: 'Geen logo gevonden' }); return; }
  const updated = await prisma.klant.update({ where: { id }, data: { logo } });
  res.json({ logo: updated.logo });
});

export default router;
