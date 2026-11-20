import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_DRIVE_FOLDER_ID = '13Ii_V2aNXTZUbuvefWLIbS_L6jP0mMfR';

interface ParsedDriveImage {
  id: string;
  name: string;
  url: string;
  fallbackUrl: string;
  modified: string;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_m, dec: string) =>
      String.fromCharCode(Number(dec))
    )
    .trim();
}

function extractDriveFolderId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{8,120}$/.test(trimmed)) return trimmed;
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch?.[1]) return idMatch[1];
  return null;
}

function parseEmbeddedDriveHtml(
  html: string,
  folderId: string
): { folderName: string; images: ParsedDriveImage[] } {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const folderName = titleMatch?.[1]
    ? decodeHtmlEntities(titleMatch[1])
    : `Carpeta ${folderId}`;

  const images: ParsedDriveImage[] = [];
  const entrySplit = html.split('<div class="flip-entry" id="entry-');

  for (let i = 1; i < entrySplit.length; i++) {
    const chunk = entrySplit[i];
    const idMatch = chunk.match(/^([a-zA-Z0-9_-]+)"/);
    if (!idMatch?.[1]) continue;
    const id = idMatch[1];

    const titleElMatch = chunk.match(
      /<div class="flip-entry-title">([\s\S]*?)<\/div>/i
    );
    const rawName = titleElMatch?.[1]
      ? decodeHtmlEntities(titleElMatch[1].replace(/<[^>]+>/g, ''))
      : `Foto ${images.length + 1}`;

    const isImageByType =
      /type\/image\//i.test(chunk) ||
      /alt="[^"]*Image[^"]*"/i.test(chunk) ||
      /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(rawName);

    if (!isImageByType) continue;

    const modifiedMatch = chunk.match(
      /<div class="flip-entry-last-modified">\s*<div>([\s\S]*?)<\/div>/i
    );
    const modified = modifiedMatch?.[1]
      ? decodeHtmlEntities(modifiedMatch[1])
      : '';

    images.push({
      id,
      name: rawName,
      url: `https://lh3.googleusercontent.com/d/${id}=w1920`,
      fallbackUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w1920`,
      modified,
    });
  }

  return { folderName, images };
}

async function startServer(): Promise<void> {
  const app = express();

  app.get('/api/drive-folder', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    const rawInput =
      typeof req.query.folderId === 'string'
        ? req.query.folderId
        : typeof req.query.url === 'string'
          ? req.query.url
          : DEFAULT_DRIVE_FOLDER_ID;

    const folderId = extractDriveFolderId(rawInput);
    if (!folderId) {
      res.status(400).json({
        ok: false,
        error:
          'Enlace de carpeta de Google Drive inválido. Usa un enlace tipo https://drive.google.com/drive/folders/...',
      });
      return;
    }

    try {
      const driveResponse = await fetch(
        `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; WeddingAlbumViewer/1.0)',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          },
        }
      );

      if (!driveResponse.ok) {
        res.status(502).json({
          ok: false,
          error: `Google Drive respondió con estado ${driveResponse.status}. Verifica que la carpeta sea pública.`,
        });
        return;
      }

      const html = await driveResponse.text();
      if (
        /accounts\.google\.com\/ServiceLogin/i.test(html) ||
        /<title>Google Drive - Sign-in<\/title>/i.test(html)
      ) {
        res.status(403).json({
          ok: false,
          error:
            'La carpeta de Google Drive es privada. Cámbiala a "Cualquier persona con el enlace (Lector)".',
        });
        return;
      }

      const { folderName, images } = parseEmbeddedDriveHtml(html, folderId);
      res.json({
        ok: true,
        folderId,
        folderName,
        count: images.length,
        updatedAt: new Date().toISOString(),
        images,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error al consultar Drive';
      res.status(500).json({
        ok: false,
        error: `No se pudo leer la carpeta pública de Google Drive: ${message}`,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Wedding app server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
