import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Settings,
  Tv,
  X,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  getDoc,
  limit,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { QRCodeSVG } from 'qrcode.react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  DEFAULT_WEDDING_CONFIG,
  formatWeddingReportDateLabel,
  generateSafeId,
  getStoredWeddingConfig,
  isAuthorizedCoupleEmail,
  mergeWeddingConfig,
  WeddingConfigRecord,
  WeddingPhotoRecord,
} from '../data/weddingData';
import {
  CompressedPhotoResult,
  compressWeddingPhoto,
} from '../utils/imageCompression';
import {
  dataUrlToBlob,
  extractDriveFolderId,
  getDriveAccessToken,
  uploadBlobToGoogleDriveFolder,
  uploadPhotoViaAppsScript,
} from '../utils/googleDrive';
import {
  DEFAULT_DRIVE_FOLDER_ID,
  DEFAULT_DRIVE_FOLDER_URL,
  downloadStandaloneSlideshowHtml,
  DriveSlideItem,
  fetchAppsScriptSlides,
  fetchDriveFolderSlides,
  isValidAppsScriptUrl,
} from '../utils/driveSlideshowExport';
import { FotoPartyOverlay } from './FotoPartyOverlay';
import { SectionCornerFlorals } from './BotanicalArtwork';

interface PhotoAlbumSectionProps {
  isWeddingDayActive: boolean;
}

