import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { upload, deletePhoto } from '../middleware/upload';
import { logAudit } from '../lib/audit';
import { saveLogoFile, autoFetchLogo } from '../lib/logo';

const router = Router();
const prisma = new PrismaClient();

const SUBDIR = 'Toeleveranciers';

const INCLUDE = {
  contacts: { orderBy: { order: 'asc' } },
  specialismes: { include: { specialisme: true } },
} as const;

router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const items = await prisma.toeleverancier.findMany({ orderBy: { name: 'asc' }, include: INCLUDE });
  res.json(items);
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const item = await prisma.toeleverancier.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!item) { res.status(404).json({ error: 'Toeleverancier niet gevonden' }); return; }
  res.json(item);
});

interface ContactInput { naam: string; email?: string | null; telefoon?: string | null }

function parseContacts(raw: unknown): ContactInput[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c: ContactInput) => c && (c.naam?.trim() || c.email?.trim() || c.telefoon?.trim()))
      .map((c: ContactInput) => ({
        naam: (c.naam ?? '').trim(),
        email: c.email?.trim() || null,
        telefoon: c.telefoon?.trim() || null,
      }));
  } catch { return []; }
}

function parseSpecialismeIds(raw: unknown): number[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter((n) => !isNaN(n));
  } catch { return []; }
}

router.post('/', authMiddleware, upload.single('logo'), async (req: AuthRequest, res: Response) => {
  const { name, contactPerson, email, adres, postcode, stad, land } = req.body;
  const contacts = parseContacts(req.body.contacts);
  const specialismeIds = parseSpecialismeIds(req.body.specialismeIds);

  let logo: string | null = null;
  if (req.file) {
    logo = await saveLogoFile(SUBDIR, req.file.buffer, name);
  } else {
    logo = await autoFetchLogo(SUBDIR, name);
  }

  try {
    const item = await prisma.toeleverancier.create({
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
        specialismes: { create: specialismeIds.map((specialismeId) => ({ specialismeId })) },
      },
      include: INCLUDE,
    });
    await logAudit('CREATE', 'Toeleverancier', item.id, { name }, req.adminUsername!);
    res.status(201).json(item);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'P2002') { res.status(400).json({ error: 'Er bestaat al een toeleverancier met deze naam' }); return; }
    throw err;
  }
});

router.put('/:id', authMiddleware, upload.single('logo'), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.toeleverancier.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'Toeleverancier niet gevonden' }); return; }

  const { name, contactPerson, email, removeLogo, adres, postcode, stad, land } = req.body;
  const hasContactsField = req.body.contacts !== undefined;
  const hasSpecialismeField = req.body.specialismeIds !== undefined;
  const contacts = parseContacts(req.body.contacts);
  const specialismeIds = parseSpecialismeIds(req.body.specialismeIds);

  let logo: string | null | undefined;
  if (req.file) {
    if (existing.logo) deletePhoto(existing.logo);
    logo = await saveLogoFile(SUBDIR, req.file.buffer, name || existing.name);
  } else if (removeLogo === 'true') {
    if (existing.logo) deletePhoto(existing.logo);
    logo = null;
  }
  const resolvedLogo = logo !== undefined ? logo : existing.logo;

  try {
    const item = await prisma.$transaction(async (tx) => {
      if (hasContactsField) {
        await tx.toeleverancierContact.deleteMany({ where: { toeleverancierId: id } });
      }
      if (hasSpecialismeField) {
        await tx.toeleverancierSpecialisme.deleteMany({ where: { toeleverancierId: id } });
      }
      return tx.toeleverancier.update({
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
          ...(hasSpecialismeField
            ? { specialismes: { create: specialismeIds.map((specialismeId) => ({ specialismeId })) } }
            : {}),
        },
        include: INCLUDE,
      });
    });
    await logAudit('UPDATE', 'Toeleverancier', item.id, { name }, req.adminUsername!);
    res.json(item);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'P2002') { res.status(400).json({ error: 'Er bestaat al een toeleverancier met deze naam' }); return; }
    throw err;
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = await prisma.toeleverancier.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ error: 'Toeleverancier niet gevonden' }); return; }

  await prisma.toeleverancier.delete({ where: { id } });
  if (existing.logo) deletePhoto(existing.logo);
  await logAudit('DELETE', 'Toeleverancier', id, {}, req.adminUsername!);
  res.json({ success: true });
});

export default router;
