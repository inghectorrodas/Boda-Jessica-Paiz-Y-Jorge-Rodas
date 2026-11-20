export interface CompressedPhotoResult {
  imageData: string;
  width: number;
  height: number;
  sizeKB: number;
}

const MAX_DIMENSION = 1280;
const MAX_DATA_URL_CHARS = 420_000;

export async function compressWeddingPhoto(
  file: File
): Promise<CompressedPhotoResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Por favor selecciona un archivo de imagen válido (JPG, PNG o WebP).');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error('No se pudo leer la imagen seleccionada.'));
      image.src = objectUrl;
    });

    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight)
    );
    const width = Math.max(50, Math.round(img.naturalWidth * scale));
    const height = Math.max(50, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Tu navegador no permite procesar imágenes en este momento.');
    }

    ctx.fillStyle = '#fcfbf9';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.78;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);

    while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.4) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      // Scale down slightly further if still dense
      const smallerCanvas = document.createElement('canvas');
      smallerCanvas.width = Math.round(width * 0.75);
      smallerCanvas.height = Math.round(height * 0.75);
      const sCtx = smallerCanvas.getContext('2d');
      if (sCtx) {
        sCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
        dataUrl = smallerCanvas.toDataURL('image/jpeg', 0.68);
        return {
          imageData: dataUrl,
          width: smallerCanvas.width,
          height: smallerCanvas.height,
          sizeKB: Math.round((dataUrl.length * 3) / 4 / 1024),
        };
      }
    }

    return {
      imageData: dataUrl,
      width,
      height,
      sizeKB: Math.round((dataUrl.length * 3) / 4 / 1024),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const MAX_QR_DIMENSION = 520;
const MAX_QR_DATA_URL_CHARS = 200_000;

export async function compressQrCodeImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Por favor selecciona una imagen válida (JPG, PNG o WebP) para el código QR.');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error('No se pudo leer la imagen del código QR.'));
      image.src = objectUrl;
    });

    const scale = Math.min(
      1,
      MAX_QR_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight)
    );
    const width = Math.max(80, Math.round(img.naturalWidth * scale));
    const height = Math.max(80, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Tu navegador no permite procesar imágenes en este momento.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.85;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);

    while (dataUrl.length > MAX_QR_DATA_URL_CHARS && quality > 0.45) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    if (dataUrl.length > MAX_QR_DATA_URL_CHARS) {
      const smallerCanvas = document.createElement('canvas');
      smallerCanvas.width = Math.round(width * 0.72);
      smallerCanvas.height = Math.round(height * 0.72);
      const sCtx = smallerCanvas.getContext('2d');
      if (sCtx) {
        sCtx.fillStyle = '#ffffff';
        sCtx.fillRect(0, 0, smallerCanvas.width, smallerCanvas.height);
        sCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
        dataUrl = smallerCanvas.toDataURL('image/jpeg', 0.72);
      }
    }

    if (dataUrl.length > MAX_QR_DATA_URL_CHARS) {
      throw new Error('La imagen del QR es demasiado pesada. Intenta recortarla un poco.');
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

