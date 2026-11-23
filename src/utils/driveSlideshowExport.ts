import { extractDriveFolderId } from './googleDrive';

export const DEFAULT_DRIVE_FOLDER_ID = '13Ii_V2aNXTZUbuvefWLIbS_L6jP0mMfR';
export const DEFAULT_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/13Ii_V2aNXTZUbuvefWLIbS_L6jP0mMfR?usp=sharing';

export interface DriveSlideItem {
  id: string;
  name: string;
  url: string;
  fallbackUrl: string;
  modified?: string;
}

export interface DriveFolderLoadResult {
  folderId: string;
  folderName: string;
  images: DriveSlideItem[];
}

export function isValidAppsScriptUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 500 &&
    /^https:\/\/script\.google\.com\/.+/i.test(trimmed)
  );
}

export async function fetchDriveFolderSlides(
  folderUrlOrId: string = DEFAULT_DRIVE_FOLDER_ID
): Promise<DriveFolderLoadResult> {
  const cleanId =
    extractDriveFolderId(folderUrlOrId) ||
    (/^[a-zA-Z0-9_-]{8,120}$/.test(folderUrlOrId.trim())
      ? folderUrlOrId.trim()
      : null);

  if (!cleanId) {
    throw new Error(
      'Enlace de Google Drive inválido. Pega un enlace como https://drive.google.com/drive/folders/...'
    );
  }

  const response = await fetch(
    `/api/drive-folder?folderId=${encodeURIComponent(cleanId)}&t=${Date.now()}`,
    { method: 'GET' }
  );

  const payload = (await response.json()) as {
    ok?: boolean;
    error?: string;
    folderId?: string;
    folderName?: string;
    images?: Array<{
      id?: string;
      name?: string;
      url?: string;
      fallbackUrl?: string;
      modified?: string;
    }>;
  };

  if (!response.ok || payload.ok === false) {
    throw new Error(
      payload.error || `No se pudo leer la carpeta (${response.status}).`
    );
  }

  const images: DriveSlideItem[] = (payload.images ?? []).map((item, idx) => {
    const id = String(item.id || `drive_${idx}`);
    const name = String(item.name || `Foto ${idx + 1}`).replace(
      /\.[^/.]+$/,
      ''
    );
    return {
      id,
      name,
      url: String(
        item.url || `https://lh3.googleusercontent.com/d/${id}=w1920`
      ),
      fallbackUrl: String(
        item.fallbackUrl ||
          `https://drive.google.com/thumbnail?id=${id}&sz=w1920`
      ),
      modified: item.modified ? String(item.modified) : undefined,
    };
  });

  return {
    folderId: payload.folderId || cleanId,
    folderName: payload.folderName || 'Carpeta Google Drive',
    images,
  };
}

export async function fetchAppsScriptSlides(
  appsScriptUrl: string
): Promise<DriveSlideItem[]> {
  const cleanUrl = appsScriptUrl.trim();
  if (!isValidAppsScriptUrl(cleanUrl)) {
    return [];
  }

  const separator = cleanUrl.includes('?') ? '&' : '?';
  const requestUrl = `${cleanUrl}${separator}t=${Date.now()}`;

  const response = await fetch(requestUrl, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Apps Script respondió con estado ${response.status}`);
  }

  const payload = (await response.json()) as
    | { ok?: boolean; error?: string; images?: unknown[] }
    | unknown[];

  if (!Array.isArray(payload) && payload?.ok === false) {
    throw new Error(
      payload.error || 'Google Apps Script devolvió un error al leer la carpeta.'
    );
  }

  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.images)
      ? payload.images
      : [];

  return rawItems
    .map((item, idx): DriveSlideItem | null => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const id = String(obj.id || `drive_${idx}`);
      const name = String(obj.name || `Recuerdo ${idx + 1}`).replace(
        /\.[^/.]+$/,
        ''
      );
      const url = String(
        obj.url || `https://lh3.googleusercontent.com/d/${id}=w1920`
      );
      const fallbackUrl = String(
        obj.fallbackUrl ||
          `https://drive.google.com/thumbnail?id=${id}&sz=w1920`
      );
      const modified = obj.modified ? String(obj.modified) : undefined;
      return { id, name, url, fallbackUrl, modified };
    })
    .filter((item): item is DriveSlideItem => item !== null);
}

