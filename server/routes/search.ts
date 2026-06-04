import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * Globale zoekopdracht — doorzoekt alle entiteiten en retourneert gegroepeerde resultaten.
 * GET /api/search?q=<query>
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) {
    res.json({ members: [], executives: [], klanten: [], toeleveranciers: [], locaties: [], projecten: [] });
    return;
  }

  const LIMIT = 8;
  // SQLite case-insensitive zoeken via LOWER + LIKE
  const like = `%${q.toLowerCase()}%`;

  const [members, executives, klanten, toeleveranciers, locaties, projecten] = await Promise.all([
    prisma.member.findMany({
      where: { OR: [
        { name:  { contains: q } },
        { role:  { contains: q } },
        { email: { contains: q } },
      ] },
      select: { id: true, name: true, role: true, email: true, photo: true, team: { select: { id: true, name: true } } },
      take: LIMIT,
      orderBy: { name: 'asc' },
    }),
    prisma.executive.findMany({
      where: { OR: [
        { name:  { contains: q } },
        { role:  { contains: q } },
        { email: { contains: q } },
      ] },
      select: { id: true, name: true, role: true, email: true, photo: true },
      take: LIMIT,
      orderBy: { name: 'asc' },
    }),
    prisma.klant.findMany({
      where: { OR: [
        { name:          { contains: q } },
        { contactPerson: { contains: q } },
        { email:         { contains: q } },
        { stad:          { contains: q } },
      ] },
      select: { id: true, name: true, logo: true, stad: true, land: true },
      take: LIMIT,
      orderBy: { name: 'asc' },
    }),
    prisma.toeleverancier.findMany({
      where: { OR: [
        { name:          { contains: q } },
        { contactPerson: { contains: q } },
        { email:         { contains: q } },
        { stad:          { contains: q } },
      ] },
      select: { id: true, name: true, logo: true, stad: true, land: true },
      take: LIMIT,
      orderBy: { name: 'asc' },
    }),
    prisma.location.findMany({
      where: { OR: [
        { naam:  { contains: q } },
        { adres: { contains: q } },
        { stad:  { contains: q } },
        { code:  { contains: q } },
      ] },
      select: { id: true, code: true, naam: true, stad: true, land: true },
      take: LIMIT,
      orderBy: { naam: 'asc' },
    }),
    prisma.project.findMany({
      where: { OR: [
        { name:          { contains: q } },
        { projectNumber: { contains: q } },
      ] },
      select: { id: true, name: true, projectNumber: true, klant: { select: { name: true } } },
      take: LIMIT,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  void like;
  res.json({ members, executives, klanten, toeleveranciers, locaties, projecten });
});

export default router;
