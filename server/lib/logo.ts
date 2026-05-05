// Logo upload + auto-fetch helpers, herbruikbaar tussen klanten en toeleveranciers.
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { uploadsDir } from '../middleware/upload';

async function tryFetchImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { redirect: 'follow' });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 500) return null;
    return buffer;
  } catch {
    return null;
  }
}

/** Save logo buffer to uploads/{subdir}/ as a slug-named JPEG with white background. */
export async function saveLogoFile(subdir: string, buffer: Buffer, name?: string): Promise<string> {
  const targetDir = path.join(uploadsDir, subdir);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const slug = name
    ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : `${Date.now()}`;
  const filename = `${slug}.jpg`;
  const outputPath = path.join(targetDir, filename);

  await sharp(buffer)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 85 })
    .toFile(outputPath);

  return `/uploads/${subdir}/${filename}`;
}

/** Probeer Google's favicon-service voor een bedrijfslogo. Retourneert /uploads/...-pad of null. */
export async function autoFetchLogo(subdir: string, name: string): Promise<string | null> {
  try {
    const cleaned = name.toLowerCase().replace(/\b(b\.?v\.?|n\.?v\.?|bv|nv|holding|group|groep)\b/gi, '').trim();
    const slug = cleaned.replace(/\s+/g, '');

    for (const tld of ['.com', '.nl']) {
      const buffer = await tryFetchImage(`https://www.google.com/s2/favicons?domain=${slug}${tld}&sz=128`);
      if (buffer) return await saveLogoFile(subdir, buffer, name);
    }
    return null;
  } catch {
    return null;
  }
}
