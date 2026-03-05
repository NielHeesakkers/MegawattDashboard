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

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(PROJECT_ROOT, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/executives', executiveRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/backup', backupRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
