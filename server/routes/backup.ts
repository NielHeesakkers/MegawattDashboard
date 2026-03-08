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
const backupDir = path.resolve(PROJECT_ROOT, 'Backup');

// Ensure Backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

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
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    res.setHeader('Content-Disposition', `attachment; filename="megawatt-backup-${dd}-${mm}-${yyyy}.zip"`);

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
            const { id: _oldId, member: _m, executive: _e, ...data } = ctm;
            const newCtId = ctIdMap.get(data.clientTeamId);
            if (!newCtId) continue;
            const newMemberId = data.memberId ? memberIdMap.get(data.memberId) ?? null : null;
            const newExecId = data.executiveId ? execIdMap.get(data.executiveId) ?? null : null;
            if (!newMemberId && !newExecId) continue;
            await tx.clientTeamMember.create({
              data: { ...data, clientTeamId: newCtId, memberId: newMemberId, executiveId: newExecId },
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

// ---- Auto backup ----

async function createAutoBackup(): Promise<string | null> {
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

    const date = new Date();
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const hhmm = date.toTimeString().slice(0, 5).replace(':', '');
    const filename = `megawatt-backup-${dd}-${mm}-${yyyy}_${hhmm}.zip`;
    const outputPath = path.join(backupDir, filename);

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      archive.append(JSON.stringify(backupData, null, 2), { name: 'data.json' });
      if (fs.existsSync(uploadsDir)) {
        archive.directory(uploadsDir, 'uploads');
      }
      archive.finalize();
    });

    // Keep max 30 backups, delete oldest
    const files = fs.readdirSync(backupDir)
      .filter((f) => f.startsWith('megawatt-backup-') && f.endsWith('.zip'))
      .sort()
      .reverse();
    for (const old of files.slice(30)) {
      fs.unlinkSync(path.join(backupDir, old));
    }

    console.log(`[Auto Backup] Created: ${filename}`);
    return filename;
  } catch (err) {
    console.error('[Auto Backup] Failed:', err);
    return null;
  }
}

// Schedule daily auto backup (every 24 hours, first run 1 minute after start)
setTimeout(() => {
  createAutoBackup();
  setInterval(createAutoBackup, 24 * 60 * 60 * 1000);
}, 60 * 1000);

// GET /api/backup/list — list local backups
router.get('/list', authMiddleware, async (_req, res: Response) => {
  try {
    const files = fs.readdirSync(backupDir)
      .filter((f) => f.startsWith('megawatt-backup-') && f.endsWith('.zip'))
      .map((filename) => {
        const stat = fs.statSync(path.join(backupDir, filename));
        return { filename, size: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({ backups: files });
  } catch {
    res.json({ backups: [] });
  }
});

// GET /api/backup/download/:filename — download a specific backup
router.get('/download/:filename', authMiddleware, (req, res: Response) => {
  const filename = req.params.filename as string;
  // Sanitize filename
  if (!filename.startsWith('megawatt-backup-') || !filename.endsWith('.zip') || filename.includes('..')) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }
  const filePath = path.join(backupDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Backup not found' });
    return;
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

// DELETE /api/backup/delete/:filename — delete a specific backup
router.delete('/delete/:filename', authMiddleware, async (req: AuthRequest, res: Response) => {
  const filename = req.params.filename as string;
  if (!filename.startsWith('megawatt-backup-') || !filename.endsWith('.zip') || filename.includes('..')) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }
  const filePath = path.join(backupDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Backup not found' });
    return;
  }
  fs.unlinkSync(filePath);
  await logAudit('DELETE', 'Backup', 0, { action: 'delete-backup', filename }, req.adminUsername);
  res.json({ success: true });
});

// POST /api/backup/auto — trigger manual auto backup
router.post('/auto', authMiddleware, async (req: AuthRequest, res: Response) => {
  const filename = await createAutoBackup();
  if (filename) {
    await logAudit('CREATE', 'Backup', 0, { action: 'auto-backup', filename }, req.adminUsername);
    res.json({ success: true, filename });
  } else {
    res.status(500).json({ error: 'Backup failed' });
  }
});

export default router;
