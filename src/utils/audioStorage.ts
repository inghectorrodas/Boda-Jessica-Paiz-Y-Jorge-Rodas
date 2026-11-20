export const MAX_AUDIO_FILE_BYTES = 6_500_000; // ~6.5 MB raw (~14 chunks max)
export const AUDIO_CHUNK_BASE64_LEN = 680_000;
export const MAX_AUDIO_CHUNKS = 24;

export interface PreparedAudioTrack {
  title: string;
  mimeType: string;
  chunks: string[];
  durationSec: number;
  sizeBytes: number;
  previewUrl: string;
}

const EXTENSION_MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  mpeg: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  webm: 'audio/webm',
  flac: 'audio/flac',
};

function resolveAudioMimeType(file: File): string | null {
  const rawType = (file.type || '').trim().toLowerCase();
  if (rawType === 'audio/x-m4a' || rawType === 'audio/m4a') {
    return 'audio/mp4';
  }
  if (rawType === 'audio/mp3') {
    return 'audio/mpeg';
  }
  if (/^audio\/[a-z0-9.+-]+$/.test(rawType)) {
    return rawType;
  }

  const ext = file.name.split('.').pop()?.trim().toLowerCase() ?? '';
  return EXTENSION_MIME_MAP[ext] ?? null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const blockSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += blockSize) {
    const slice = bytes.subarray(i, i + blockSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function formatAudioDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export async function prepareAudioFileForUpload(
  file: File
): Promise<PreparedAudioTrack> {
  const mimeType = resolveAudioMimeType(file);
  if (!mimeType) {
    throw new Error(
      'Formato no compatible. Selecciona un archivo de audio MP3, M4A, AAC, OGG o WAV.'
    );
  }

  if (file.size <= 0) {
    throw new Error('El archivo de audio seleccionado está vacío.');
  }

  if (file.size > MAX_AUDIO_FILE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `El audio pesa ${sizeMB} MB y supera el límite máximo permitido (6.2 MB). Intenta con un MP3 más ligero (por ejemplo de 128 kbps).`
    );
  }

  const objectUrl = URL.createObjectURL(file);

  const durationSec = await new Promise<number>((resolve, reject) => {
    const audio = new Audio();
    let settled = false;

    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute('src');
    };

    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(0);
      }
    }, 5000);

    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      const dur = Number.isFinite(audio.duration)
        ? Math.min(3600, Math.max(0, Math.round(audio.duration)))
        : 0;
      cleanup();
      resolve(dur);
    };
    audio.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          'Tu navegador no pudo decodificar este archivo de audio. Prueba convertirlo a MP3 o M4A.'
        )
      );
    };
    audio.src = objectUrl;
  });

  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  const chunks: string[] = [];
  for (let offset = 0; offset < base64.length; offset += AUDIO_CHUNK_BASE64_LEN) {
    chunks.push(base64.slice(offset, offset + AUDIO_CHUNK_BASE64_LEN));
  }

  if (chunks.length === 0 || chunks.length > MAX_AUDIO_CHUNKS) {
    URL.revokeObjectURL(objectUrl);
    throw new Error(
      'El archivo de audio es demasiado grande para guardarse en la nube. Usa un archivo menor a 6.2 MB.'
    );
  }

  const cleanTitle =
    file.name.replace(/\.[^/.]+$/, '').trim().slice(0, 120) ||
    'Música de Boda';

  return {
    title: cleanTitle,
    mimeType,
    chunks,
    durationSec,
    sizeBytes: file.size,
    previewUrl: objectUrl,
  };
}

export function assembleAudioBlobUrlFromChunks(
  chunks: Array<{ index: number; data: string; mimeType?: string }>,
  fallbackMime = 'audio/mpeg'
): string {
  const sorted = [...chunks].sort((a, b) => a.index - b.index);
  const mime = sorted[0]?.mimeType || fallbackMime;
  const partArrays = sorted.map((c) => base64ToUint8Array(c.data));
  const totalBytes = partArrays.reduce((sum, arr) => sum + arr.byteLength, 0);
  const combined = new Uint8Array(totalBytes);

  let offset = 0;
  for (const arr of partArrays) {
    combined.set(arr, offset);
    offset += arr.byteLength;
  }

  const blob = new Blob([combined], { type: mime });
  return URL.createObjectURL(blob);
}