export const PhotoAlbumSection: React.FC<PhotoAlbumSectionProps> = ({
  isWeddingDayActive,
}) => {
  const [photos, setPhotos] = useState<WeddingPhotoRecord[]>([]);
  const [config, setConfig] = useState<WeddingConfigRecord>(() =>
    getStoredWeddingConfig()
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });

    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'wedding_settings', 'main'));
        if (snap.exists()) {
          setConfig(mergeWeddingConfig(snap.data()));
        }
      } catch (err) {
        setConfig(getStoredWeddingConfig());
      }
    };
    void fetchConfig();

    const handleConfigUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setConfig(mergeWeddingConfig(detail));
      }
    };
    window.addEventListener('wedding:config-updated', handleConfigUpdate as EventListener);

    return () => {
      unsubAuth();
      window.removeEventListener('wedding:config-updated', handleConfigUpdate as EventListener);
    };
  }, []);

  const isCoupleOrAdmin = Boolean(
    currentUser && isAuthorizedCoupleEmail(currentUser.email)
  );

  const MAX_PHOTOS_PER_POST = 10;
  const [guestName, setGuestName] = useState(() =>
    typeof window !== 'undefined'
      ? window.localStorage.getItem('boda_paparazzi_guest_name') || ''
      : ''
  );
  const [caption, setCaption] = useState('');
  const [preparedPhotos, setPreparedPhotos] = useState<
    Array<CompressedPhotoResult & { localId: string; fileName: string }>
  >([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadWarning, setUploadWarning] = useState('');
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState('');

  const [selectedPhoto, setSelectedPhoto] = useState<WeddingPhotoRecord | null>(
    null
  );
  const [isFotoPartyOpen, setIsFotoPartyOpen] = useState(false);
  const [qrModalMode, setQrModalMode] = useState<'album' | 'upload' | null>(null);
  const [driveSlides, setDriveSlides] = useState<DriveSlideItem[]>([]);
  const [driveFolderName, setDriveFolderName] = useState('BODA J&J');
  const [customFolderUrl, setCustomFolderUrl] = useState<string>(() =>
    typeof window !== 'undefined'
      ? window.localStorage.getItem('boda_drive_folder_url') || ''
      : ''
  );
  const [customScriptUrl, setCustomScriptUrl] = useState<string>(() =>
    typeof window !== 'undefined'
      ? window.localStorage.getItem('boda_apps_script_url') || ''
      : ''
  );
  const [isDriveConfigOpen, setIsDriveConfigOpen] = useState(false);
  const [folderInput, setFolderInput] = useState('');
  const [scriptInput, setScriptInput] = useState('');
  const [showAdvancedScript, setShowAdvancedScript] = useState(false);
  const [driveConfigError, setDriveConfigError] = useState('');
  const [isFetchingDriveSlides, setIsFetchingDriveSlides] = useState(false);
  const [driveSlidesError, setDriveSlidesError] = useState('');
  const [slideIndex, setSlideIndex] = useState(0);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(true);
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const isAlbumVisible = isWeddingDayActive || config.albumEnabledEarly;

  const effectiveFolderUrl =
    customFolderUrl ||
    config.googlePhotosUrl ||
    DEFAULT_DRIVE_FOLDER_URL;
  const effectiveScriptUrl = customScriptUrl || config.appsScriptUrl;

  const loadDriveSlides = useCallback(
    async (overrideFolder?: string, overrideScript?: string) => {
      const targetScript =
        overrideScript !== undefined ? overrideScript : effectiveScriptUrl;
      const targetFolder =
        overrideFolder !== undefined ? overrideFolder : effectiveFolderUrl;

      setIsFetchingDriveSlides(true);
      setDriveSlidesError('');
      try {
        if (isValidAppsScriptUrl(targetScript)) {
          const items = await fetchAppsScriptSlides(targetScript);
          setDriveSlides(items);
        } else {
          const result = await fetchDriveFolderSlides(targetFolder);
          setDriveSlides(result.images);
          setDriveFolderName(result.folderName || 'Carpeta Google Drive');
        }
      } catch (err) {
        setDriveSlidesError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar la carpeta pública de Google Drive.'
        );
      } finally {
        setIsFetchingDriveSlides(false);
      }
    },
    [effectiveFolderUrl, effectiveScriptUrl]
  );

  useEffect(() => {
    if (!isAlbumVisible) {
      setDriveSlides([]);
      return;
    }

    void loadDriveSlides();
    const poll = window.setInterval(() => {
      void loadDriveSlides();
    }, 20000);

    return () => window.clearInterval(poll);
  }, [isAlbumVisible, loadDriveSlides]);

  const combinedSlides: WeddingPhotoRecord[] = useMemo(() => {
    const mappedDrive: WeddingPhotoRecord[] = driveSlides.map((slide) => ({
      id: `drive_${slide.id}`,
      guestName: `Drive · ${driveFolderName}`,
      caption: slide.name,
      imageData: slide.url,
      fallbackUrl: slide.fallbackUrl,
      width: 1920,
      height: 1080,
      visible: true,
      createdAt: null,
    }));

    return [...photos, ...mappedDrive];
  }, [photos, driveSlides, driveFolderName]);

  useEffect(() => {
    if (combinedSlides.length === 0) {
      setSlideIndex(0);
    } else if (slideIndex >= combinedSlides.length) {
      setSlideIndex(0);
    }
  }, [combinedSlides.length, slideIndex]);

  useEffect(() => {
    if (!isAlbumVisible || !isSlideshowPlaying || combinedSlides.length <= 1) {
      return;
    }
    const intervalMs =
      Math.max(3, Math.min(30, config.fotoPartyIntervalSec)) * 1000;
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % combinedSlides.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [
    isAlbumVisible,
    isSlideshowPlaying,
    combinedSlides.length,
    config.fotoPartyIntervalSec,
  ]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsStageFullscreen(document.fullscreenElement === stageRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  const handleToggleStageFullscreen = async () => {
    const el = stageRef.current;
    if (!el || !el.requestFullscreen) {
      setIsFotoPartyOpen(true);
      return;
    }
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      setIsFotoPartyOpen(true);
    }
  };

  const handleOpenDriveConfig = () => {
    setFolderInput(effectiveFolderUrl);
    setScriptInput(effectiveScriptUrl);
    setDriveConfigError('');
    setShowAdvancedScript(Boolean(effectiveScriptUrl));
    setIsDriveConfigOpen(true);
  };

  const handleSaveDriveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setDriveConfigError('');

    const cleanFolder = folderInput.trim();
    const cleanScript = scriptInput.trim();
    const parsedId = extractDriveFolderId(cleanFolder);

    if (!parsedId && !cleanScript) {
      setDriveConfigError(
        'Pega un enlace válido de carpeta de Google Drive (https://drive.google.com/drive/folders/...).'
      );
      return;
    }

    if (cleanScript && !isValidAppsScriptUrl(cleanScript)) {
      setDriveConfigError(
        'La URL avanzada de Apps Script debe comenzar con https://script.google.com/'
      );
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('boda_drive_folder_url', cleanFolder);
      if (cleanScript) {
        window.localStorage.setItem('boda_apps_script_url', cleanScript);
      } else {
        window.localStorage.removeItem('boda_apps_script_url');
      }
    }

    setCustomFolderUrl(cleanFolder);
    setCustomScriptUrl(cleanScript);
    setIsDriveConfigOpen(false);
    setSlideIndex(0);
    await loadDriveSlides(cleanFolder, cleanScript);
  };

  const handleRestoreDemoFolder = async () => {
    setDriveConfigError('');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('boda_drive_folder_url');
      window.localStorage.removeItem('boda_apps_script_url');
    }
    setCustomFolderUrl('');
    setCustomScriptUrl('');
    setFolderInput(DEFAULT_DRIVE_FOLDER_URL);
    setScriptInput('');
    setDriveFolderName('BODA J&J');
    setIsDriveConfigOpen(false);
    setSlideIndex(0);
    await loadDriveSlides(DEFAULT_DRIVE_FOLDER_URL, '');
  };

  const handleDownloadStandaloneHtml = () => {
    const folderId =
      extractDriveFolderId(effectiveFolderUrl) || DEFAULT_DRIVE_FOLDER_ID;
    downloadStandaloneSlideshowHtml({
      appsScriptUrl: effectiveScriptUrl,
      driveFolderId: folderId,
      driveFolderUrl: effectiveFolderUrl,
      folderName: driveFolderName,
      initialImages: driveSlides,
      intervalSec: config.fotoPartyIntervalSec,
    });
  };

  useEffect(() => {
    if (!isAlbumVisible) {
      setPhotos([]);
      return;
    }

    const photosQuery = query(
      collection(db, 'wedding_photos'),
      where('visible', '==', true),
      limit(50)
    );

    const unsubPhotos = onSnapshot(
      photosQuery,
      (snapshot) => {
        const items: WeddingPhotoRecord[] = snapshot.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              guestName: String(d.guestName ?? 'Invitado'),
              caption: String(d.caption ?? ''),
              imageData: String(d.imageData ?? ''),
              width: Number(d.width ?? 800),
              height: Number(d.height ?? 600),
              visible: Boolean(d.visible ?? true),
              createdAt: d.createdAt ?? null,
            };
          })
          .sort(
            (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
          );
        setPhotos(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'wedding_photos');
      }
    );

    return () => {
      unsubPhotos();
    };
  }, [isAlbumVisible]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;

    setUploadError('');
    setUploadWarning('');
    setUploadSuccessMessage('');

    const remainingSlots = MAX_PHOTOS_PER_POST - preparedPhotos.length;
    if (remainingSlots <= 0) {
      setUploadWarning(
        `Ya tienes el máximo de ${MAX_PHOTOS_PER_POST} fotos en esta publicación. Publica estas primero o quita alguna para agregar otra.`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const filesToProcess = selectedFiles.slice(0, remainingSlots);
    const exceededLimit = selectedFiles.length > remainingSlots;

    setIsCompressing(true);
    const newlyPrepared: Array<
      CompressedPhotoResult & { localId: string; fileName: string }
    > = [];
    let failedCount = 0;

    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        setCompressionProgress(
          `Optimizando foto ${i + 1} de ${filesToProcess.length}...`
        );
        try {
          const compressed = await compressWeddingPhoto(file);
          newlyPrepared.push({
            ...compressed,
            localId: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
            fileName: file.name || `foto_${i + 1}.jpg`,
          });
        } catch {
          failedCount += 1;
        }
      }

      if (newlyPrepared.length > 0) {
        setPreparedPhotos((prev) =>
          [...prev, ...newlyPrepared].slice(0, MAX_PHOTOS_PER_POST)
        );
      }

      if (exceededLimit) {
        setUploadWarning(
          `Máximo ${MAX_PHOTOS_PER_POST} fotos por publicación. Se prepararon ${filesToProcess.length} fotos; publica este grupo y podrás subir más enseguida.`
        );
      } else if (failedCount > 0 && newlyPrepared.length > 0) {
        setUploadWarning(
          `${failedCount} archivo(s) no eran imágenes válidas y se omitieron.`
        );
      } else if (failedCount > 0 && newlyPrepared.length === 0) {
        setUploadError(
          'No pudimos procesar las imágenes seleccionadas. Verifica que sean JPG, PNG o WebP.'
        );
      }
    } finally {
      setIsCompressing(false);
      setCompressionProgress('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePreparedPhoto = (localId: string) => {
    setPreparedPhotos((prev) => prev.filter((item) => item.localId !== localId));
    setUploadError('');
    setUploadWarning('');
  };

  const handleClearPreparedPhotos = () => {
    setPreparedPhotos([]);
    setUploadError('');
    setUploadWarning('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePhotoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = guestName.trim().slice(0, 80);
    if (trimmedName.length < 2) {
      setUploadError('Por favor escribe tu nombre antes de compartir tus fotos.');
      return;
    }
    if (preparedPhotos.length === 0) {
      setUploadError('Selecciona o toma al menos una fotografía primero (hasta 10 por envío).');
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('boda_paparazzi_guest_name', trimmedName);
    }

    setUploadError('');
    setUploadWarning('');
    setUploadSuccessMessage('');
    setIsUploading(true);

    const trimmedCaption = caption.trim().slice(0, 220);
    const totalToUpload = preparedPhotos.length;
    const uploadedItems: Array<{
      photoId: string;
      imageData: string;
    }> = [];
    const failedLocalIds = new Set<string>();
    const uploadedLocalIds = new Set<string>();
    let lastError: unknown = null;
    let lastFailedPhotoId = 'photo';

    try {
      for (let i = 0; i < preparedPhotos.length; i++) {
        const item = preparedPhotos[i];
        setUploadProgress(
          totalToUpload > 1
            ? `Publicando foto ${i + 1} de ${totalToUpload}...`
            : 'Publicando fotografía...'
        );
        const photoId = generateSafeId('photo');
        try {
          await setDoc(doc(db, 'wedding_photos', photoId), {
            id: photoId,
            guestName: trimmedName,
            caption: trimmedCaption,
            imageData: item.imageData,
            width: item.width,
            height: item.height,
            visible: true,
            createdAt: serverTimestamp(),
          });
          uploadedLocalIds.add(item.localId);
          uploadedItems.push({ photoId, imageData: item.imageData });
        } catch (err) {
          failedLocalIds.add(item.localId);
          lastError = err;
          lastFailedPhotoId = photoId;
        }
      }

      if (uploadedItems.length > 0) {
        const token = getDriveAccessToken();
        const folderId = extractDriveFolderId(config.googlePhotosUrl);
        const appsScriptUrl = config.appsScriptUrl?.trim();

        if ((token && folderId) || (appsScriptUrl && isValidAppsScriptUrl(appsScriptUrl))) {
          const itemsForDrive = [...uploadedItems];
          window.setTimeout(async () => {
            const safeGuest =
              trimmedName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 28) ||
              'invitado';
            for (const driveItem of itemsForDrive) {
              try {
                const fileName = `${driveItem.photoId}_${safeGuest}.jpg`;
                if (token && folderId) {
                  const blob = dataUrlToBlob(driveItem.imageData);
                  await uploadBlobToGoogleDriveFolder({
                    folderId,
                    accessToken: token,
                    fileName,
                    blob,
                    description: trimmedCaption
                      ? `Compartida por ${trimmedName}: ${trimmedCaption}`
                      : `Compartida por ${trimmedName}`,
                  });
                } else if (appsScriptUrl && isValidAppsScriptUrl(appsScriptUrl)) {
                  await uploadPhotoViaAppsScript({
                    appsScriptUrl,
                    photoId: driveItem.photoId,
                    fileName,
                    imageData: driveItem.imageData,
                    description: trimmedCaption
                      ? `Compartida por ${trimmedName}: ${trimmedCaption}`
                      : `Compartida por ${trimmedName}`,
                  });
                }
              } catch (err) {
                console.warn('Auto-sync photo to Google Drive background task:', err);
              }
            }
          }, 3000);
        }
      }

      if (failedLocalIds.size === 0) {
        setPreparedPhotos([]);
        setCaption('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setUploadSuccessMessage(
          uploadedItems.length === 1
            ? '¡Fotografía publicada en el álbum, Foto Party y guardada para los novios!'
            : `¡${uploadedItems.length} fotografías publicadas en el álbum, Foto Party y guardadas para los novios!`
        );
        window.setTimeout(() => setUploadSuccessMessage(''), 5500);
      } else {
        setPreparedPhotos((prev) =>
          prev.filter((item) => !uploadedLocalIds.has(item.localId))
        );
        try {
          handleFirestoreError(
            lastError,
            OperationType.CREATE,
            `wedding_photos/${lastFailedPhotoId}`
          );
        } catch {
          setUploadError(
            uploadedItems.length > 0
              ? `Se publicaron ${uploadedItems.length} fotos, pero ${failedLocalIds.size} no pudieron enviarse. Presiona Publicar para reintentar las restantes.`
              : 'No pudimos subir tus fotografías en este momento. Intenta de nuevo.'
          );
        }
      }
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const albumUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/#album` : '#album';
  const sharePhotoUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/#compartir-foto`
      : '#compartir-foto';

  if (!isAlbumVisible) {
    return (
      <section
        id="album"
        className="relative overflow-hidden py-16 sm:py-20 px-4 sm:px-6 bg-[#f7f5f0]/75 border-t border-[#b89753]/20"
      >
        <div className="relative z-10 max-w-3xl mx-auto bg-white border border-[#b89753]/35 rounded-3xl p-8 sm:p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-[#f7f5f0] border border-[#b89753]/35 text-[#b89753] flex items-center justify-center mx-auto mb-5 shadow-xs">
            <Camera className="w-6 h-6" />
          </div>

          <div className="space-y-1 mb-3">
            <p className="text-xs uppercase tracking-[0.26em] text-[#b89753] font-semibold text-center">
              ÁLBUM COLABORATIVO
            </p>
            <p className="text-sm uppercase tracking-[0.22em] text-[#2c3e35]/75 font-bold text-center">
              FOTO PARTY
            </p>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#2c3e35] leading-tight text-center">
            ¡Sé nuestro PAPARAZZI!
          </h2>
          <p className="font-['Great_Vibes'] text-3xl sm:text-4xl text-[#b89753] font-normal mt-1 mb-5 text-center">
            Captura cada momento
          </p>

          <div className="max-w-xl mx-auto space-y-2 text-[#2c3e35]/80 text-center">
            <p className="text-base sm:text-lg font-medium text-[#2c3e35]">
              ¡Ayúdanos a no perdernos ningún instante de nuestra boda!
            </p>
            <p className="text-sm sm:text-base leading-relaxed text-[#2c3e35]/75">
              Comparte tus fotografías y captura esos momentos espontáneos, divertidos y especiales que quizás nosotros no alcancemos a ver.
            </p>
          </div>

          {/* Availability Box */}
          <div className="mt-8 pt-7 border-t border-[#b89753]/25 max-w-lg mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2c3e35]/5 border border-[#2c3e35]/15 text-[#2c3e35] text-[11px] sm:text-xs uppercase tracking-[0.22em] font-semibold mb-3">
              <CalendarClock className="w-3.5 h-3.5 text-[#b89753]" />
              <span>DISPONIBLE EL DÍA DE LA BODA</span>
            </div>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-[#b89753] tracking-wide mb-2.5">
              10 de julio de 2027
            </p>
            <p className="text-xs sm:text-sm text-[#2c3e35]/75 leading-relaxed max-w-md mx-auto">
              El álbum y el Foto Party se habilitarán automáticamente para que puedas compartir tus fotografías durante la celebración.
            </p>
          </div>

          {/* Sentimental Quote & Signature */}
          <div className="mt-7 pt-6 border-t border-[#b89753]/20 max-w-md mx-auto text-center">
            <p className="font-serif italic text-base sm:text-lg text-[#2c3e35]/90">
              ¡Cada fotografía contará una parte de nuestra historia!
            </p>
            <p className="mt-2 font-['Great_Vibes'] text-3xl sm:text-4xl text-[#b89753] font-normal">
              Jessica &amp; Jorge
            </p>
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#2c3e35]/60 font-semibold mt-1">
              NUESTRO DÍA ESPECIAL
            </p>
          </div>

          {isCoupleOrAdmin && (
            <div className="mt-7 pt-4 border-t border-dashed border-[#b89753]/30">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                Vista de Administrador · Álbum activo el 10 de julio de 2027 (o actívalo en el panel para pruebas)
              </span>
            </div>
          )}
        </div>
        <SectionCornerFlorals variant="compact" />
      </section>
    );
  }

  return (
    <section
      id="album"
      className="relative overflow-hidden py-16 sm:py-20 px-4 sm:px-6 bg-[#f7f5f0]/75 border-t border-[#b89753]/20"
    >
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="space-y-1 mb-2">
            <p className="text-xs uppercase tracking-[0.26em] text-[#b89753] font-semibold text-center">
              ÁLBUM COLABORATIVO
            </p>
            <p className="text-sm uppercase tracking-[0.22em] text-[#2c3e35]/80 font-bold text-center">
              FOTO PARTY
            </p>
          </div>
          <h2 className="mt-2 font-serif text-4xl sm:text-5xl font-semibold text-[#2c3e35] text-center">
            ¡Sé nuestro PAPARAZZI!
          </h2>
          <p className="mt-1 font-['Great_Vibes'] text-3xl sm:text-4xl text-[#b89753] font-normal text-center">
            Captura cada momento
          </p>
          <div className="mt-3 text-center space-y-1.5 text-[#2c3e35]/75 leading-relaxed max-w-xl mx-auto">
            <p className="text-base font-medium text-[#2c3e35]">
              ¡Ayúdanos a no perdernos ningún instante de nuestra boda!
            </p>
            <p className="text-sm">
              Comparte tus fotografías y captura esos momentos espontáneos, divertidos y especiales que quizás nosotros no alcancemos a ver.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsFotoPartyOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] text-[#fcfbf9] text-xs font-semibold tracking-wide transition-colors cursor-pointer whitespace-nowrap"
            >
              <Tv className="w-4 h-4 text-[#b89753]" />
              <span>Abrir Foto Party en Vivo</span>
            </button>

            <button
              type="button"
              onClick={() => setQrModalMode('album')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white border border-[#b89753]/60 text-[#2c3e35] hover:bg-[#f7f5f0] text-xs font-semibold tracking-wide transition-colors cursor-pointer whitespace-nowrap"
            >
              <QrCode className="w-4 h-4 text-[#b89753]" />
              <span>Código QR para Mesas</span>
            </button>

            {isCoupleOrAdmin && config.googlePhotosUrl && (
              <a
                href={config.googlePhotosUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white border border-[#2c3e35]/20 text-[#2c3e35] hover:border-[#b89753] text-xs font-semibold tracking-wide transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4 text-[#b89753]" />
                <span>Álbum Google Drive (Fotos y Videos)</span>
              </a>
            )}
          </div>
        </div>

        {/* Upload Card + Live Gallery Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Upload Form */}
          <div
            id="compartir-foto"
            className="lg:col-span-4 scroll-mt-24 bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#f7f5f0] border border-[#b89753]/30 text-[#b89753] flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif text-2xl font-semibold text-[#2c3e35] leading-none text-left">
                  Modo Paparazzi · Foto Party
                </h3>
                <p className="text-xs text-[#2c3e35]/65 mt-1 text-left">
                  Sube hasta {MAX_PHOTOS_PER_POST} fotos por envío para el Foto Party y el recuerdo de los novios
                </p>
              </div>
            </div>

            <form onSubmit={handlePhotoUpload} className="space-y-4">

              <div>
                <label
                  htmlFor="photoGuestName"
                  className="block text-xs font-medium text-[#2c3e35] mb-1.5"
                >
                  Tu nombre o familia
                </label>
                <input
                  id="photoGuestName"
                  type="text"
                  required
                  maxLength={80}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ej. Familia Mendoza"
                  className="w-full h-11 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3.5 text-sm text-[#2c3e35] placeholder:text-[#2c3e35]/40 focus:outline-none focus:border-[#b89753]"
                />
              </div>

              <div>
                <label
                  htmlFor="photoCaption"
                  className="block text-xs font-medium text-[#2c3e35] mb-1.5"
                >
                  Dedicatoria breve (opcional)
                </label>
                <input
                  id="photoCaption"
                  type="text"
                  maxLength={220}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Ej. ¡Que sean muy felices!"
                  className="w-full h-11 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3.5 text-sm text-[#2c3e35] placeholder:text-[#2c3e35]/40 focus:outline-none focus:border-[#b89753]"
                />
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  id="photoFileInput"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="sr-only"
                />

                {preparedPhotos.length === 0 ? (
                  <label
                    htmlFor="photoFileInput"
                    className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#b89753]/60 bg-[#fcfbf9] hover:bg-[#f7f5f0] px-4 py-5 text-center cursor-pointer transition-colors"
                  >
                    {isCompressing ? (
                      <div className="flex items-center gap-2 text-xs text-[#2c3e35]">
                        <Loader2 className="w-4 h-4 animate-spin text-[#b89753]" />
                        <span>{compressionProgress || 'Optimizando fotografías...'}</span>
                      </div>
                    ) : (
                      <>
                        <ImagePlus className="w-6 h-6 text-[#b89753] mb-2" />
                        <span className="text-xs font-semibold text-[#2c3e35]">
                          Elegir hasta {MAX_PHOTOS_PER_POST} fotos o tomar con cámara
                        </span>
                        <span className="text-[11px] text-[#2c3e35]/60 mt-1">
                          Compresión automática rápida · Todas quedan guardadas para los novios
                        </span>
                      </>
                    )}
                  </label>
                ) : (
                  <div className="rounded-xl border border-[#b89753]/45 bg-[#fcfbf9] p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#2c3e35] tabular-nums">
                        {preparedPhotos.length} / {MAX_PHOTOS_PER_POST} fotos listas
                      </span>
                      <div className="flex items-center gap-2">
                        {preparedPhotos.length < MAX_PHOTOS_PER_POST && !isCompressing && !isUploading && (
                          <label
                            htmlFor="photoFileInput"
                            className="text-[11px] font-semibold text-[#b89753] hover:text-[#967739] cursor-pointer"
                          >
                            + Agregar más
                          </label>
                        )}
                        {!isUploading && !isCompressing && (
                          <button
                            type="button"
                            onClick={handleClearPreparedPhotos}
                            className="text-[11px] font-medium text-[#2c3e35]/60 hover:text-rose-700 cursor-pointer"
                          >
                            Vaciar
                          </button>
                        )}
                      </div>
                    </div>

                    {isCompressing && (
                      <div className="flex items-center gap-2 text-xs text-[#2c3e35] bg-white rounded-lg px-2.5 py-2 border border-[#b89753]/25">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b89753] shrink-0" />
                        <span>{compressionProgress || 'Optimizando fotografías...'}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2">
                      {preparedPhotos.map((item, idx) => (
                        <div
                          key={item.localId}
                          className="relative aspect-square rounded-lg overflow-hidden border border-[#b89753]/30 bg-[#141d18]"
                        >
                          <img
                            src={item.imageData}
                            alt={`Vista previa ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {!isUploading && (
                            <button
                              type="button"
                              onClick={() => handleRemovePreparedPhoto(item.localId)}
                              aria-label={`Quitar foto ${idx + 1}`}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#141d18]/80 text-white hover:bg-rose-700 flex items-center justify-center cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-[#141d18]/75 text-[9px] text-white/90 tabular-nums">
                            {item.sizeKB} KB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {uploadWarning && (
                <p
                  role="status"
                  className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"
                >
                  {uploadWarning}
                </p>
              )}

              {uploadError && (
                <p
                  role="alert"
                  className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
                >
                  {uploadError}
                </p>
              )}

              {uploadSuccessMessage && (
                <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{uploadSuccessMessage}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={isUploading || isCompressing || preparedPhotos.length === 0}
                className="w-full h-11 rounded-xl bg-[#b89753] hover:bg-[#967739] disabled:opacity-60 text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {isUploading
                    ? uploadProgress || 'Enviando...'
                    : preparedPhotos.length > 1
                      ? `Publicar ${preparedPhotos.length} fotos en el Álbum`
                      : 'Publicar en el Álbum'}
                </span>
              </button>
            </form>

            {/* Direct QR Code to Share Photos */}
            <div className="mt-5 pt-5 border-t border-[#b89753]/20">
              <div className="rounded-xl bg-[#f7f5f0] border border-[#b89753]/25 p-3.5 flex items-center gap-3.5">
                <div className="shrink-0 p-2 rounded-xl bg-white border border-[#b89753]/30 shadow-2xs">
                  <QRCodeSVG
                    value={sharePhotoUrl}
                    size={92}
                    bgColor="#ffffff"
                    fgColor="#2c3e35"
                    level="M"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                    QR Paparazzi · Enviar Fotos
                  </p>
                  <p className="font-serif text-base font-semibold text-[#2c3e35] leading-snug">
                    Escanea y sé paparazzi de la fiesta
                  </p>
                  <p className="text-[11px] text-[#2c3e35]/70 leading-relaxed">
                    Sube hasta {MAX_PHOTOS_PER_POST} fotos por envío directo desde tu celular para que los novios conserven todos los recuerdos.
                  </p>
                  <button
                    type="button"
                    onClick={() => setQrModalMode('upload')}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#b89753] hover:text-[#967739] cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Ampliar / Imprimir QR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Live Fullscreen Slideshow / Carousel */}
          <div className="lg:col-span-8">
            <div className="bg-[#141d18] border border-[#b89753]/40 rounded-2xl overflow-hidden shadow-xl text-[#fcfbf9]">
              {/* Slideshow Toolbar */}
              <div className="px-4 sm:px-5 py-3.5 border-b border-[#b89753]/25 flex flex-wrap items-center justify-between gap-2.5 bg-[#19251e]">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#b89753] font-semibold">
                    {driveFolderName}
                  </p>
                  <p className="text-xs text-[#fcfbf9]/75 mt-0.5 tabular-nums">
                    {combinedSlides.length > 0
                      ? `Diapositiva ${(slideIndex % combinedSlides.length) + 1} de ${combinedSlides.length}`
                      : isFetchingDriveSlides
                        ? 'Cargando carpeta de Google Drive...'
                        : 'Listo para proyectar recuerdos'}
                    {driveSlides.length > 0 &&
                      ` · ${driveSlides.length} desde Drive`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isCoupleOrAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={handleOpenDriveConfig}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#b89753]/45 bg-[#233229] hover:bg-[#b89753]/25 text-[11px] font-semibold text-[#fcfbf9] transition-colors cursor-pointer"
                        title="Cambiar carpeta pública de Google Drive en 1 paso"
                      >
                        <Settings className="w-3.5 h-3.5 text-[#b89753]" />
                        <span>Configurar Google Drive</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadStandaloneHtml}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#b89753]/45 bg-[#2c3e35]/80 hover:bg-[#b89753]/25 text-[11px] font-semibold text-[#fcfbf9] transition-colors cursor-pointer"
                        title="Descargar presentación en un solo archivo HTML independiente"
                      >
                        <Download className="w-3.5 h-3.5 text-[#b89753]" />
                        <span className="hidden sm:inline">Descargar HTML</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => void loadDriveSlides()}
                    disabled={isFetchingDriveSlides}
                    title="Actualizar diapositivas"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#b89753]/35 text-[11px] font-semibold text-[#fcfbf9] hover:bg-[#b89753]/20 transition-colors cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-[#b89753] ${
                        isFetchingDriveSlides ? 'animate-spin' : ''
                      }`}
                    />
                    <span className="hidden sm:inline">Actualizar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleToggleStageFullscreen()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#b89753] hover:bg-[#967739] text-white text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Pantalla Completa</span>
                  </button>
                </div>
              </div>

              {/* Slideshow Viewport (Supports Native Fullscreen) */}
              <div
                ref={stageRef}
                onTouchStart={(e) => {
                  touchStartXRef.current = e.touches?.[0]?.clientX ?? null;
                }}
                onTouchEnd={(e) => {
                  if (
                    touchStartXRef.current === null ||
                    combinedSlides.length <= 1
                  ) {
                    return;
                  }
                  const endX = e.changedTouches?.[0]?.clientX;
                  if (typeof endX !== 'number') return;
                  const deltaX = endX - touchStartXRef.current;
                  touchStartXRef.current = null;
                  if (Math.abs(deltaX) > 45) {
                    setSlideIndex((prev) =>
                      deltaX < 0
                        ? (prev + 1) % combinedSlides.length
                        : (prev - 1 + combinedSlides.length) %
                          combinedSlides.length
                    );
                  }
                }}
                className={`relative w-full bg-[#101713] flex items-center justify-center overflow-hidden ${
                  isStageFullscreen
                    ? 'h-[100dvh] w-screen'
                    : 'aspect-[16/10] sm:aspect-[16/9] min-h-[320px] sm:min-h-[420px]'
                }`}
              >
                {combinedSlides.length === 0 ? (
                  <div className="p-8 sm:p-12 text-center max-w-lg mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#1f2d25] border border-[#b89753]/40 text-[#b89753] flex items-center justify-center mx-auto">
                      {isFetchingDriveSlides ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5" />
                      )}
                    </div>
                    <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#fcfbf9]">
                      {isFetchingDriveSlides
                        ? `Cargando carpeta ${driveFolderName}...`
                        : 'Sé el primero en inaugurar el álbum'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#fcfbf9]/70 leading-relaxed">
                      Las fotografías de tu carpeta pública de Google Drive y
                      las compartidas por los invitados aparecen aquí
                      automáticamente sin necesidad de configuración adicional.
                    </p>
                    {driveSlidesError && (
                      <p className="text-xs text-amber-300">{driveSlidesError}</p>
                    )}
                  </div>
                ) : (
                  (() => {
                    const activeSlide =
                      combinedSlides[slideIndex % combinedSlides.length];
                    return (
                      <>
                        {/* Blurred Ambient Backdrop */}
                        <div
                          className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl opacity-30 transition-all duration-700 pointer-events-none"
                          style={{
                            backgroundImage: `url("${activeSlide.imageData}")`,
                          }}
                        />

                        {/* Main Slide Image with Anti-Download Protective Shield */}
                        <div
                          className="relative z-10 max-h-full max-w-full flex items-center justify-center p-3 sm:p-5 select-none"
                          onContextMenu={(e) => {
                            if (!isCoupleOrAdmin) e.preventDefault();
                          }}
                        >
                          <img
                            key={activeSlide.id}
                            src={activeSlide.imageData}
                            alt={
                              activeSlide.caption ||
                              `Foto por ${activeSlide.guestName}`
                            }
                            onError={(e) => {
                              const imgEl = e.currentTarget;
                              if (
                                activeSlide.fallbackUrl &&
                                imgEl.src !== activeSlide.fallbackUrl
                              ) {
                                imgEl.src = activeSlide.fallbackUrl;
                              }
                            }}
                            onClick={
                              isCoupleOrAdmin
                                ? () => setSelectedPhoto(activeSlide)
                                : undefined
                            }
                            draggable={isCoupleOrAdmin}
                            className={`max-h-full max-w-full object-contain select-none transition-opacity duration-500 ${
                              isCoupleOrAdmin
                                ? 'cursor-pointer'
                                : 'pointer-events-none'
                            }`}
                            style={
                              isCoupleOrAdmin
                                ? undefined
                                : {
                                    WebkitTouchCallout: 'none',
                                    WebkitUserSelect: 'none',
                                    userSelect: 'none',
                                  }
                            }
                          />

                          {/* Transparent protective shield over the image: blocks mobile long-press context menu while allowing tap to enlarge */}
                          {!isCoupleOrAdmin && (
                            <div
                              className="absolute inset-0 z-20 bg-transparent cursor-pointer select-none"
                              style={{
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                                userSelect: 'none',
                              }}
                              onClick={() => setSelectedPhoto(activeSlide)}
                              onContextMenu={(e) => e.preventDefault()}
                            />
                          )}
                        </div>

                        {/* Left / Right Navigation Arrows */}
                        {combinedSlides.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setSlideIndex(
                                  (prev) =>
                                    (prev - 1 + combinedSlides.length) %
                                    combinedSlides.length
                                )
                              }
                              aria-label="Diapositiva anterior"
                              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#141d18]/75 border border-[#b89753]/40 text-[#fcfbf9] hover:bg-[#b89753]/30 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSlideIndex(
                                  (prev) => (prev + 1) % combinedSlides.length
                                )
                              }
                              aria-label="Siguiente diapositiva"
                              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#141d18]/75 border border-[#b89753]/40 text-[#fcfbf9] hover:bg-[#b89753]/30 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </>
                        )}

                        {/* Bottom Overlay Controls */}
                        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#101713]/95 via-[#101713]/65 to-transparent px-4 sm:px-6 pt-10 pb-3.5 flex items-end justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[#b89753] font-semibold truncate">
                              {activeSlide.guestName}
                            </p>
                            {activeSlide.caption && (
                              <p className="font-serif italic text-base sm:text-xl text-[#fcfbf9] truncate">
                                &ldquo;{activeSlide.caption}&rdquo;
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {combinedSlides.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setIsSlideshowPlaying((prev) => !prev)
                                }
                                aria-label={
                                  isSlideshowPlaying
                                    ? 'Pausar carrusel'
                                    : 'Reproducir carrusel'
                                }
                                className="h-9 px-3.5 rounded-full bg-[#141d18]/80 border border-[#b89753]/45 text-xs font-semibold text-[#fcfbf9] hover:bg-[#b89753]/25 inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                {isSlideshowPlaying ? (
                                  <>
                                    <Pause className="w-3.5 h-3.5 text-[#b89753]" />
                                    <span className="hidden sm:inline">
                                      Pausar
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3.5 h-3.5 text-[#b89753]" />
                                    <span className="hidden sm:inline">
                                      Reproducir
                                    </span>
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => void handleToggleStageFullscreen()}
                              aria-label={
                                isStageFullscreen
                                  ? 'Salir de pantalla completa'
                                  : 'Pantalla completa'
                              }
                              className="w-9 h-9 rounded-full bg-[#141d18]/80 border border-[#b89753]/45 text-[#fcfbf9] hover:bg-[#b89753]/25 flex items-center justify-center cursor-pointer"
                            >
                              {isStageFullscreen ? (
                                <Minimize2 className="w-4 h-4 text-[#b89753]" />
                              ) : (
                                <Maximize2 className="w-4 h-4 text-[#b89753]" />
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()
                )}
              </div>

              {/* Thumbnail Strip */}
              {combinedSlides.length > 0 && (
                <div className="px-4 py-3 bg-[#19251e] border-t border-[#b89753]/20 flex items-center gap-2.5 overflow-x-auto">
                  {combinedSlides.map((slide, idx) => {
                    const isActive =
                      idx === slideIndex % combinedSlides.length;
                    return (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => setSlideIndex(idx)}
                        onContextMenu={(e) => {
                          if (!isCoupleOrAdmin) e.preventDefault();
                        }}
                        className={`relative shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer select-none ${
                          isActive
                            ? 'border-[#b89753] scale-105 shadow-md'
                            : 'border-transparent opacity-60 hover:opacity-95'
                        }`}
                        aria-label={`Ver diapositiva ${idx + 1}`}
                      >
                        <img
                          src={slide.imageData}
                          alt={slide.caption || slide.guestName}
                          draggable={false}
                          onError={(e) => {
                            const imgEl = e.currentTarget;
                            if (
                              slide.fallbackUrl &&
                              imgEl.src !== slide.fallbackUrl
                            ) {
                              imgEl.src = slide.fallbackUrl;
                            }
                          }}
                          className="w-full h-full object-cover pointer-events-none select-none"
                          style={{
                            WebkitTouchCallout: 'none',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-[#141d18]/90 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-[#fcfbf9] rounded-2xl overflow-hidden border border-[#b89753]/40 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              aria-label="Cerrar foto"
              className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-[#2c3e35]/85 text-white flex items-center justify-center hover:bg-[#2c3e35] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div
              className="relative bg-[#141d18] flex items-center justify-center max-h-[70vh] select-none"
              onContextMenu={(e) => {
                if (!isCoupleOrAdmin) e.preventDefault();
              }}
            >
              <img
                src={selectedPhoto.imageData}
                alt={selectedPhoto.caption || selectedPhoto.guestName}
                onError={(e) => {
                  const imgEl = e.currentTarget;
                  if (
                    selectedPhoto.fallbackUrl &&
                    imgEl.src !== selectedPhoto.fallbackUrl
                  ) {
                    imgEl.src = selectedPhoto.fallbackUrl;
                  }
                }}
                draggable={isCoupleOrAdmin}
                className={`max-h-[70vh] w-auto object-contain select-none ${
                  isCoupleOrAdmin ? '' : 'pointer-events-none'
                }`}
                style={
                  isCoupleOrAdmin
                    ? undefined
                    : {
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none',
                      }
                }
              />
              {/* Anti-download glass shield */}
              {!isCoupleOrAdmin && (
                <div
                  className="absolute inset-0 z-10 bg-transparent select-none"
                  style={{
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                />
              )}
            </div>
            <div className="p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                  Compartida por {selectedPhoto.guestName}
                </p>
                {selectedPhoto.caption && (
                  <p className="mt-1 font-serif italic text-xl text-[#2c3e35]">
                    &ldquo;{selectedPhoto.caption}&rdquo;
                  </p>
                )}
              </div>
              {isCoupleOrAdmin && selectedPhoto.imageData && (
                <a
                  href={selectedPhoto.imageData}
                  download={`Boda_JJ_${selectedPhoto.guestName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24) || 'invitado'}.jpg`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] text-white text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#b89753]" />
                  <span>Guardar</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Table & Direct Photo Upload QR Modal */}
      {qrModalMode !== null && (
        <div
          className="fixed inset-0 z-50 bg-[#2c3e35]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setQrModalMode(null)}
        >
          <div
            className="relative max-w-md w-full max-h-[90dvh] overflow-y-auto bg-[#fcfbf9] border border-[#b89753]/40 rounded-2xl p-6 sm:p-8 text-center shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setQrModalMode(null)}
              aria-label="Cerrar tarjeta QR"
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#2c3e35]/70 hover:bg-[#f7f5f0] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#b89753] font-semibold">
                {qrModalMode === 'upload'
                  ? 'QR Directo a Compartir Foto'
                  : 'Tarjeta para Centros de Mesa'}
              </p>
              <h3 className="mt-1 font-['Great_Vibes'] text-3xl sm:text-4xl font-normal text-[#b89753]">
                Jessica Paiz{' '}
                <span className="font-serif italic text-[#7e919e] text-2xl sm:text-3xl">
                  &amp;
                </span>{' '}
                Jorge Rodas
              </h3>
              <p className="mt-2 text-sm text-[#2c3e35]/75">
                {qrModalMode === 'upload'
                  ? 'Escanea con tu cámara para abrir directamente el formulario de Compartir Foto y enviar tus recuerdos al Foto Party.'
                  : 'Escanea el código con tu cámara para compartir tus fotos en el álbum y verlas en el Foto Party en vivo.'}
              </p>
            </div>

            <div className="inline-flex p-1 rounded-full bg-[#f7f5f0] border border-[#b89753]/25 gap-1">
              <button
                type="button"
                onClick={() => setQrModalMode('upload')}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                  qrModalMode === 'upload'
                    ? 'bg-[#2c3e35] text-white'
                    : 'text-[#2c3e35]/70 hover:text-[#2c3e35]'
                }`}
              >
                Compartir Foto
              </button>
              <button
                type="button"
                onClick={() => setQrModalMode('album')}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                  qrModalMode === 'album'
                    ? 'bg-[#2c3e35] text-white'
                    : 'text-[#2c3e35]/70 hover:text-[#2c3e35]'
                }`}
              >
                Álbum Completo
              </button>
            </div>

            <div className="inline-flex p-5 rounded-2xl bg-white border border-[#b89753]/35 shadow-xs">
              <QRCodeSVG
                value={qrModalMode === 'upload' ? sharePhotoUrl : albumUrl}
                size={196}
                bgColor="#ffffff"
                fgColor="#2c3e35"
                level="M"
              />
            </div>

            <p className="text-xs text-[#2c3e35]/55 break-all">
              {qrModalMode === 'upload' ? sharePhotoUrl : albumUrl}
            </p>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2c3e35] text-white text-xs font-semibold hover:bg-[#1f2c26] transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Tarjeta QR</span>
            </button>
          </div>
        </div>
      )}

      {/* Configure Google Drive Folder Modal (1-Step Direct Folder Loader) */}
      {isDriveConfigOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#141d18]/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsDriveConfigOpen(false)}
        >
          <div
            className="relative max-w-lg w-full max-h-[90dvh] overflow-y-auto bg-[#fcfbf9] border border-[#b89753]/45 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsDriveConfigOpen(false)}
              aria-label="Cerrar configuración de Google Drive"
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#2c3e35]/70 hover:bg-[#f7f5f0] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#b89753] font-semibold">
                Carga directa en 1 paso
              </p>
              <h3 className="mt-1 font-serif text-3xl font-semibold text-[#2c3e35]">
                Configurar Google Drive
              </h3>
              <p className="mt-1.5 text-xs text-[#2c3e35]/75 leading-relaxed">
                Pega directamente el enlace normal de cualquier carpeta pública
                de Google Drive y presiona{' '}
                <strong>Guardar y cargar imágenes</strong>.
              </p>
            </div>

            <form onSubmit={handleSaveDriveConfig} className="space-y-4">
              <div>
                <label
                  htmlFor="driveFolderUrlInput"
                  className="block text-xs font-semibold text-[#2c3e35] mb-1.5"
                >
                  Enlace de carpeta pública de Google Drive
                </label>
                <input
                  id="driveFolderUrlInput"
                  type="url"
                  required
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full h-11 bg-white border border-[#b89753]/40 rounded-xl px-3.5 text-sm text-[#2c3e35] placeholder:text-[#2c3e35]/40 focus:outline-none focus:border-[#b89753]"
                />
              </div>

              <div className="border-t border-[#b89753]/20 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdvancedScript((prev) => !prev)}
                  className="text-xs font-semibold text-[#b89753] hover:text-[#967739] cursor-pointer"
                >
                  {showAdvancedScript
                    ? '▾ Ocultar sección avanzada (Apps Script)'
                    : '▸ Opciones avanzadas: usar endpoint propio de Apps Script (/exec)'}
                </button>

                {showAdvancedScript && (
                  <div className="mt-3 space-y-1.5">
                    <label
                      htmlFor="driveAppsScriptInput"
                      className="block text-xs font-medium text-[#2c3e35]"
                    >
                      Endpoint opcional de Google Apps Script (/exec)
                    </label>
                    <input
                      id="driveAppsScriptInput"
                      type="url"
                      value={scriptInput}
                      onChange={(e) => setScriptInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full h-10 bg-white border border-[#b89753]/35 rounded-xl px-3.5 text-xs text-[#2c3e35] placeholder:text-[#2c3e35]/40 focus:outline-none focus:border-[#b89753]"
                    />
                    <p className="text-[11px] text-[#2c3e35]/60">
                      Déjalo vacío para cargar directamente desde el enlace de
                      la carpeta pública.
                    </p>
                  </div>
                )}
              </div>

              {driveConfigError && (
                <p
                  role="alert"
                  className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
                >
                  {driveConfigError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={isFetchingDriveSlides}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#b89753] hover:bg-[#967739] disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {isFetchingDriveSlides && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Guardar y cargar imágenes</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleRestoreDemoFolder()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-[#b89753]/45 hover:bg-[#f7f5f0] text-[#2c3e35] text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#b89753]" />
                  <span>Restaurar demo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Live Foto Party */}
      <FotoPartyOverlay
        isOpen={isFotoPartyOpen}
        onClose={() => setIsFotoPartyOpen(false)}
        photos={combinedSlides}
        intervalSec={config.fotoPartyIntervalSec}
      />
      <SectionCornerFlorals variant="alternating" />
    </section>
  );
};
