import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

// Derive project root from this file's location:
// Dev (tsx):  __dirname = <project>/server       → root = ..
// Prod (node): __dirname = <project>/dist/server → root = ../..
const PROJECT_ROOT = __dirname.includes(path.join('dist', 'server'))
  ? path.resolve(__dirname, '../..')
  : path.resolve(__dirname, '..');

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

import authRoutes from './routes/auth';
import teamRoutes from './routes/teams';
import memberRoutes from './routes/members';
import executiveRoutes from './routes/executives';
import auditRoutes from './routes/audit';
import backupRoutes from './routes/backup';
import clientTeamRoutes from './routes/client-teams';
import clientTeamMemberRoutes from './routes/client-team-members';
import clientRoutes from './routes/clients';
import settingsRoutes from './routes/settings';
import shareEmailRoutes from './routes/share-email';
import klantenRoutes from './routes/klanten';
import projectRoutes from './routes/projects';
import superchargerRoutes from './routes/superchargers';
import locationRoutes from './routes/locations';
import locProjectRoutes from './routes/loc-projects';
import toeleveranciersRoutes from './routes/toeleveranciers';
import specialismesRoutes from './routes/specialismes';

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.resolve(PROJECT_ROOT, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/executives', executiveRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/client-teams', clientTeamRoutes);
app.use('/api/client-team-members', clientTeamMemberRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/share-email', shareEmailRoutes);
app.use('/api/klanten', klantenRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/superchargers', superchargerRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/loc-projects', locProjectRoutes);
app.use('/api/toeleveranciers', toeleveranciersRoutes);
app.use('/api/specialismes', specialismesRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler — log errors to stdout
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]', err?.message || err);
  if (err?.stack) console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// In production, serve the built frontend (single process)
const clientDist = path.resolve(PROJECT_ROOT, 'dist/client');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
