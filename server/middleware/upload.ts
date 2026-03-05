import multer from 'multer';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

const execFileAsync = promisify(execFile);

// Derive project root from this file's location:
// Dev (tsx):  __dirname = <project>/server/middleware       → root = ../..
// Prod (node): __dirname = <project>/dist/server/middleware → root = ../../..
const PROJECT_ROOT = __dirname.includes(path.join('dist', 'server'))
  ? path.resolve(__dirname, '../../..')
  : path.resolve(__dirname, '../..');

const uploadsDir = path.resolve(PROJECT_ROOT, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const PYTHON_BIN = path.resolve(PROJECT_ROOT, '.venv/bin/python3');
const FACE_CROP_SCRIPT = path.resolve(PROJECT_ROOT, 'server/lib/face_crop.py');

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are allowed'));
    }
  },
});

export async function processPhoto(req: Request, _res: Response, next: NextFunction) {
  if (!req.file) return next();

  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
  const outputPath = path.join(uploadsDir, filename);
  const tmpInput = path.join(uploadsDir, `tmp-${filename}`);

  try {
    // Write buffer to temp file for face-crop-plus
    fs.writeFileSync(tmpInput, req.file.buffer);

    await execFileAsync(PYTHON_BIN, [FACE_CROP_SCRIPT, tmpInput, outputPath, '200', '0.4'], {
      timeout: 30000,
    });

    req.body.photo = `/uploads/${filename}`;
    next();
  } catch (err) {
    next(err);
  } finally {
    // Clean up temp file
    if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
  }
}

export function deletePhoto(photoPath: string | null | undefined) {
  if (!photoPath) return;
  const fullPath = path.join(uploadsDir, path.basename(photoPath));
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}
