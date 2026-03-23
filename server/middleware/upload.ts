import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { faceCrop } from '../lib/face-crop';

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

/** Factory: returns processPhoto middleware that saves into uploads/<subDir>/ */
export function processPhotoTo(subDir: string) {
  return async function (req: Request, _res: Response, next: NextFunction) {
    if (!req.file) return next();

    const targetDir = path.join(uploadsDir, subDir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
    const outputPath = path.join(targetDir, filename);
    const tmpInput = path.join(uploadsDir, `tmp-${filename}`);

    try {
      fs.writeFileSync(tmpInput, req.file.buffer);
      await faceCrop(tmpInput, outputPath, 200, 0.55);
      req.body.photo = `/uploads/${subDir}/${filename}`;
      next();
    } catch (err) {
      next(err);
    } finally {
      if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
    }
  };
}

/** Backward-compatible: saves into uploads root */
export async function processPhoto(req: Request, _res: Response, next: NextFunction) {
  if (!req.file) return next();

  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
  const outputPath = path.join(uploadsDir, filename);
  const tmpInput = path.join(uploadsDir, `tmp-${filename}`);

  try {
    fs.writeFileSync(tmpInput, req.file.buffer);
    await faceCrop(tmpInput, outputPath, 200, 0.55);
    req.body.photo = `/uploads/${filename}`;
    next();
  } catch (err) {
    next(err);
  } finally {
    if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
  }
}

export function deletePhoto(photoPath: string | null | undefined) {
  if (!photoPath) return;
  // Handle both /uploads/SubDir/file.jpg and legacy /uploads/file.jpg
  const relative = photoPath.startsWith('/uploads/')
    ? photoPath.substring('/uploads/'.length)
    : path.basename(photoPath);
  const fullPath = path.join(uploadsDir, relative);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

export { uploadsDir };
