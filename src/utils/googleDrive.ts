import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

// In-memory cache only (never persisted to localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const googleDriveSignIn = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'No se recibió el permiso de acceso de Google Drive. Intenta nuevamente.'
      );
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const clearDriveAccessToken = (): void => {
  cachedAccessToken = null;
};

export function extractDriveFolderId(driveUrl: string): string | null {
  if (!driveUrl) return null;
  const folderMatch = driveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];
  const idParamMatch = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) return idParamMatch[1];
  return null;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header?.match(/data:([^;]+)/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export interface DriveFileSummary {
  id: string;
  name: string;
  webViewLink?: string;
}

export async function listDriveFolderFiles(
  folderId: string,
  accessToken: string
): Promise<DriveFileSummary[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401) {
      cachedAccessToken = null;
    }
    throw new Error(`Google Drive (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as { files?: DriveFileSummary[] };
  return json.files ?? [];
}

export interface DriveUploadParams {
  folderId: string;
  accessToken: string;
  fileName: string;
  blob: Blob;
  description?: string;
}

export async function uploadBlobToGoogleDriveFolder({
  folderId,
  accessToken,
  fileName,
  blob,
  description = '',
}: DriveUploadParams): Promise<DriveFileSummary> {
  const metadata = {
    name: fileName,
    parents: [folderId],
    description,
  };

  // Use resumable upload for larger files/videos (> 4 MB)
  if (blob.size > 4 * 1024 * 1024) {
    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': blob.type || 'application/octet-stream',
          'X-Upload-Content-Length': String(blob.size),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      if (initRes.status === 401) cachedAccessToken = null;
      const errText = await initRes.text();
      throw new Error(`No se pudo iniciar la subida a Drive (${initRes.status}): ${errText}`);
    }

    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('Google Drive no devolvió la URL de carga.');
    }

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': blob.type || 'application/octet-stream',
      },
      body: blob,
    });

    if (!putRes.ok) {
      if (putRes.status === 401) cachedAccessToken = null;
      const errText = await putRes.text();
      throw new Error(`Error al subir el archivo a Drive (${putRes.status}): ${errText}`);
    }

    return (await putRes.json()) as DriveFileSummary;
  }

  // Standard multipart upload for photos & small clips
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', blob, fileName);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      cachedAccessToken = null;
    }
    const errText = await res.text();
    throw new Error(`Google Drive (${res.status}): ${errText}`);
  }

  return (await res.json()) as DriveFileSummary;
}

export async function uploadPhotoViaAppsScript({
  appsScriptUrl,
  photoId,
  fileName,
  imageData,
  description = '',
}: {
  appsScriptUrl: string;
  photoId: string;
  fileName: string;
  imageData: string;
  description?: string;
}): Promise<DriveFileSummary> {
  const [header, base64Data] = imageData.split(',');
  const mimeMatch = header?.match(/data:([^;]+)/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';

  if (!base64Data) {
    throw new Error('Imagen inválida para enviar a Google Apps Script.');
  }

  const res = await fetch(appsScriptUrl.trim(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'uploadPhoto',
      photoId,
      fileName,
      mimeType,
      base64Data,
      description,
    }),
  });

  if (!res.ok) {
    throw new Error(`Apps Script respondió con estado ${res.status}.`);
  }

  const payload = (await res.json()) as {
    ok?: boolean;
    error?: string;
    id?: string;
    name?: string;
  };

  if (payload?.ok === false) {
    throw new Error(
      payload.error || 'Apps Script no pudo guardar la fotografía en Drive.'
    );
  }

  return {
    id: String(payload.id || photoId),
    name: String(payload.name || fileName),
  };
}

