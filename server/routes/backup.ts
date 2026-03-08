import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAudit } from '../lib/audit';
import archiver from 'archiver';
import multer from 'multer';
import extractZip from 'extract-zip';
import path from 'path';
import fs from 'fs';
import os from 'os';

const router = Router();
const prisma = new PrismaClient();

const PROJECT_ROOT = __dirname.includes(path.join('dist', 'server'))
  ? path.resolve(__dirname, '../../..')
  : path.resolve(__dirname, '../..');

const uploadsDir = path.resolve(PROJECT_ROOT, 'uploads');

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  },
});

interface BackupData {
  version: number;
  exportedAt: string;
  executives: any[];
  teams: any[];
  members: any[];
  clientTeams?: any[];
  clientTeamMembers?: any[];
  clients?: any[];
}

// Export: download ZIP with data.json + uploads/
router.get('/export', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [executives, teams, members, clientTeams, clientTeamMembers, clients] = await Promise.all([
      prisma.executive.findMany({ orderBy: { level: 'asc' } }),
      prisma.team.findMany({ orderBy: { order: 'asc' } }),
      prisma.member.findMany({ orderBy: [{ teamId: 'asc' }, { order: 'asc' }] }),
      prisma.clientTeam.findMany({ orderBy: { order: 'asc' } }),
      prisma.clientTeamMember.findMany({ orderBy: { order: 'asc' } }),
      prisma.client.findMany({ orderBy: [{ clientTeamId: 'asc' }, { order: 'asc' }] }),
    ]);

    const backupData: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      executives,
      teams,
      members,
      clientTeams,
      clientTeamMembers,
      clients,
    };

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', () => {
      if (!res.headersSent) res.status(500).json({ error: 'Export failed' });
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="megawatt-backup-${new Date().toISOString().slice(0, 10)}.zip"`);

    archive.pipe(res);
    archive.append(JSON.stringify(backupData, null, 2), { name: 'data.json' });

    if (fs.existsSync(uploadsDir)) {
      archive.directory(uploadsDir, 'uploads');
    }

    await archive.finalize();
    await logAudit('CREATE', 'Backup', 0, { action: 'export', executives: executives.length, teams: teams.length, members: members.length }, req.adminUsername);
  } catch (err) {
    console.error('Export failed:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Export failed' });
  }
});

// Import: upload ZIP, replace all data + photos
router.post('/import', authMiddleware, importUpload.single('backup'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No ZIP file uploaded' }); return; }

  const tmpZip = path.join(os.tmpdir(), `megawatt-import-${Date.now()}.zip`);
  const tmpDir = path.join(os.tmpdir(), `megawatt-import-${Date.now()}`);

  try {
    // Extract ZIP
    fs.writeFileSync(tmpZip, req.file.buffer);
    fs.mkdirSync(tmpDir, { recursive: true });
    await extractZip(tmpZip, { dir: tmpDir });

    // Validate data.json
    const dataPath = path.join(tmpDir, 'data.json');
    if (!fs.existsSync(dataPath)) { res.status(400).json({ error: 'ZIP must contain data.json' }); return; }

    const backupData: BackupData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    if (!backupData.executives || !backupData.teams || !backupData.members) {
      res.status(400).json({ error: 'Invalid backup data: missing executives, teams, or members' }); return;
    }

    // Replace data in transaction with ID remapping
    await prisma.$transaction(async (tx) => {
      await tx.client.deleteMany();
      await tx.clientTeamMember.deleteMany();
      await tx.clientTeam.deleteMany();
      await tx.member.deleteMany();
      await tx.team.deleteMany();
      await tx.executive.deleteMany();

      // Insert executives, map old ID → new ID
      const execIdMap = new Map<number, number>();
      for (const exec of backupData.executives) {
        const { id: oldId, ...data } = exec;
        const created = await tx.executive.create({ data });
        execIdMap.set(oldId, created.id);
      }

      // Insert teams with remapped executiveId
      const teamIdMap = new Map<number, number>();
      for (const team of backupData.teams) {
        const { id: oldId, members: _members, executive: _exec, ...data } = team;
        const created = await tx.team.create({
          data: {
            ...data,
            executiveId: data.executiveId ? (execIdMap.get(data.executiveId) ?? null) : null,
          },
        });
        teamIdMap.set(oldId, created.id);
      }

      // Insert members with remapped teamId
      const memberIdMap = new Map<number, number>();
      for (const member of backupData.members) {
        const { id: oldId, team: _team, ...data } = member;
        const newTeamId = teamIdMap.get(data.teamId);
        if (!newTeamId) continue;
        const created = await tx.member.create({
          data: {
            ...data,
            teamId: newTeamId,
          },
        });
        memberIdMap.set(oldId, created.id);
      }

      // Insert client teams with remapped executiveId
      if (backupData.clientTeams) {
        const ctIdMap = new Map<number, number>();
        for (const ct of backupData.clientTeams) {
          const { id: oldId, members: _m, clients: _c, executive: _e, ...data } = ct;
          const created = await tx.clientTeam.create({
            data: {
              ...data,
              executiveId: data.executiveId ? (execIdMap.get(data.executiveId) ?? null) : null,
            },
          });
          ctIdMap.set(oldId, created.id);
        }

        // Insert client team members with remapped IDs
        if (backupData.clientTeamMembers) {
          for (const ctm of backupData.clientTeamMembers) {
            const { id: _oldId, member: _m, ...data } = ctm;
            const newCtId = ctIdMap.get(data.clientTeamId);
            const newMemberId = memberIdMap.get(data.memberId);
            if (!newCtId || !newMemberId) continue;
            await tx.clientTeamMember.create({
              data: { ...data, clientTeamId: newCtId, memberId: newMemberId },
            });
          }
        }

        // Insert clients with remapped clientTeamId
        if (backupData.clients) {
          for (const client of backupData.clients) {
            const { id: _oldId, clientTeam: _ct, ...data } = client;
            const newCtId = ctIdMap.get(data.clientTeamId);
            if (!newCtId) continue;
            await tx.client.create({
              data: { ...data, clientTeamId: newCtId },
            });
          }
        }
      }
    });

    // Replace photos
    if (fs.existsSync(uploadsDir)) {
      for (const file of fs.readdirSync(uploadsDir)) {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
    } else {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const extractedUploads = path.join(tmpDir, 'uploads');
    if (fs.existsSync(extractedUploads)) {
      for (const photo of fs.readdirSync(extractedUploads)) {
        fs.copyFileSync(path.join(extractedUploads, photo), path.join(uploadsDir, photo));
      }
    }

    await logAudit('CREATE', 'Backup', 0, {
      action: 'import',
      executives: backupData.executives.length,
      teams: backupData.teams.length,
      members: backupData.members.length,
    }, req.adminUsername);

    res.json({
      success: true,
      imported: {
        executives: backupData.executives.length,
        teams: backupData.teams.length,
        members: backupData.members.length,
      },
    });
  } catch (err) {
    console.error('Import failed:', err);
    res.status(500).json({ error: 'Import failed' });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);
  }
});

// Clear: delete all dashboard data + photos (keep admin users + audit logs)
router.delete('/clear', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [memberCount, teamCount, execCount] = await Promise.all([
      prisma.member.count(),
      prisma.team.count(),
      prisma.executive.count(),
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.client.deleteMany();
      await tx.clientTeamMember.deleteMany();
      await tx.clientTeam.deleteMany();
      await tx.member.deleteMany();
      await tx.team.deleteMany();
      await tx.executive.deleteMany();
    });

    // Delete all photos
    if (fs.existsSync(uploadsDir)) {
      for (const file of fs.readdirSync(uploadsDir)) {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
    }

    await logAudit('DELETE', 'Backup', 0, {
      action: 'clear',
      deletedMembers: memberCount,
      deletedTeams: teamCount,
      deletedExecutives: execCount,
    }, req.adminUsername);

    res.json({ success: true, deleted: { members: memberCount, teams: teamCount, executives: execCount } });
  } catch (err) {
    console.error('Clear failed:', err);
    res.status(500).json({ error: 'Clear failed' });
  }
});

export default router;