export function buildGoogleAppsScriptCode(
  folderId: string = DEFAULT_DRIVE_FOLDER_ID
): string {
  const safeFolderId =
    folderId.replace(/[^a-zA-Z0-9_-]/g, '') || DEFAULT_DRIVE_FOLDER_ID;

  return `/**
 * Google Apps Script — Respaldo Automático y Proyección para Álbum de Boda
 * 1. Abre https://script.google.com y crea un nuevo proyecto.
 * 2. Pega este código en Code.gs y guarda.
 * 3. Haz clic en Implementar > Nueva implementación > Tipo: Aplicación web.
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario
 * 4. Copia la URL /exec generada y pégala en el panel "Google Drive y Ajustes".
 */
const FOLDER_ID = '${safeFolderId}';

function doGet(e) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const files = folder.getFiles();
    const images = [];

    while (files.hasNext()) {
      const file = files.next();
      const mime = file.getMimeType() || '';
      if (mime.indexOf('image/') === 0) {
        const id = file.getId();
        images.push({
          id: id,
          name: file.getName(),
          mimeType: mime,
          url: 'https://lh3.googleusercontent.com/d/' + id + '=w1920',
          fallbackUrl: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1920',
          modified: file.getLastUpdated().toISOString()
        });
      }
    }

    images.sort(function (a, b) {
      return a.modified < b.modified ? 1 : -1;
    });

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        folderId: FOLDER_ID,
        count: images.length,
        updatedAt: new Date().toISOString(),
        images: images
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: String(err)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const fileName = String(body.fileName || ('boda_' + Date.now() + '.jpg')).slice(0, 120);
    const photoId = String(body.photoId || '').slice(0, 80);
    const mimeType = String(body.mimeType || 'image/jpeg');
    const base64Data = String(body.base64Data || '');
    const description = String(body.description || '').slice(0, 300);

    if (!base64Data) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Missing image data' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (photoId) {
      const existingFiles = folder.getFiles();
      while (existingFiles.hasNext()) {
        const f = existingFiles.next();
        if (f.getName().indexOf(photoId) !== -1) {
          return ContentService
            .createTextOutput(JSON.stringify({
              ok: true,
              duplicate: true,
              id: f.getId(),
              name: f.getName()
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const created = folder.createFile(blob);
    if (description) {
      created.setDescription(description);
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        id: created.getId(),
        name: created.getName()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: String(err)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;
}

export interface StandaloneSlideshowOptions {
  appsScriptUrl?: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  apiBaseUrl?: string;
  intervalSec?: number;
  initialImages?: DriveSlideItem[];
  folderName?: string;
}

export function generateStandaloneSlideshowHtml({
  appsScriptUrl = '',
  driveFolderId = DEFAULT_DRIVE_FOLDER_ID,
  driveFolderUrl = DEFAULT_DRIVE_FOLDER_URL,
  apiBaseUrl = '',
  intervalSec = 6,
  initialImages = [],
  folderName = 'BODA J&J',
}: StandaloneSlideshowOptions = {}): string {
  const safeEndpoint = JSON.stringify(appsScriptUrl.trim());
  const safeFolderId = JSON.stringify(
    driveFolderId.replace(/[^a-zA-Z0-9_-]/g, '') || DEFAULT_DRIVE_FOLDER_ID
  );
  const safeFolderUrl = JSON.stringify(
    driveFolderUrl.trim() || DEFAULT_DRIVE_FOLDER_URL
  );
  const safeFolderName = JSON.stringify(folderName || 'BODA J&J');
  const resolvedApiBase =
    apiBaseUrl ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const safeApiBase = JSON.stringify(resolvedApiBase);
  const safeSeedImages = JSON.stringify(
    initialImages.map((img) => ({
      id: img.id,
      name: img.name,
      url: img.url,
      fallbackUrl: img.fallbackUrl,
    }))
  );
  const safeIntervalMs = Math.max(3, Math.min(30, intervalSec)) * 1000;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Presentación de Fotos · Jessica Guadalupe & Jorge Luis</title>
  <style>
    :root {
      --bg: #141d18;
      --bg-card: rgba(20, 29, 24, 0.94);
      --ivory: #fcfbf9;
      --gold: #b89753;
      --gold-soft: rgba(184, 151, 83, 0.35);
      --muted: rgba(252, 251, 249, 0.72);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--bg);
      color: var(--ivory);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      user-select: none;
    }

    .stage {
      position: relative;
      width: 100vw;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: radial-gradient(circle at center, #1e2d25 0%, #101713 100%);
      overflow: hidden;
    }

    .backdrop {
      position: absolute;
      inset: -40px;
      background-size: cover;
      background-position: center;
      filter: blur(34px) brightness(0.35) saturate(1.1);
      transform: scale(1.08);
      transition: background-image 0.9s ease, opacity 0.8s ease;
      pointer-events: none;
      z-index: 0;
    }

    .hud {
      position: relative;
      z-index: 10;
      transition: opacity 0.4s ease, transform 0.4s ease;
    }

    .stage.hud-hidden .hud-top {
      opacity: 0;
      transform: translateY(-10px);
      pointer-events: none;
    }

    .stage.hud-hidden .hud-bottom {
      opacity: 0;
      transform: translateY(10px);
      pointer-events: none;
    }

    .hud-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 24px;
      background: linear-gradient(180deg, rgba(16, 23, 19, 0.9) 0%, rgba(16, 23, 19, 0) 100%);
    }

    .eyebrow {
      font-size: 10px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--gold);
      font-weight: 700;
    }

    .couple-title {
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(1.2rem, 2.3vw, 1.9rem);
      font-weight: 500;
      color: var(--ivory);
      margin-top: 2px;
      line-height: 1.15;
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .btn {
      appearance: none;
      border: 1px solid var(--gold-soft);
      background: rgba(20, 29, 24, 0.76);
      color: var(--ivory);
      height: 38px;
      padding: 0 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      backdrop-filter: blur(8px);
      transition: background 0.2s ease, border-color 0.2s ease;
    }

    .btn:hover {
      background: rgba(184, 151, 83, 0.22);
      border-color: var(--gold);
    }

    .btn-gold {
      background: var(--gold);
      border-color: var(--gold);
      color: #ffffff;
    }

    .btn-gold:hover {
      background: #9f8042;
    }

    .viewport {
      position: relative;
      z-index: 5;
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 24px;
    }

    .slide-frame {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .slide-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 14px;
      border: 1px solid rgba(184, 151, 83, 0.32);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
      opacity: 0;
      transform: scale(1.015);
      transition: opacity 0.65s ease, transform 6.5s ease-out;
    }

    .slide-img.is-visible {
      opacity: 1;
      transform: scale(1);
    }

    .nav-arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 12;
      width: 46px;
      height: 46px;
      border-radius: 999px;
      border: 1px solid var(--gold-soft);
      background: rgba(20, 29, 24, 0.65);
      color: var(--ivory);
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(6px);
      transition: background 0.2s ease, opacity 0.3s ease;
    }

    .nav-arrow:hover {
      background: rgba(184, 151, 83, 0.32);
    }

    .nav-prev { left: 18px; }
    .nav-next { right: 18px; }

    .stage.hud-hidden .nav-arrow {
      opacity: 0;
      pointer-events: none;
    }

    .hud-bottom {
      padding: 16px 24px 20px;
      background: linear-gradient(0deg, rgba(16, 23, 19, 0.92) 0%, rgba(16, 23, 19, 0) 100%);
    }

    .caption-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 10px;
    }

    .photo-meta {
      min-width: 0;
    }

    .photo-count {
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--gold);
      font-weight: 700;
    }

    .photo-name {
      font-family: Georgia, "Times New Roman", serif;
      font-style: italic;
      font-size: clamp(1rem, 1.8vw, 1.4rem);
      color: var(--ivory);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 72vw;
    }

    .status-pill {
      font-size: 11px;
      color: var(--muted);
      white-space: nowrap;
    }

    .progress-track {
      width: 100%;
      height: 3px;
      border-radius: 999px;
      background: rgba(252, 251, 249, 0.16);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #b89753, #e6cc8f);
      transition: width 0.25s linear;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 40;
      background: rgba(10, 15, 12, 0.78);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-backdrop.is-open {
      display: flex;
    }

    .config-card {
      max-width: 520px;
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--gold-soft);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
    }

    .config-card h2 {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 1.6rem;
      font-weight: 500;
      color: var(--ivory);
      margin-top: 4px;
    }

    .config-card p {
      margin-top: 8px;
      font-size: 0.85rem;
      line-height: 1.5;
      color: var(--muted);
    }

    .field-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--ivory);
      margin-top: 14px;
      margin-bottom: 6px;
    }

    .field-input {
      width: 100%;
      height: 42px;
      border-radius: 12px;
      border: 1px solid var(--gold-soft);
      background: rgba(16, 23, 19, 0.9);
      color: var(--ivory);
      padding: 0 14px;
      font-size: 13px;
      outline: none;
      user-select: text;
    }

    .field-input:focus {
      border-color: var(--gold);
    }

    .modal-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }

    .advanced-box {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid rgba(184, 151, 83, 0.2);
    }

    .advanced-toggle {
      background: none;
      border: none;
      color: var(--gold);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .empty-card {
      max-width: 540px;
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--gold-soft);
      border-radius: 20px;
      padding: 28px;
      text-align: center;
    }

    .empty-card h2 {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 1.8rem;
      font-weight: 500;
      margin-top: 8px;
    }

    .empty-card p {
      margin-top: 10px;
      font-size: 0.9rem;
      color: var(--muted);
      line-height: 1.5;
    }

    @media (max-width: 640px) {
      .hud-top { padding: 14px 16px; }
      .hud-bottom { padding: 12px 16px 16px; }
      .viewport { padding: 8px 12px; }
      .nav-arrow { width: 38px; height: 38px; font-size: 16px; }
      .nav-prev { left: 10px; }
      .nav-next { right: 10px; }
      .btn-label { display: none; }
    }
  </style>
</head>
<body>
  <div id="stage" class="stage">
    <div id="backdrop" class="backdrop"></div>

    <header class="hud hud-top">
      <div>
        <div id="folderEyebrow" class="eyebrow">Carpeta Google Drive · ${folderName || 'BODA J&J'}</div>
        <h1 class="couple-title">Jessica Guadalupe &amp; Jorge Luis</h1>
      </div>

      <div class="controls">
        <button id="configBtn" class="btn" type="button">
          <span>⚙</span><span class="btn-label">Configurar Google Drive</span>
        </button>
        <button id="refreshBtn" class="btn" type="button" title="Actualizar desde Google Drive (R)">
          <span>↻</span><span class="btn-label">Actualizar</span>
        </button>
        <button id="playPauseBtn" class="btn" type="button" title="Pausar o reanudar (Espacio)">
          <span id="playPauseIcon">❚❚</span><span id="playPauseText" class="btn-label">Pausar</span>
        </button>
        <button id="fullscreenBtn" class="btn btn-gold" type="button" title="Pantalla completa (F)">
          <span>⛶</span><span class="btn-label">Pantalla Completa</span>
        </button>
      </div>
    </header>

    <main class="viewport" id="viewport">
      <div id="slideFrame" class="slide-frame"></div>
      <button id="prevBtn" class="nav-arrow nav-prev" type="button" aria-label="Foto anterior" style="display:none;">‹</button>
      <button id="nextBtn" class="nav-arrow nav-next" type="button" aria-label="Siguiente foto" style="display:none;">›</button>
    </main>

    <footer class="hud hud-bottom">
      <div class="caption-row">
        <div class="photo-meta">
          <div id="photoCount" class="photo-count">Cargando fotografías...</div>
          <div id="photoName" class="photo-name">Carpeta BODA J&amp;J</div>
        </div>
        <div id="statusText" class="status-pill">Sincronización automática</div>
      </div>
      <div class="progress-track">
        <div id="progressFill" class="progress-fill"></div>
      </div>
    </footer>
  </div>

  <!-- Modal Configurar Google Drive -->
  <div id="configModal" class="modal-backdrop" role="dialog" aria-modal="true">
    <div class="config-card">
      <div class="eyebrow">Carga directa en 1 paso</div>
      <h2>Configurar Google Drive</h2>
      <p>Pega directamente el enlace normal de cualquier carpeta pública de Google Drive y presiona Guardar y cargar imágenes.</p>

      <form id="configForm">
        <label class="field-label" for="folderInput">Enlace de carpeta pública de Google Drive</label>
        <input id="folderInput" class="field-input" type="url" required placeholder="https://drive.google.com/drive/folders/..." />

        <div class="advanced-box">
          <button id="advancedToggleBtn" type="button" class="advanced-toggle">▸ Opciones avanzadas: usar endpoint de Apps Script (/exec)</button>
          <div id="advancedFields" style="display:none;">
            <label class="field-label" for="scriptInput">URL opcional de Google Apps Script (/exec)</label>
            <input id="scriptInput" class="field-input" type="url" placeholder="https://script.google.com/macros/s/.../exec" />
          </div>
        </div>

        <div class="modal-actions">
          <button type="submit" class="btn btn-gold">Guardar y cargar imágenes</button>
          <button id="restoreDemoBtn" type="button" class="btn">Restaurar demo</button>
          <button id="closeModalBtn" type="button" class="btn">Cancelar</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    (function () {
      const DEFAULT_FOLDER_ID = ${safeFolderId};
      const DEFAULT_FOLDER_URL = ${safeFolderUrl};
      const DEFAULT_FOLDER_NAME = ${safeFolderName};
      const DEFAULT_APPS_SCRIPT_URL = ${safeEndpoint};
      const API_BASE = ${safeApiBase};
      const SEED_IMAGES = ${safeSeedImages};
      const SLIDE_INTERVAL_MS = ${safeIntervalMs};
      const POLL_INTERVAL_MS = 18000;

      let activeFolderUrl = localStorage.getItem('boda_drive_folder_url') || DEFAULT_FOLDER_URL;
      let activeFolderId = extractFolderId(activeFolderUrl) || DEFAULT_FOLDER_ID;
      let activeAppsScriptUrl = localStorage.getItem('boda_apps_script_url') || DEFAULT_APPS_SCRIPT_URL;
      let activeFolderName = DEFAULT_FOLDER_NAME;
      let slides = Array.isArray(SEED_IMAGES) ? SEED_IMAGES.slice() : [];
      let currentIndex = 0;
      let isPlaying = true;
      let slideTimer = null;
      let progressTimer = null;
      let hudHideTimer = null;
      let elapsedMs = 0;
      let touchStartX = null;

      const stageEl = document.getElementById('stage');
      const backdropEl = document.getElementById('backdrop');
      const folderEyebrowEl = document.getElementById('folderEyebrow');
      const slideFrameEl = document.getElementById('slideFrame');
      const prevBtn = document.getElementById('prevBtn');
      const nextBtn = document.getElementById('nextBtn');
      const configBtn = document.getElementById('configBtn');
      const playPauseBtn = document.getElementById('playPauseBtn');
      const playPauseIcon = document.getElementById('playPauseIcon');
      const playPauseText = document.getElementById('playPauseText');
      const refreshBtn = document.getElementById('refreshBtn');
      const fullscreenBtn = document.getElementById('fullscreenBtn');
      const photoCountEl = document.getElementById('photoCount');
      const photoNameEl = document.getElementById('photoName');
      const statusTextEl = document.getElementById('statusText');
      const progressFillEl = document.getElementById('progressFill');

      const configModal = document.getElementById('configModal');
      const configForm = document.getElementById('configForm');
      const folderInput = document.getElementById('folderInput');
      const scriptInput = document.getElementById('scriptInput');
      const advancedToggleBtn = document.getElementById('advancedToggleBtn');
      const advancedFields = document.getElementById('advancedFields');
      const restoreDemoBtn = document.getElementById('restoreDemoBtn');
      const closeModalBtn = document.getElementById('closeModalBtn');

      function extractFolderId(url) {
        if (!url) return '';
        const m1 = String(url).match(/\\/folders\\/([a-zA-Z0-9_-]+)/);
        if (m1 && m1[1]) return m1[1];
        const m2 = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (m2 && m2[1]) return m2[1];
        if (/^[a-zA-Z0-9_-]{8,120}$/.test(String(url).trim())) return String(url).trim();
        return '';
      }

      function showHudTemporarily() {
        stageEl.classList.remove('hud-hidden');
        clearTimeout(hudHideTimer);
        if (isPlaying && slides.length > 0) {
          hudHideTimer = setTimeout(function () {
            stageEl.classList.add('hud-hidden');
          }, 4200);
        }
      }

      function renderEmptyState(message) {
        backdropEl.style.backgroundImage = 'none';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        photoCountEl.textContent = 'Google Drive · ' + activeFolderName;
        photoNameEl.textContent = message || 'Sin fotografías disponibles aún';
        slideFrameEl.innerHTML = '';

        const card = document.createElement('div');
        card.className = 'empty-card';
        card.innerHTML =
          '<div class="eyebrow">Carpeta Pública de Google Drive</div>' +
          '<h2>' + activeFolderName + '</h2>' +
          '<p>' + (message || 'Aún no hay imágenes visibles en esta carpeta. Verifica que esté compartida como pública o cambia de carpeta.') + '</p>';
        slideFrameEl.appendChild(card);
      }

      function renderSlide() {
        if (slides.length === 0) {
          renderEmptyState();
          return;
        }

        if (currentIndex >= slides.length) currentIndex = 0;
        if (currentIndex < 0) currentIndex = slides.length - 1;

        const slide = slides[currentIndex];
        prevBtn.style.display = slides.length > 1 ? 'flex' : 'none';
        nextBtn.style.display = slides.length > 1 ? 'flex' : 'none';
        folderEyebrowEl.textContent = 'Carpeta Google Drive · ' + activeFolderName;

        photoCountEl.textContent = 'Fotografía ' + (currentIndex + 1) + ' de ' + slides.length + ' · ' + activeFolderName;
        photoNameEl.textContent = slide.name || 'Recuerdo de Nuestra Boda';
        backdropEl.style.backgroundImage = 'url("' + slide.url + '")';

        slideFrameEl.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'slide-img';
        img.alt = slide.name || 'Fotografía de boda';
        img.src = slide.url;
        img.onerror = function () {
          if (slide.fallbackUrl && img.src !== slide.fallbackUrl) {
            img.src = slide.fallbackUrl;
          }
        };
        img.onload = function () {
          requestAnimationFrame(function () {
            img.classList.add('is-visible');
          });
        };

        slideFrameEl.appendChild(img);
        requestAnimationFrame(function () {
          setTimeout(function () {
            img.classList.add('is-visible');
          }, 40);
        });
      }

      function nextSlide() {
        if (slides.length === 0) return;
        currentIndex = (currentIndex + 1) % slides.length;
        elapsedMs = 0;
        renderSlide();
      }

      function prevSlide() {
        if (slides.length === 0) return;
        currentIndex = (currentIndex - 1 + slides.length) % slides.length;
        elapsedMs = 0;
        renderSlide();
      }

      function updatePlaybackLoop() {
        clearInterval(slideTimer);
        clearInterval(progressTimer);

        if (!isPlaying || slides.length <= 1) {
          progressFillEl.style.width = slides.length === 1 ? '100%' : '0%';
          return;
        }

        elapsedMs = 0;
        progressTimer = setInterval(function () {
          elapsedMs += 100;
          const pct = Math.min(100, (elapsedMs / SLIDE_INTERVAL_MS) * 100);
          progressFillEl.style.width = pct + '%';
        }, 100);

        slideTimer = setInterval(function () {
          nextSlide();
        }, SLIDE_INTERVAL_MS);
      }

      function togglePlayPause() {
        isPlaying = !isPlaying;
        playPauseIcon.textContent = isPlaying ? '❚❚' : '▶';
        playPauseText.textContent = isPlaying ? 'Pausar' : 'Reanudar';
        showHudTemporarily();
        updatePlaybackLoop();
      }

      function toggleFullscreen() {
        if (!document.fullscreenElement) {
          const el = document.documentElement;
          if (el.requestFullscreen) {
            el.requestFullscreen().catch(function () {});
          }
        } else if (document.exitFullscreen) {
          document.exitFullscreen().catch(function () {});
        }
      }

      async function fetchImages(forceRender) {
        statusTextEl.textContent = 'Cargando carpeta de Google Drive...';
        try {
          let targetUrl = '';
          if (activeAppsScriptUrl && /^https:\\/\\/script\\.google\\.com\\/.+/i.test(activeAppsScriptUrl)) {
            const sep = activeAppsScriptUrl.indexOf('?') >= 0 ? '&' : '?';
            targetUrl = activeAppsScriptUrl + sep + 't=' + Date.now();
          } else {
            const base = API_BASE || (window.location.protocol.indexOf('http') === 0 ? window.location.origin : '');
            if (!base) {
              if (slides.length > 0 && forceRender) {
                renderSlide();
                updatePlaybackLoop();
              }
              statusTextEl.textContent = slides.length + ' foto(s) incluidas en archivo';
              return;
            }
            targetUrl = base + '/api/drive-folder?folderId=' + encodeURIComponent(activeFolderId) + '&t=' + Date.now();
          }

          const res = await fetch(targetUrl);
          const data = await res.json();
          if (!res.ok || (data && data.ok === false)) {
            throw new Error((data && data.error) || ('HTTP ' + res.status));
          }

          if (data.folderName) {
            activeFolderName = String(data.folderName);
          }

          const rawList = Array.isArray(data) ? data : (data.images || []);
          const nextSlides = rawList.map(function (item, idx) {
            const id = String(item.id || ('img_' + idx));
            return {
              id: id,
              name: String(item.name || ('Recuerdo ' + (idx + 1))).replace(/\\.[^/.]+$/, ''),
              url: String(item.url || ('https://lh3.googleusercontent.com/d/' + id + '=w1920')),
              fallbackUrl: String(item.fallbackUrl || ('https://drive.google.com/thumbnail?id=' + id + '&sz=w1920'))
            };
          });

          const prevIds = slides.map(function (s) { return s.id; }).join('|');
          const nextIds = nextSlides.map(function (s) { return s.id; }).join('|');
          const hasChanged = prevIds !== nextIds;

          slides = nextSlides;
          statusTextEl.textContent =
            slides.length + ' foto(s) · ' + activeFolderName;

          if (forceRender || hasChanged || slideFrameEl.querySelector('.empty-card')) {
            if (currentIndex >= slides.length) currentIndex = 0;
            renderSlide();
            updatePlaybackLoop();
          }
        } catch (err) {
          if (slides.length > 0) {
            statusTextEl.textContent = slides.length + ' foto(s) cargadas';
            if (forceRender) {
              renderSlide();
              updatePlaybackLoop();
            }
          } else {
            statusTextEl.textContent = 'Error al cargar Drive';
            renderEmptyState(err.message);
          }
        }
      }

      configBtn.addEventListener('click', function () {
        folderInput.value = activeFolderUrl;
        scriptInput.value = activeAppsScriptUrl;
        configModal.classList.add('is-open');
      });

      closeModalBtn.addEventListener('click', function () {
        configModal.classList.remove('is-open');
      });

      advancedToggleBtn.addEventListener('click', function () {
        const isOpen = advancedFields.style.display !== 'none';
        advancedFields.style.display = isOpen ? 'none' : 'block';
        advancedToggleBtn.textContent = isOpen
          ? '▸ Opciones avanzadas: usar endpoint de Apps Script (/exec)'
          : '▾ Ocultar opciones avanzadas (Apps Script)';
      });

      configForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const fUrl = folderInput.value.trim();
        const extracted = extractFolderId(fUrl);
        if (!extracted) return;

        activeFolderUrl = fUrl;
        activeFolderId = extracted;
        activeAppsScriptUrl = scriptInput.value.trim();
        localStorage.setItem('boda_drive_folder_url', activeFolderUrl);
        localStorage.setItem('boda_apps_script_url', activeAppsScriptUrl);
        configModal.classList.remove('is-open');
        currentIndex = 0;
        fetchImages(true);
      });

      restoreDemoBtn.addEventListener('click', function () {
        activeFolderUrl = DEFAULT_FOLDER_URL;
        activeFolderId = DEFAULT_FOLDER_ID;
        activeFolderName = DEFAULT_FOLDER_NAME;
        activeAppsScriptUrl = '';
        localStorage.removeItem('boda_drive_folder_url');
        localStorage.removeItem('boda_apps_script_url');
        folderInput.value = activeFolderUrl;
        scriptInput.value = '';
        configModal.classList.remove('is-open');
        currentIndex = 0;
        fetchImages(true);
      });

      prevBtn.addEventListener('click', function () {
        prevSlide();
        updatePlaybackLoop();
        showHudTemporarily();
      });

      nextBtn.addEventListener('click', function () {
        nextSlide();
        updatePlaybackLoop();
        showHudTemporarily();
      });

      playPauseBtn.addEventListener('click', togglePlayPause);
      refreshBtn.addEventListener('click', function () {
        fetchImages(true);
        showHudTemporarily();
      });
      fullscreenBtn.addEventListener('click', toggleFullscreen);

      window.addEventListener('keydown', function (e) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.key === 'Escape' && configModal.classList.contains('is-open')) {
          configModal.classList.remove('is-open');
          return;
        }
        if (e.key === 'ArrowRight') { nextSlide(); updatePlaybackLoop(); showHudTemporarily(); }
        if (e.key === 'ArrowLeft') { prevSlide(); updatePlaybackLoop(); showHudTemporarily(); }
        if (e.key === ' ') { e.preventDefault(); togglePlayPause(); }
        if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
        if (e.key === 'r' || e.key === 'R') { fetchImages(true); }
      });

      stageEl.addEventListener('mousemove', showHudTemporarily);
      stageEl.addEventListener('touchstart', function (e) {
        showHudTemporarily();
        if (e.touches && e.touches[0]) touchStartX = e.touches[0].clientX;
      }, { passive: true });
      stageEl.addEventListener('touchend', function (e) {
        if (touchStartX === null || !e.changedTouches || !e.changedTouches[0]) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(dx) > 45) {
          if (dx < 0) nextSlide(); else prevSlide();
          updatePlaybackLoop();
        }
      }, { passive: true });

      if (slides.length > 0) {
        renderSlide();
        updatePlaybackLoop();
      }
      fetchImages(true);
      setInterval(function () { fetchImages(false); }, POLL_INTERVAL_MS);
    })();
  </script>
</body>
</html>`;
}

export function downloadStandaloneSlideshowHtml(
  options: StandaloneSlideshowOptions = {}
): void {
  const html = generateStandaloneSlideshowHtml(options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Presentacion_Boda_Google_Drive.html';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
