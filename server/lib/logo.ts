// Logo upload + auto-fetch helpers, herbruikbaar tussen klanten en toeleveranciers.
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { uploadsDir } from '../middleware/upload';

async function tryFetchImage(url: string, minBytes = 1000): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    // Sharp ondersteunt geen ICO — alleen PNG/JPEG/WebP/SVG/AVIF accepteren
    if (!/^image\/(png|jpe?g|webp|svg\+xml|avif)/i.test(contentType)) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < minBytes) return null;
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

/**
 * Probeer een bedrijfslogo op te halen via meerdere services.
 * Volgorde van best → fallback:
 * 1. apple-touch-icon van eigen website (vaak 180×180+)
 * 2. apple-touch-icon-precomposed
 * 3. /favicon.ico van eigen site (op moderne sites vaak hoge resolutie)
 * 4. Google favicon service (128×128)
 * 5. DuckDuckGo favicon service
 */
export async function autoFetchLogo(subdir: string, name: string): Promise<string | null> {
  try {
    const cleaned = name.toLowerCase()
      .replace(/\b(b\.?v\.?|n\.?v\.?|bv|nv|holding|group|groep|ltd|inc)\b/gi, '')
      .trim();
    const slug = cleaned.replace(/\s+/g, '');

    // Probeer meerdere TLD's
    for (const tld of ['.com', '.nl', '.eu']) {
      const domain = `${slug}${tld}`;
      // 1. Apple touch icons (hoogste kwaliteit als ze bestaan)
      for (const variant of ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png']) {
        const buf = await tryFetchImage(`https://${domain}/${variant}`, 1500);
        if (buf) return await saveLogoFile(subdir, buf, name);
      }
      // 2. Favicon direct van de site (modern: kan groot zijn)
      const direct = await tryFetchImage(`https://${domain}/favicon.ico`, 5000);
      if (direct) return await saveLogoFile(subdir, direct, name);
    }

    // 3. Google favicon service (laatste redmiddel)
    for (const tld of ['.com', '.nl', '.eu']) {
      const buf = await tryFetchImage(`https://www.google.com/s2/favicons?domain=${slug}${tld}&sz=128`, 1000);
      if (buf) return await saveLogoFile(subdir, buf, name);
    }

    // 4. DuckDuckGo als allerlaatste fallback
    for (const tld of ['.com', '.nl']) {
      const buf = await tryFetchImage(`https://icons.duckduckgo.com/ip3/${slug}${tld}.ico`, 1000);
      if (buf) return await saveLogoFile(subdir, buf, name);
    }

    return null;
  } catch {
    return null;
  }
}
