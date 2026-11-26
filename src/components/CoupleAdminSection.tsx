import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CloudUpload,
  Code2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Gift,
  Heart,
  ImagePlus,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogOut,
  MailCheck,
  MapPin,
  Music,
  Pause,
  Phone,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Info,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Utensils,
  Volume2,
  X,
} from 'lucide-react';
import {
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import JSZip from 'jszip';
import {
  adminGoogleProvider,
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { SectionCornerFlorals } from './BotanicalArtwork';
import {
  AUTHORIZED_COUPLE_ACCOUNTS,
  CustomAudioMode,
  DEFAULT_GODPARENTS_LIST,
  DEFAULT_HERO_PHOTOS,
  DEFAULT_INTEGRATED_AUDIO_TITLE,
  DEFAULT_INTEGRATED_AUDIO_URL,
  DEFAULT_WEDDING_CONFIG,
  formatTime12h,
  formatWeddingEventDateLabel,
  formatWeddingReportDateLabel,
  getGuestRelationLabel,
  GodparentRole,
  GUEST_RELATION_GROUPS,
  GuestQuotaRecord,
  GuestRelationGroup,
  HeroPhotoRecord,
  isAuthorizedCoupleEmail,
  isValidPhoneKey,
  mergeWeddingConfig,
  saveStoredWeddingConfig,
  saveStoredGuestQuotas,
  normalizePhoneKey,
  normalizeText,
  resolveLoginIdentifier,
  RsvpRecord,
  TABLE_CAPACITY,
  WeddingConfigRecord,
  WeddingPhotoRecord,
} from '../data/weddingData';
import {
  exportConfirmedGuestsBySurnamePdf,
  exportTablePlaceCardsPdf,
  exportWeddingReportPdf,
} from '../utils/pdfReport';
import {
  clearDriveAccessToken,
  dataUrlToBlob,
  extractDriveFolderId,
  getDriveAccessToken,
  googleDriveSignIn,
  initDriveAuth,
  listDriveFolderFiles,
  uploadBlobToGoogleDriveFolder,
} from '../utils/googleDrive';
import {
  buildGoogleAppsScriptCode,
  DEFAULT_DRIVE_FOLDER_ID,
  downloadStandaloneSlideshowHtml,
  isValidAppsScriptUrl,
} from '../utils/driveSlideshowExport';
import { QRCodeSVG } from 'qrcode.react';
import {
  compressQrCodeImage,
  compressWeddingPhoto,
} from '../utils/imageCompression';
import {
  assembleAudioBlobUrlFromChunks,
  formatAudioDuration,
  prepareAudioFileForUpload,
} from '../utils/audioStorage';
import { GoogleSignInButton } from './GoogleSignInButton';

type AdminTab = 'rsvps' | 'quotas' | 'wedding' | 'media' | 'photos' | 'settings';

interface NumericInputProps {
  id?: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  onCommit: (nextValue: number) => void;
  onBlurCommit?: (nextValue: number) => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

const NumericInput: React.FC<NumericInputProps> = ({
  id,
  value,
  min,
  max,
  defaultValue,
  onCommit,
  onBlurCommit,
  className,
  ariaLabel,
  disabled,
}) => {
  const [text, setText] = useState<string>(() => String(value));
  const isFocusedRef = useRef(false);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(String(value));
    }
  }, [value]);

  const handleFocus = () => {
    prevValueRef.current = value;
    isFocusedRef.current = true;
    setText('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setText(digits);
    if (digits !== '') {
      const clamped = Math.min(max, Math.max(min, Number(digits)));
      onCommit(clamped);
    } else {
      onCommit(defaultValue);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const resolved =
      text === ''
        ? prevValueRef.current
        : Math.min(max, Math.max(min, Number(text)));
    setText(String(resolved));
    onCommit(resolved);
    if (onBlurCommit) {
      onBlurCommit(resolved);
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={ariaLabel}
      value={text}
      disabled={disabled}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
};

function parseRelationGroupInput(raw: string): GuestRelationGroup | '' {
  const norm = normalizeText(raw);
  if (!norm) return '';
  if (
    norm === 'familiar_novio' ||
    (norm.includes('fam') && norm.includes('novio'))
  ) {
    return 'familiar_novio';
  }
  if (
    norm === 'familiar_novia' ||
    (norm.includes('fam') && norm.includes('novia'))
  ) {
    return 'familiar_novia';
  }
  if (
    norm === 'amigo_novia' ||
    (norm.includes('amig') && norm.includes('novia'))
  ) {
    return 'amigo_novia';
  }
  if (
    norm === 'amigo_novio' ||
    (norm.includes('amig') && norm.includes('novio'))
  ) {
    return 'amigo_novio';
  }
  return '';
}

function buildDrivePhotoFilename(photo: WeddingPhotoRecord): string {
  const safeGuest =
    photo.guestName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 28) || 'invitado';
  return `${photo.id}_${safeGuest}.jpg`;
}

function formatRsvpDate(
  createdAt?: { seconds: number; nanoseconds: number } | null
): string {
  if (!createdAt?.seconds) return 'Reciente';
  return new Date(createdAt.seconds * 1000).toLocaleDateString('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const CoupleAdminSection: React.FC = () => {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [unauthorizedAttemptEmail, setUnauthorizedAttemptEmail] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  // Admin data state
  const [activeTab, setActiveTab] = useState<AdminTab>('rsvps');
  const [rsvps, setRsvps] = useState<RsvpRecord[]>([]);
  const [guestQuotas, setGuestQuotas] = useState<GuestQuotaRecord[]>([]);
  const [allPhotos, setAllPhotos] = useState<WeddingPhotoRecord[]>([]);
  const [rsvpFilter, setRsvpFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [rsvpSearch, setRsvpSearch] = useState('');

  // Guest Quotas (Roster) form & filter state
  const [quotaSearch, setQuotaSearch] = useState('');
  const [quotaStatusFilter, setQuotaStatusFilter] = useState<
    'all' | 'pending' | 'confirmed'
  >('all');
  const [editingPhoneKey, setEditingPhoneKey] = useState<string | null>(null);
  const [quotaGuestName, setQuotaGuestName] = useState('');
  const [quotaPhone, setQuotaPhone] = useState('');
  const [quotaMaxAdults, setQuotaMaxAdults] = useState(2);
  const [quotaMaxKids, setQuotaMaxKids] = useState(0);
  const [quotaMaxBabies, setQuotaMaxBabies] = useState(0);
  const [quotaAssignedTable, setQuotaAssignedTable] = useState(0);
  const [assignmentMode, setAssignmentMode] = useState<
    'auto_novio' | 'auto_novia' | 'manual'
  >('auto_novio');
  const [quotaGuestGroup, setQuotaGuestGroup] = useState<
    GuestRelationGroup | ''
  >('');
  const [quotaNotes, setQuotaNotes] = useState('');
  const [savingQuota, setSavingQuota] = useState(false);
  const [quotaFormError, setQuotaFormError] = useState('');
  const [quotaFormSuccess, setQuotaFormSuccess] = useState('');

  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [isImportingBulk, setIsImportingBulk] = useState(false);
  const [bulkImportMessage, setBulkImportMessage] = useState('');

  // ZIP & CSV export state
  const [isZipping, setIsZipping] = useState(false);

  // Settings form state
  const [googlePhotosUrl, setGooglePhotosUrl] = useState(
    DEFAULT_WEDDING_CONFIG.googlePhotosUrl
  );
  const [appsScriptUrl, setAppsScriptUrl] = useState(
    DEFAULT_WEDDING_CONFIG.appsScriptUrl
  );
  const [welcomeNote, setWelcomeNote] = useState(
    DEFAULT_WEDDING_CONFIG.welcomeNote
  );
  const [intervalSec, setIntervalSec] = useState(
    DEFAULT_WEDDING_CONFIG.fotoPartyIntervalSec
  );
  const [albumEnabledEarly, setAlbumEnabledEarly] = useState(
    DEFAULT_WEDDING_CONFIG.albumEnabledEarly
  );
  const [tablesVisibleToGuests, setTablesVisibleToGuests] = useState(
    DEFAULT_WEDDING_CONFIG.tablesVisibleToGuests ?? false
  );
  const [totalTables, setTotalTables] = useState<number>(
    DEFAULT_WEDDING_CONFIG.totalTables ?? 10
  );
  const [heroPhotoUrl, setHeroPhotoUrl] = useState<string>(
    DEFAULT_WEDDING_CONFIG.heroPhotoUrl ?? ''
  );
  const [adminPhone, setAdminPhone] = useState<string>(
    DEFAULT_WEDDING_CONFIG.adminPhone ?? '+503 76874760'
  );
  const [groomPhone, setGroomPhone] = useState<string>(
    DEFAULT_WEDDING_CONFIG.groomPhone ?? '+503 78249210'
  );
  const [budgetAdultPlates, setBudgetAdultPlates] = useState<number>(
    DEFAULT_WEDDING_CONFIG.budgetAdultPlates ?? 0
  );
  const [budgetKidPlates, setBudgetKidPlates] = useState<number>(
    DEFAULT_WEDDING_CONFIG.budgetKidPlates ?? 0
  );

  // Wedding Details (Date, Events, Parents, Godparents) state
  const [weddingDateISO, setWeddingDateISO] = useState<string>(
    DEFAULT_WEDDING_CONFIG.weddingDateISO ?? '2027-07-10'
  );
  const [ceremonyTime, setCeremonyTime] = useState<string>(
    DEFAULT_WEDDING_CONFIG.ceremonyTime ?? '16:00'
  );
  const [ceremonyVenue, setCeremonyVenue] = useState<string>(
    DEFAULT_WEDDING_CONFIG.ceremonyVenue ?? 'Parroquia Principal'
  );
  const [ceremonyAddress, setCeremonyAddress] = useState<string>(
    DEFAULT_WEDDING_CONFIG.ceremonyAddress ??
      'Centro Histórico, San Salvador, El Salvador'
  );
  const [ceremonyMapUrl, setCeremonyMapUrl] = useState<string>(
    DEFAULT_WEDDING_CONFIG.ceremonyMapUrl ?? ''
  );
  const [receptionTime, setReceptionTime] = useState<string>(
    DEFAULT_WEDDING_CONFIG.receptionTime ?? '19:00'
  );
  const [receptionVenue, setReceptionVenue] = useState<string>(
    DEFAULT_WEDDING_CONFIG.receptionVenue ?? 'Salón de Eventos Elegance'
  );
  const [receptionAddress, setReceptionAddress] = useState<string>(
    DEFAULT_WEDDING_CONFIG.receptionAddress ??
      'Zona Escalón, San Salvador, El Salvador'
  );
  const [receptionMapUrl, setReceptionMapUrl] = useState<string>(
    DEFAULT_WEDDING_CONFIG.receptionMapUrl ?? ''
  );
  const [brideParents, setBrideParents] = useState<string>(
    DEFAULT_WEDDING_CONFIG.brideParents ?? ''
  );
  const [groomParents, setGroomParents] = useState<string>(
    DEFAULT_WEDDING_CONFIG.groomParents ?? ''
  );
  const [godparentsList, setGodparentsList] = useState<GodparentRole[]>(
    DEFAULT_GODPARENTS_LIST
  );

  // Gift Registry & Lluvia de Sobres state
  const [giftEnvelopeNote, setGiftEnvelopeNote] = useState<string>(
    DEFAULT_WEDDING_CONFIG.giftEnvelopeNote ?? ''
  );
  const [giftBankName, setGiftBankName] = useState<string>(
    DEFAULT_WEDDING_CONFIG.giftBankName ?? ''
  );
  const [giftAccountHolder, setGiftAccountHolder] = useState<string>(
    DEFAULT_WEDDING_CONFIG.giftAccountHolder ?? ''
  );
  const [giftAccountType, setGiftAccountType] = useState<string>(
    DEFAULT_WEDDING_CONFIG.giftAccountType ?? ''
  );
  const [giftAccountNumber, setGiftAccountNumber] = useState<string>(
    DEFAULT_WEDDING_CONFIG.giftAccountNumber ?? ''
  );
  const [giftQrValue, setGiftQrValue] = useState<string>('');
  const [giftQrImage, setGiftQrImage] = useState<string>('');
  const [isCompressingGiftQr, setIsCompressingGiftQr] = useState(false);
  const [giftQrError, setGiftQrError] = useState('');

  // Hero Carousel & Custom Ambient Music state
  const [heroPhotosList, setHeroPhotosList] = useState<HeroPhotoRecord[]>([]);
  const [hideDefaultHeroPhotos, setHideDefaultHeroPhotos] = useState(false);
  const [uploadingHeroImages, setUploadingHeroImages] = useState(false);
  const [replacingHeroId, setReplacingHeroId] = useState<string | null>(null);
  const [newHeroUrlInput, setNewHeroUrlInput] = useState('');
  const [newHeroCaptionInput, setNewHeroCaptionInput] = useState('');
  const [heroCaptionDrafts, setHeroCaptionDrafts] = useState<Record<string, string>>({});
  const [heroMediaError, setHeroMediaError] = useState('');
  const [heroMediaSuccess, setHeroMediaSuccess] = useState('');

  const [customAudioMode, setCustomAudioMode] = useState<CustomAudioMode>(
    DEFAULT_WEDDING_CONFIG.customAudioMode ?? 'synth'
  );
  const [customAudioUrl, setCustomAudioUrl] = useState('');
  const [customAudioTitle, setCustomAudioTitle] = useState(
    DEFAULT_INTEGRATED_AUDIO_TITLE
  );
  const [customAudioMime, setCustomAudioMime] = useState('audio/mpeg');
  const [customAudioChunkCount, setCustomAudioChunkCount] = useState(0);
  const [customAudioUpdatedToken, setCustomAudioUpdatedToken] = useState('');
  const [customAudioDurationSec, setCustomAudioDurationSec] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioUploadProgress, setAudioUploadProgress] = useState('');
  const [audioMediaError, setAudioMediaError] = useState('');
  const [audioMediaSuccess, setAudioMediaSuccess] = useState('');
  const [adminPreviewBlobUrl, setAdminPreviewBlobUrl] = useState('');
  const [isAdminPreviewPlaying, setIsAdminPreviewPlaying] = useState(false);
  const adminPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const loadedAdminTokenRef = useRef<string>('');

  type WeddingSectionSaveKey =
    | 'date'
    | 'ceremony'
    | 'reception'
    | 'parents'
    | 'godparents'
    | `godparent-${number}`
    | 'gifts'
    | 'all';

  const [savingSectionKey, setSavingSectionKey] = useState<WeddingSectionSaveKey | null>(null);
  const [savedSectionKey, setSavedSectionKey] = useState<WeddingSectionSaveKey | null>(null);
  const [sectionSaveErrors, setSectionSaveErrors] = useState<Record<string, string>>({});
  const [refreshingPermissions, setRefreshingPermissions] = useState(false);
  const [permissionsRefreshedMsg, setPermissionsRefreshedMsg] = useState('');

  const [savingWeddingDetails, setSavingWeddingDetails] = useState(false);
  const [weddingDetailsSaved, setWeddingDetailsSaved] = useState(false);
  const [weddingDetailsError, setWeddingDetailsError] = useState('');

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [showAppsScriptCode, setShowAppsScriptCode] = useState(false);
  const [copiedAppsScript, setCopiedAppsScript] = useState(false);

  // Google Drive archive state (in-memory token only)
  const [driveToken, setDriveToken] = useState<string | null>(() =>
    getDriveAccessToken()
  );
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [driveSyncedIds, setDriveSyncedIds] = useState<Set<string>>(new Set());
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSyncProgress, setDriveSyncProgress] = useState('');
  const [driveError, setDriveError] = useState('');
  const [driveStatusMsg, setDriveStatusMsg] = useState('');
  const [confirmDriveModalOpen, setConfirmDriveModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (user && isAuthorizedCoupleEmail(user.email)) {
        void syncAdminTokenAndDoc(user, false);
      }
    });
    const unsubDrive = initDriveAuth(
      (user, token) => {
        setDriveToken(token);
        setDriveEmail(user.email);
      },
      () => {
        setDriveToken(null);
        setDriveEmail(null);
      }
    );
    return () => {
      unsubscribe();
      unsubDrive();
    };
  }, []);

  const isAuthorizedCouple =
    Boolean(currentUser) && isAuthorizedCoupleEmail(currentUser?.email);

  const hasUnauthorizedAttempt =
    Boolean(unauthorizedAttemptEmail) || (Boolean(currentUser) && !isAuthorizedCouple);

  const isVerifiedCoupleAdmin = isAuthorizedCouple;

  const driveFolderId = useMemo(
    () => extractDriveFolderId(googlePhotosUrl),
    [googlePhotosUrl]
  );

  useEffect(() => {
    if (!authReady || !isVerifiedCoupleAdmin) {
      setRsvps([]);
      setGuestQuotas([]);
      setAllPhotos([]);
      return;
    }

    const rsvpQuery = query(
      collection(db, 'rsvps'),
      orderBy('createdAt', 'desc')
    );
    const unsubRsvps = onSnapshot(
      rsvpQuery,
      (snapshot) => {
        const list: RsvpRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            guestName: String(d.guestName ?? ''),
            surnames: Array.isArray(d.surnames) ? d.surnames.map(String) : [],
            adults: Number(d.adults ?? 1),
            kids: Number(d.kids ?? 0),
            babies: Number(d.babies ?? 0),
            attending: Boolean(d.attending),
            tableNumber: Number(d.tableNumber ?? 0),
            phone: String(d.phone ?? ''),
            phoneKey: d.phoneKey ? String(d.phoneKey) : undefined,
            notes: String(d.notes ?? ''),
            guestGroup: (d.guestGroup as GuestRelationGroup | '') ?? '',
            createdAt: d.createdAt ?? null,
          };
        });
        setRsvps(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'rsvps');
      }
    );

    const quotasQuery = query(
      collection(db, 'guest_quotas'),
      orderBy('guestName', 'asc')
    );
    const unsubQuotas = onSnapshot(
      quotasQuery,
      (snapshot) => {
        const list: GuestQuotaRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            phoneKey: String(d.phoneKey ?? docSnap.id),
            phoneDisplay: String(d.phoneDisplay ?? ''),
            guestName: String(d.guestName ?? ''),
            maxAdults: Number(d.maxAdults ?? 1),
            maxKids: Number(d.maxKids ?? 0),
            maxBabies: Number(d.maxBabies ?? 0),
            assignedTable: Number(d.assignedTable ?? 0),
            guestGroup: (d.guestGroup as GuestRelationGroup | '') ?? '',
            notes: String(d.notes ?? ''),
            confirmed: Boolean(d.confirmed),
            rsvpId: String(d.rsvpId ?? ''),
            createdAt: d.createdAt ?? null,
            updatedAt: d.updatedAt ?? null,
          };
        });
        setGuestQuotas(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'guest_quotas');
      }
    );

    const photosQuery = query(
      collection(db, 'wedding_photos'),
      orderBy('createdAt', 'desc')
    );
    const unsubPhotos = onSnapshot(
      photosQuery,
      (snapshot) => {
        const list: WeddingPhotoRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            guestName: String(d.guestName ?? ''),
            caption: String(d.caption ?? ''),
            imageData: String(d.imageData ?? ''),
            width: Number(d.width ?? 800),
            height: Number(d.height ?? 600),
            visible: Boolean(d.visible ?? true),
            createdAt: d.createdAt ?? null,
          };
        });
        setAllPhotos(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'wedding_photos');
      }
    );

    const unsubConfig = onSnapshot(
      doc(db, 'wedding_settings', 'main'),
      (docSnap) => {
        if (docSnap.exists()) {
          const merged = mergeWeddingConfig(docSnap.data());
          setGooglePhotosUrl(merged.googlePhotosUrl);
          setAppsScriptUrl(merged.appsScriptUrl);
          setWelcomeNote(merged.welcomeNote);
          setIntervalSec(merged.fotoPartyIntervalSec);
          setAlbumEnabledEarly(merged.albumEnabledEarly);
          setTablesVisibleToGuests(Boolean(merged.tablesVisibleToGuests));
          setTotalTables(merged.totalTables);
          if (merged.heroPhotoUrl) {
            setHeroPhotoUrl(merged.heroPhotoUrl);
          }
          if (merged.adminPhone) {
            setAdminPhone(merged.adminPhone);
          }
          if (merged.groomPhone) {
            setGroomPhone(merged.groomPhone);
          }
          setBudgetAdultPlates(merged.budgetAdultPlates ?? 0);
          setBudgetKidPlates(merged.budgetKidPlates ?? 0);

          setWeddingDateISO(
            merged.weddingDateISO ??
              DEFAULT_WEDDING_CONFIG.weddingDateISO ??
              '2027-07-10'
          );
          setCeremonyTime(
            merged.ceremonyTime ?? DEFAULT_WEDDING_CONFIG.ceremonyTime ?? '16:00'
          );
          setCeremonyVenue(
            merged.ceremonyVenue ?? DEFAULT_WEDDING_CONFIG.ceremonyVenue ?? ''
          );
          setCeremonyAddress(
            merged.ceremonyAddress ??
              DEFAULT_WEDDING_CONFIG.ceremonyAddress ??
              ''
          );
          setCeremonyMapUrl(merged.ceremonyMapUrl ?? '');
          setReceptionTime(
            merged.receptionTime ??
              DEFAULT_WEDDING_CONFIG.receptionTime ??
              '19:00'
          );
          setReceptionVenue(
            merged.receptionVenue ?? DEFAULT_WEDDING_CONFIG.receptionVenue ?? ''
          );
          setReceptionAddress(
            merged.receptionAddress ??
              DEFAULT_WEDDING_CONFIG.receptionAddress ??
              ''
          );
          setReceptionMapUrl(merged.receptionMapUrl ?? '');
          setBrideParents(
            merged.brideParents ?? DEFAULT_WEDDING_CONFIG.brideParents ?? ''
          );
          setGroomParents(
            merged.groomParents ?? DEFAULT_WEDDING_CONFIG.groomParents ?? ''
          );
          setGodparentsList(merged.godparentsList ?? DEFAULT_GODPARENTS_LIST);
          setGiftEnvelopeNote(
            merged.giftEnvelopeNote ??
              DEFAULT_WEDDING_CONFIG.giftEnvelopeNote ??
              ''
          );
          setGiftBankName(
            merged.giftBankName ?? DEFAULT_WEDDING_CONFIG.giftBankName ?? ''
          );
          setGiftAccountHolder(
            merged.giftAccountHolder ??
              DEFAULT_WEDDING_CONFIG.giftAccountHolder ??
              ''
          );
          setGiftAccountType(
            merged.giftAccountType ??
              DEFAULT_WEDDING_CONFIG.giftAccountType ??
              ''
          );
          setGiftAccountNumber(
            merged.giftAccountNumber ??
              DEFAULT_WEDDING_CONFIG.giftAccountNumber ??
              ''
          );
          setGiftQrValue(merged.giftQrValue ?? '');
          setGiftQrImage(merged.giftQrImage ?? '');
          setHideDefaultHeroPhotos(Boolean(merged.hideDefaultHeroPhotos));
          setCustomAudioMode(merged.customAudioMode ?? 'synth');
          setCustomAudioUrl(merged.customAudioUrl ?? '');
          setCustomAudioTitle(
            merged.customAudioTitle || DEFAULT_INTEGRATED_AUDIO_TITLE
          );
          setCustomAudioMime(merged.customAudioMime ?? 'audio/mpeg');
          setCustomAudioChunkCount(merged.customAudioChunkCount ?? 0);
          setCustomAudioUpdatedToken(merged.customAudioUpdatedToken ?? '');
          setCustomAudioDurationSec(merged.customAudioDurationSec ?? 0);
          saveStoredWeddingConfig(merged);
        }
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.GET,
          'wedding_settings/main'
        );
      }
    );

    const unsubHeroPhotos = onSnapshot(
      collection(db, 'wedding_hero_photos'),
      (snapshot) => {
        const list: HeroPhotoRecord[] = snapshot.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              imageData: String(d.imageData ?? ''),
              caption: String(d.caption ?? ''),
              sortOrder: Number(d.sortOrder ?? 0),
              active: Boolean(d.active ?? true),
              createdAt: d.createdAt ?? null,
            };
          })
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setHeroPhotosList(list);
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          'wedding_hero_photos'
        );
      }
    );

    return () => {
      unsubRsvps();
      unsubQuotas();
      unsubPhotos();
      unsubConfig();
      unsubHeroPhotos();
    };
  }, [authReady, isVerifiedCoupleAdmin]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setVerificationSent(false);

    const resolvedEmail = resolveLoginIdentifier(identifier);
    if (!isAuthorizedCoupleEmail(resolvedEmail)) {
      setUnauthorizedAttemptEmail(resolvedEmail);
      return;
    }

    if (!password) {
      setAuthError('Ingresa tu contraseña para continuar.');
      return;
    }

    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, resolvedEmail, password);
      setPassword('');
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: string }).code)
          : '';
      if (code === 'auth/operation-not-allowed') {
        setAuthError(
          'El inicio con Correo/Contraseña aún debe activarse en Firebase Console (Authentication > Sign-in method > Email/Password).'
        );
      } else if (
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password'
      ) {
        setAuthError(
          'Credenciales inválidas o usuario aún no registrado. Verifica tu usuario y contraseña.'
        );
      } else {
        setAuthError(
          'No se pudo iniciar sesión. Verifica tus credenciales e intenta nuevamente.'
        );
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const syncAdminTokenAndDoc = async (
    user: User,
    forceTokenRefresh = false
  ): Promise<void> => {
    if (!user || !user.email) return;
    const emailLower = user.email.toLowerCase();
    if (
      emailLower !== 'ing.hectorrodas@gmail.com' &&
      emailLower !== 'jorgerodad@gmail.com'
    ) {
      return;
    }
    try {
      if (forceTokenRefresh) {
        await user.getIdToken(true);
      }
      const adminDocRef = doc(db, 'admins', user.uid);
      const existingSnap = await getDoc(adminDocRef);
      if (!existingSnap.exists()) {
        const isNovio = emailLower === 'jorgerodad@gmail.com';
        await setDoc(adminDocRef, {
          email: emailLower,
          role: isNovio ? 'novio' : 'admin',
          label: isNovio ? 'Jorge Luis (Novio)' : 'Ing. Héctor Rodas (Admin)',
          createdAt: serverTimestamp(),
        }, { merge: true });
      }
    } catch (syncErr) {
      console.warn('Admin doc sync check:', syncErr);
    }
  };

  const handleAdminGoogleLogin = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const cred = await signInWithPopup(auth, adminGoogleProvider);
      if (!isAuthorizedCoupleEmail(cred.user.email)) {
        await signOut(auth);
        setUnauthorizedAttemptEmail(cred.user.email);
        return;
      }
      await syncAdminTokenAndDoc(cred.user, true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(`No se pudo iniciar sesión con Google: ${msg}`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRefreshAdminToken = async () => {
    if (!currentUser) return;
    setRefreshingPermissions(true);
    setPermissionsRefreshedMsg('');
    try {
      await currentUser.getIdToken(true);
      await syncAdminTokenAndDoc(currentUser, true);
      setCurrentUser(auth.currentUser ? { ...auth.currentUser } : null);
      setPermissionsRefreshedMsg('Permisos Firestore verificados');
      window.setTimeout(() => setPermissionsRefreshedMsg(''), 3500);
    } catch (err) {
      console.warn('Error refrescando permisos:', err);
    } finally {
      setRefreshingPermissions(false);
    }
  };

  const handleSendVerification = async () => {
    if (!currentUser) return;
    try {
      await sendEmailVerification(currentUser);
      setVerificationSent(true);
    } catch {
      setAuthError(
        'No se pudo enviar el correo de verificación en este momento.'
      );
    }
  };

  const handleReloadUser = async () => {
    if (!currentUser) return;
    await currentUser.reload();
    await currentUser.getIdToken(true);
    setCurrentUser(auth.currentUser ? { ...auth.currentUser } : null);
    window.location.reload();
  };

  const handleLogout = async () => {
    if (adminPreviewAudioRef.current) {
      adminPreviewAudioRef.current.pause();
      setIsAdminPreviewPlaying(false);
    }
    clearDriveAccessToken();
    setDriveToken(null);
    setDriveEmail(null);
    setUnauthorizedAttemptEmail(null);
    await signOut(auth);
    setIdentifier('');
    setPassword('');
    setAuthError('');
  };

  const refreshDriveSyncedFiles = async (
    tokenOverride?: string,
    folderOverride?: string | null
  ) => {
    const token = tokenOverride || driveToken || getDriveAccessToken();
    const folder = folderOverride ?? driveFolderId;
    if (!token || !folder) return;

    try {
      const files = await listDriveFolderFiles(folder, token);
      const synced = new Set<string>();
      for (const photo of allPhotos) {
        if (files.some((f) => f.name.includes(photo.id))) {
          synced.add(photo.id);
        }
      }
      setDriveSyncedIds(synced);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('401')) {
        setDriveToken(null);
        setDriveError(
          'Tu sesión de Google Drive expiró; vuelve a conectarte con Google.'
        );
      }
    }
  };

  useEffect(() => {
    if (driveToken && driveFolderId && allPhotos.length > 0) {
      void refreshDriveSyncedFiles(driveToken, driveFolderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveToken, driveFolderId, allPhotos.length]);

  const handleConnectDrive = async () => {
    setDriveError('');
    setDriveStatusMsg('');
    setIsConnectingDrive(true);
    try {
      const { user, accessToken } = await googleDriveSignIn();
      setDriveToken(accessToken);
      setDriveEmail(user.email);
      await refreshDriveSyncedFiles(accessToken, driveFolderId);
    } catch {
      setDriveError(
        'No se completó la conexión con Google Drive. Intenta nuevamente.'
      );
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleUploadSinglePhotoToDrive = async (photo: WeddingPhotoRecord) => {
    const token = driveToken || getDriveAccessToken();
    if (!token || !driveFolderId) return;

    setDriveError('');
    setDriveStatusMsg('');
    setIsSyncingDrive(true);
    setDriveSyncProgress(`Subiendo foto de ${photo.guestName}...`);

    try {
      const blob = dataUrlToBlob(photo.imageData);
      await uploadBlobToGoogleDriveFolder({
        folderId: driveFolderId,
        accessToken: token,
        fileName: buildDrivePhotoFilename(photo),
        blob,
        description: photo.caption
          ? `Compartida por ${photo.guestName}: ${photo.caption}`
          : `Compartida por ${photo.guestName}`,
      });
      setDriveSyncedIds((prev) => new Set(prev).add(photo.id));
      setDriveStatusMsg(
        `Fotografía de ${photo.guestName} archivada en Google Drive.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('401')) {
        setDriveToken(null);
        setDriveError('Tu sesión expiró; vuelve a conectar Google Drive.');
      } else {
        setDriveError(
          'No se pudo subir a la carpeta de Google Drive. Verifica que tu cuenta tenga permiso de edición en la carpeta.'
        );
      }
    } finally {
      setIsSyncingDrive(false);
      setDriveSyncProgress('');
    }
  };

  const pendingDrivePhotos = useMemo(
    () => allPhotos.filter((p) => !driveSyncedIds.has(p.id)),
    [allPhotos, driveSyncedIds]
  );

  const handleSyncAllPendingToDrive = async () => {
    setConfirmDriveModalOpen(false);
    const token = driveToken || getDriveAccessToken();
    if (!token || !driveFolderId || pendingDrivePhotos.length === 0) return;

    setDriveError('');
    setDriveStatusMsg('');
    setIsSyncingDrive(true);
    let uploadedCount = 0;

    try {
      for (let i = 0; i < pendingDrivePhotos.length; i++) {
        const photo = pendingDrivePhotos[i];
        setDriveSyncProgress(
          `Subiendo ${i + 1} de ${pendingDrivePhotos.length}...`
        );
        const blob = dataUrlToBlob(photo.imageData);
        await uploadBlobToGoogleDriveFolder({
          folderId: driveFolderId,
          accessToken: token,
          fileName: buildDrivePhotoFilename(photo),
          blob,
          description: photo.caption
            ? `Compartida por ${photo.guestName}: ${photo.caption}`
            : `Compartida por ${photo.guestName}`,
        });
        uploadedCount += 1;
        setDriveSyncedIds((prev) => new Set(prev).add(photo.id));
      }

      setDriveStatusMsg(
        `¡Listo! Se archivaron ${uploadedCount} fotografía(s) en tu carpeta de Google Drive.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('401')) {
        setDriveToken(null);
        setDriveError('Tu sesión expiró; vuelve a conectar Google Drive.');
      } else {
        setDriveError(
          `Se subieron ${uploadedCount} foto(s), pero ocurrió un error de permisos o conexión con Google Drive.`
        );
      }
    } finally {
      setIsSyncingDrive(false);
      setDriveSyncProgress('');
    }
  };

  // Auto-sync pending photos to Google Drive every 10 minutes when Drive is connected
  useEffect(() => {
    if (!driveToken || !driveFolderId) return;

    const intervalId = window.setInterval(() => {
      if (!isSyncingDrive && pendingDrivePhotos.length > 0) {
        void handleSyncAllPendingToDrive();
      }
    }, 10 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [driveToken, driveFolderId, isSyncingDrive, pendingDrivePhotos.length]);

  const stats = useMemo(() => {
    const confirmed = rsvps.filter((r) => r.attending);
    const declined = rsvps.filter((r) => !r.attending);
    const totalAdults = confirmed.reduce((s, r) => s + r.adults, 0);
    const totalKids = confirmed.reduce((s, r) => s + r.kids, 0);
    const totalBabies = confirmed.reduce((s, r) => s + r.babies, 0);
    return {
      totalInvitations: rsvps.length,
      confirmedCount: confirmed.length,
      declinedCount: declined.length,
      totalSeated: totalAdults + totalKids,
      totalAdults,
      totalKids,
      totalBabies,
    };
  }, [rsvps]);

  const filteredRsvps = useMemo(() => {
    const q = normalizeText(rsvpSearch);
    return rsvps.filter((r) => {
      if (rsvpFilter === 'yes' && !r.attending) return false;
      if (rsvpFilter === 'no' && r.attending) return false;
      if (!q) return true;
      return (
        normalizeText(r.guestName).includes(q) ||
        String(r.tableNumber).includes(q) ||
        normalizeText(r.phone).includes(q) ||
        normalizeText(r.notes).includes(q) ||
        normalizeText(getGuestRelationLabel(r.guestGroup)).includes(q)
      );
    });
  }, [rsvps, rsvpFilter, rsvpSearch]);

  const handleGuestGroupChange = async (
    rsvp: RsvpRecord,
    newGroup: GuestRelationGroup | ''
  ) => {
    try {
      await updateDoc(doc(db, 'rsvps', rsvp.id), { guestGroup: newGroup });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rsvps/${rsvp.id}`);
    }
  };

  const handleTableReassign = async (rsvp: RsvpRecord, newTable: number) => {
    if (!rsvp.attending || newTable < 1 || newTable > 100) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'rsvps', rsvp.id), { tableNumber: newTable });
      batch.update(doc(db, 'seating_entries', rsvp.id), {
        tableNumber: newTable,
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rsvps/${rsvp.id}`);
    }
  };

  const quotaStats = useMemo(() => {
    const confirmedCount = guestQuotas.filter((q) => q.confirmed).length;
    const assignedAdultPlates = guestQuotas.reduce(
      (s, q) => s + q.maxAdults,
      0
    );
    const assignedKidPlates = guestQuotas.reduce((s, q) => s + q.maxKids, 0);
    const assignedBabies = guestQuotas.reduce((s, q) => s + q.maxBabies, 0);
    return {
      totalFamilies: guestQuotas.length,
      confirmedFamilies: confirmedCount,
      pendingFamilies: guestQuotas.length - confirmedCount,
      assignedAdultPlates,
      assignedKidPlates,
      assignedChairs: assignedAdultPlates + assignedKidPlates,
      assignedBabies,
    };
  }, [guestQuotas]);

  const adminTablesSummary = useMemo(() => {
    const tableMap = new Map<
      number,
      { tableNumber: number; occupied: number; capacity: number }
    >();
    for (let i = 1; i <= totalTables; i++) {
      tableMap.set(i, {
        tableNumber: i,
        occupied: 0,
        capacity: TABLE_CAPACITY,
      });
    }
    for (const q of guestQuotas) {
      if (q.assignedTable > 0) {
        const t = tableMap.get(q.assignedTable) || {
          tableNumber: q.assignedTable,
          occupied: 0,
          capacity: TABLE_CAPACITY,
        };
        t.occupied += q.maxAdults + q.maxKids;
        tableMap.set(q.assignedTable, t);
      }
    }
    return Array.from(tableMap.values());
  }, [guestQuotas, totalTables]);

  const filteredQuotas = useMemo(() => {
    const q = normalizeText(quotaSearch);
    return guestQuotas.filter((item) => {
      if (quotaStatusFilter === 'pending' && item.confirmed) return false;
      if (quotaStatusFilter === 'confirmed' && !item.confirmed) return false;
      if (!q) return true;
      return (
        normalizeText(item.guestName).includes(q) ||
        normalizeText(item.phoneDisplay).includes(q) ||
        item.phoneKey.includes(q) ||
        normalizeText(getGuestRelationLabel(item.guestGroup)).includes(q)
      );
    });
  }, [guestQuotas, quotaSearch, quotaStatusFilter]);

  const resetQuotaForm = () => {
    setEditingPhoneKey(null);
    setQuotaGuestName('');
    setQuotaPhone('');
    setQuotaMaxAdults(2);
    setQuotaMaxKids(0);
    setQuotaMaxBabies(0);
    setQuotaAssignedTable(0);
    setAssignmentMode('auto_novio');
    setQuotaGuestGroup('familiar_novio');
    setQuotaNotes('');
    setQuotaFormError('');
  };

  const handleEditQuota = (item: GuestQuotaRecord) => {
    setEditingPhoneKey(item.phoneKey);
    setQuotaGuestName(item.guestName);
    setQuotaPhone(item.phoneDisplay || item.phoneKey);
    setQuotaMaxAdults(item.maxAdults);
    setQuotaMaxKids(item.maxKids);
    setQuotaMaxBabies(item.maxBabies);
    setQuotaAssignedTable(item.assignedTable);
    if (item.assignedTable > 0) {
      setAssignmentMode('manual');
    } else {
      setAssignmentMode(
        item.guestGroup === 'familiar_novia' || item.guestGroup === 'amigo_novia'
          ? 'auto_novia'
          : 'auto_novio'
      );
    }
    setQuotaGuestGroup(item.guestGroup);
    setQuotaNotes(item.notes);
    setQuotaFormError('');
    setQuotaFormSuccess('');
  };

  const handleSaveQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuotaFormError('');
    setQuotaFormSuccess('');

    const cleanName = quotaGuestName.trim().slice(0, 120);
    if (cleanName.length < 2) {
      setQuotaFormError('Ingresa el nombre o apellido de la familia/invitado.');
      return;
    }

    const phoneKey = normalizePhoneKey(quotaPhone);
    if (!isValidPhoneKey(phoneKey)) {
      setQuotaFormError(
        'Ingresa un número telefónico válido (al menos 8 dígitos).'
      );
      return;
    }

    const cleanDisplay = quotaPhone.trim().slice(0, 30) || phoneKey;
    const safeAdults = Math.min(10, Math.max(1, Number(quotaMaxAdults) || 1));
    const safeKids = Math.min(8, Math.max(0, Number(quotaMaxKids) || 0));
    const safeBabies = Math.min(5, Math.max(0, Number(quotaMaxBabies) || 0));
    const safeTable =
      assignmentMode === 'manual'
        ? Math.min(100, Math.max(1, Number(quotaAssignedTable) || 1))
        : 0;
    const cleanNotes = quotaNotes.trim().slice(0, 300);

    setSavingQuota(true);
    try {
      if (editingPhoneKey) {
        const existing = guestQuotas.find(
          (g) => g.phoneKey === editingPhoneKey
        );
        if (editingPhoneKey !== phoneKey) {
          const batch = writeBatch(db);
          batch.set(doc(db, 'guest_quotas', phoneKey), {
            phoneKey,
            phoneDisplay: cleanDisplay,
            guestName: cleanName,
            maxAdults: safeAdults,
            maxKids: safeKids,
            maxBabies: safeBabies,
            assignedTable: safeTable,
            guestGroup: quotaGuestGroup,
            notes: cleanNotes,
            confirmed: existing?.confirmed ?? false,
            rsvpId: existing?.rsvpId ?? '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batch.delete(doc(db, 'guest_quotas', editingPhoneKey));
          await batch.commit();
        } else {
          await updateDoc(doc(db, 'guest_quotas', editingPhoneKey), {
            phoneDisplay: cleanDisplay,
            guestName: cleanName,
            maxAdults: safeAdults,
            maxKids: safeKids,
            maxBabies: safeBabies,
            assignedTable: safeTable,
            guestGroup: quotaGuestGroup,
            notes: cleanNotes,
            updatedAt: serverTimestamp(),
          });
        }
        setQuotaFormSuccess(`Cupo actualizado para ${cleanName}.`);
      } else {
        const existingSamePhone = guestQuotas.find(
          (g) => g.phoneKey === phoneKey
        );
        if (existingSamePhone) {
          await updateDoc(doc(db, 'guest_quotas', phoneKey), {
            phoneDisplay: cleanDisplay,
            guestName: cleanName,
            maxAdults: safeAdults,
            maxKids: safeKids,
            maxBabies: safeBabies,
            assignedTable: safeTable,
            guestGroup: quotaGuestGroup,
            notes: cleanNotes,
            updatedAt: serverTimestamp(),
          });
          setQuotaFormSuccess(
            `Cupo actualizado para ${cleanName} (${safeAdults + safeKids} sillas: ${safeAdults} adulto, ${safeKids} niño).`
          );
        } else {
          await setDoc(doc(db, 'guest_quotas', phoneKey), {
            phoneKey,
            phoneDisplay: cleanDisplay,
            guestName: cleanName,
            maxAdults: safeAdults,
            maxKids: safeKids,
            maxBabies: safeBabies,
            assignedTable: safeTable,
            guestGroup: quotaGuestGroup,
            notes: cleanNotes,
            confirmed: false,
            rsvpId: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setQuotaFormSuccess(
            `${cleanName} registrado con ${safeAdults + safeKids} silla(s) (${safeAdults} adulto, ${safeKids} niño).`
          );
        }
      }
      resetQuotaForm();
      window.setTimeout(() => setQuotaFormSuccess(''), 4500);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `guest_quotas/${phoneKey}`
      );
    } finally {
      setSavingQuota(false);
    }
  };

  const handleReopenQuota = async (item: GuestQuotaRecord) => {
    try {
      await updateDoc(doc(db, 'guest_quotas', item.phoneKey), {
        confirmed: false,
        rsvpId: '',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `guest_quotas/${item.phoneKey}`
      );
    }
  };

  const handleDeleteQuota = async (phoneKey: string) => {
    try {
      await deleteDoc(doc(db, 'guest_quotas', phoneKey));
      if (editingPhoneKey === phoneKey) {
        resetQuotaForm();
      }
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `guest_quotas/${phoneKey}`
      );
    }
  };

  const handleBulkImportSubmit = async () => {
    setBulkImportMessage('');
    const lines = bulkImportText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setBulkImportMessage(
        'Pega al menos una línea o carga un archivo CSV antes de importar.'
      );
      return;
    }

    const parsedRecords: Array<{
      phoneKey: string;
      phoneDisplay: string;
      guestName: string;
      maxAdults: number;
      maxKids: number;
      maxBabies: number;
      assignedTable: number;
      guestGroup: GuestRelationGroup | '';
      notes: string;
    }> = [];
    let skipped = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const sep = line.includes('\t')
        ? '\t'
        : line.includes(';')
          ? ';'
          : ',';
      const cols = line.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
      if (cols.length < 2) {
        skipped++;
        continue;
      }

      // Skip header row automatically
      if (
        i === 0 &&
        (normalizeText(cols[0]).includes('nombre') ||
          normalizeText(cols[1]).includes('tel'))
      ) {
        continue;
      }

      const guestName = cols[0].slice(0, 120);
      const phoneDisplay = cols[1].slice(0, 30);
      const phoneKey = normalizePhoneKey(phoneDisplay);
      if (guestName.length < 2 || !isValidPhoneKey(phoneKey)) {
        skipped++;
        continue;
      }

      const maxAdults = Math.min(10, Math.max(1, Number(cols[2]) || 1));
      const maxKids = Math.min(8, Math.max(0, Number(cols[3]) || 0));
      const maxBabies = Math.min(5, Math.max(0, Number(cols[4]) || 0));
      const guestGroup = parseRelationGroupInput(cols[5] ?? '');
      const assignedTable = Math.min(100, Math.max(0, Number(cols[6]) || 0));
      const notes = (cols[7] ?? '').slice(0, 300);

      parsedRecords.push({
        phoneKey,
        phoneDisplay,
        guestName,
        maxAdults,
        maxKids,
        maxBabies,
        assignedTable,
        guestGroup,
        notes,
      });
    }

    if (parsedRecords.length === 0) {
      setBulkImportMessage(
        'No se encontraron filas válidas. Verifica el formato: Nombre, Teléfono, Adultos, Niños, Bebés, Vínculo, Mesa.'
      );
      return;
    }

    setIsImportingBulk(true);
    try {
      const existingKeys = new Set(guestQuotas.map((g) => g.phoneKey));
      for (let start = 0; start < parsedRecords.length; start += 400) {
        const chunk = parsedRecords.slice(start, start + 400);
        const batch = writeBatch(db);
        for (const rec of chunk) {
          const ref = doc(db, 'guest_quotas', rec.phoneKey);
          if (existingKeys.has(rec.phoneKey)) {
            batch.update(ref, {
              phoneDisplay: rec.phoneDisplay,
              guestName: rec.guestName,
              maxAdults: rec.maxAdults,
              maxKids: rec.maxKids,
              maxBabies: rec.maxBabies,
              assignedTable: rec.assignedTable,
              guestGroup: rec.guestGroup,
              notes: rec.notes,
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.set(ref, {
              ...rec,
              confirmed: false,
              rsvpId: '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
        await batch.commit();
      }

      setBulkImportMessage(
        `¡Importación completada! Se registraron ${parsedRecords.length} invitado(s)${
          skipped > 0 ? ` (${skipped} fila(s) omitida(s) por datos incompletos)` : ''
        }.`
      );
      setBulkImportText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'guest_quotas');
    } finally {
      setIsImportingBulk(false);
    }
  };

  const handleBulkCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBulkImportText(reader.result);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDeleteRsvp = async (rsvp: RsvpRecord) => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'rsvps', rsvp.id));
      if (rsvp.attending) {
        batch.delete(doc(db, 'seating_entries', rsvp.id));
      }
      const linkedPhoneKey =
        rsvp.phoneKey ||
        (rsvp.phone ? normalizePhoneKey(rsvp.phone) : '');
      const existingQuota = guestQuotas.find(
        (q) => q.phoneKey === linkedPhoneKey || q.rsvpId === rsvp.id
      );
      if (existingQuota) {
        batch.update(doc(db, 'guest_quotas', existingQuota.phoneKey), {
          confirmed: false,
          rsvpId: '',
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `rsvps/${rsvp.id}`);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Nombre / Familia',
      'Grupo / Vinculo',
      'Estado',
      'Adultos',
      'Ninos',
      'Bebes',
      'Total Asientos',
      'Mesa Asignada',
      'Telefono',
      'Notas / Alergias',
      'Fecha Registro',
    ];

    const rows = rsvps.map((r) => {
      return [
        escapeCsvCell(r.guestName),
        escapeCsvCell(getGuestRelationLabel(r.guestGroup)),
        escapeCsvCell(r.attending ? 'Confirmado' : 'No asiste'),
        escapeCsvCell(r.attending ? r.adults : 0),
        escapeCsvCell(r.attending ? r.kids : 0),
        escapeCsvCell(r.attending ? r.babies : 0),
        escapeCsvCell(r.attending ? r.adults + r.kids : 0),
        escapeCsvCell(r.attending ? `Mesa ${r.tableNumber}` : 'Sin mesa'),
        escapeCsvCell(r.phone),
        escapeCsvCell(r.notes),
        escapeCsvCell(formatRsvpDate(r.createdAt)),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      'Reporte_Invitados_Jessica_y_Jorge_Luis.csv'
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleTogglePhotoVisibility = async (photo: WeddingPhotoRecord) => {
    try {
      await updateDoc(doc(db, 'wedding_photos', photo.id), {
        visible: !photo.visible,
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `wedding_photos/${photo.id}`
      );
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await deleteDoc(doc(db, 'wedding_photos', photoId));
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `wedding_photos/${photoId}`
      );
    }
  };

  const handleDownloadSinglePhoto = (
    photo: WeddingPhotoRecord,
    index: number
  ) => {
    const link = document.createElement('a');
    link.href = photo.imageData;
    const safeGuest =
      photo.guestName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) ||
      'invitado';
    link.download = `Boda_JJ_${index + 1}_${safeGuest}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllPhotosZip = async () => {
    if (allPhotos.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('Fotos_Boda_Jessica_y_Jorge_Luis');
      allPhotos.forEach((photo, idx) => {
        const base64 = photo.imageData.split(',')[1];
        if (!base64 || !folder) return;
        const safeGuest =
          photo.guestName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) ||
          'invitado';
        folder.file(
          `Foto_${String(idx + 1).padStart(3, '0')}_${safeGuest}.jpg`,
          base64,
          { base64: true }
        );
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Fotos_Boda_Jessica_y_Jorge_Luis.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsZipping(false);
    }
  };

  const buildPersistedSettingsPayload = (
    overrides?: Partial<{
      hideDefaultHeroPhotos: boolean;
      customAudioMode: CustomAudioMode;
      customAudioUrl: string;
      customAudioTitle: string;
      customAudioMime: string;
      customAudioChunkCount: number;
      customAudioUpdatedToken: string;
      customAudioDurationSec: number;
    }>
  ) => {
    const trimmedUrl = googlePhotosUrl.trim().slice(0, 500);
    const trimmedScriptUrl = appsScriptUrl.trim().slice(0, 500);
    const safeCeremonyTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(ceremonyTime)
      ? ceremonyTime
      : '16:00';
    const safeReceptionTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(receptionTime)
      ? receptionTime
      : '19:00';
    const safeDateISO = /^20[2-9]\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(
      weddingDateISO
    )
      ? weddingDateISO
      : '2027-07-10';
    const cleanGodparents = godparentsList
      .map((item) => ({
        roleName: item.roleName.trim().slice(0, 100),
        names: item.names.trim().slice(0, 160),
      }))
      .filter((item) => item.roleName.length > 0 && item.names.length > 0)
      .slice(0, 12);

    const resolvedAudioMode = overrides?.customAudioMode ?? customAudioMode;
    const resolvedAudioUrl = (overrides?.customAudioUrl ?? customAudioUrl)
      .trim()
      .slice(0, 500);
    const resolvedAudioTitle =
      (overrides?.customAudioTitle ?? customAudioTitle).trim().slice(0, 120) ||
      DEFAULT_INTEGRATED_AUDIO_TITLE;
    const resolvedAudioMime =
      (overrides?.customAudioMime ?? customAudioMime).trim().slice(0, 80) ||
      'audio/mpeg';
    const resolvedAudioChunkCount = Math.min(
      25,
      Math.max(
        0,
        Number(overrides?.customAudioChunkCount ?? customAudioChunkCount) || 0
      )
    );
    const resolvedAudioToken = (
      overrides?.customAudioUpdatedToken ?? customAudioUpdatedToken
    )
      .trim()
      .slice(0, 64);
    const resolvedAudioDuration = Math.min(
      3600,
      Math.max(
        0,
        Math.round(
          Number(overrides?.customAudioDurationSec ?? customAudioDurationSec) || 0
        )
      )
    );

    const sanitizeUrl = (url: string) => {
      const trimmed = url.trim().slice(0, 500);
      if (!trimmed) return '';
      if (/^https?:\/\//i.test(trimmed)) {
        return trimmed.replace(/^https?:\/\//i, (m) => m.toLowerCase());
      }
      return `https://${trimmed}`;
    };

    const sanitizeExternalAudioUrl = (url: string) => {
      const trimmed = url.trim().slice(0, 500);
      if (
        !trimmed ||
        trimmed.startsWith('/assets/') ||
        trimmed.startsWith('https:///') ||
        trimmed.startsWith('http:///')
      ) {
        return '';
      }
      if (/^https?:\/\/[^/]/i.test(trimmed)) {
        return trimmed.replace(/^https?:\/\//i, (m) => m.toLowerCase());
      }
      return '';
    };

    return {
      googlePhotosUrl: sanitizeUrl(googlePhotosUrl),
      appsScriptUrl: trimmedScriptUrl,
      welcomeNote:
        welcomeNote.trim().slice(0, 300) || DEFAULT_WEDDING_CONFIG.welcomeNote,
      fotoPartyIntervalSec: Math.min(30, Math.max(3, Number(intervalSec) || 6)),
      albumEnabledEarly,
      tablesVisibleToGuests,
      totalTables: Math.min(50, Math.max(1, Number(totalTables) || 10)),
      heroPhotoUrl:
        sanitizeUrl(heroPhotoUrl) ||
        (DEFAULT_WEDDING_CONFIG.heroPhotoUrl ?? ''),
      adminPhone:
        adminPhone.trim().slice(0, 30) ||
        (DEFAULT_WEDDING_CONFIG.adminPhone ?? '+503 76874760'),
      groomPhone:
        groomPhone.trim().slice(0, 30) ||
        (DEFAULT_WEDDING_CONFIG.groomPhone ?? '+503 78249210'),
      budgetAdultPlates: Math.min(
        1000,
        Math.max(0, Number(budgetAdultPlates) || 0)
      ),
      budgetKidPlates: Math.min(500, Math.max(0, Number(budgetKidPlates) || 0)),
      weddingDateISO: safeDateISO,
      ceremonyTime: safeCeremonyTime,
      ceremonyVenue:
        ceremonyVenue.trim().slice(0, 120) ||
        (DEFAULT_WEDDING_CONFIG.ceremonyVenue ?? 'Parroquia Principal'),
      ceremonyAddress: ceremonyAddress.trim().slice(0, 200),
      ceremonyMapUrl: sanitizeUrl(ceremonyMapUrl),
      receptionTime: safeReceptionTime,
      receptionVenue:
        receptionVenue.trim().slice(0, 120) ||
        (DEFAULT_WEDDING_CONFIG.receptionVenue ?? 'Salón de Eventos Elegance'),
      receptionAddress: receptionAddress.trim().slice(0, 200),
      receptionMapUrl: sanitizeUrl(receptionMapUrl),
      brideParents:
        brideParents.trim().slice(0, 160) ||
        (DEFAULT_WEDDING_CONFIG.brideParents ?? ''),
      groomParents:
        groomParents.trim().slice(0, 160) ||
        (DEFAULT_WEDDING_CONFIG.groomParents ?? ''),
      godparentsList: cleanGodparents,
      giftEnvelopeNote:
        giftEnvelopeNote.trim().slice(0, 300) ||
        (DEFAULT_WEDDING_CONFIG.giftEnvelopeNote ?? ''),
      giftBankName:
        giftBankName.trim().slice(0, 80) ||
        (DEFAULT_WEDDING_CONFIG.giftBankName ?? ''),
      giftAccountHolder:
        giftAccountHolder.trim().slice(0, 120) ||
        (DEFAULT_WEDDING_CONFIG.giftAccountHolder ?? ''),
      giftAccountType: giftAccountType.trim().slice(0, 60),
      giftAccountNumber:
        giftAccountNumber.trim().slice(0, 60) ||
        (DEFAULT_WEDDING_CONFIG.giftAccountNumber ?? ''),
      giftQrValue: giftQrValue.trim().slice(0, 500),
      giftQrImage: giftQrImage.trim(),
      hideDefaultHeroPhotos:
        overrides?.hideDefaultHeroPhotos ?? hideDefaultHeroPhotos,
      customAudioMode: resolvedAudioMode,
      customAudioUrl: sanitizeExternalAudioUrl(resolvedAudioUrl),
      customAudioTitle: resolvedAudioTitle,
      customAudioMime: resolvedAudioMime,
      customAudioChunkCount: resolvedAudioChunkCount,
      customAudioUpdatedToken: resolvedAudioToken,
      customAudioDurationSec: resolvedAudioDuration,
      updatedAt: serverTimestamp(),
    };
  };

  const syncLocalConfigFromPayload = (
    payload: ReturnType<typeof buildPersistedSettingsPayload>
  ) => {
    const { updatedAt: _ignored, ...rest } = payload;
    saveStoredWeddingConfig(rest as Partial<WeddingConfigRecord>);
  };

  const isPermissionDeniedError = (err: unknown): boolean => {
    if (!err) return false;
    const msg = err instanceof Error ? err.message : String(err);
    return (
      msg.includes('permission-denied') ||
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('Missing or insufficient permissions')
    );
  };

  const formatFirestoreSaveError = (err: unknown, user: User | null): string => {
    const msg = err instanceof Error ? err.message : String(err);
    if (isPermissionDeniedError(err)) {
      const email = user?.email ?? 'sin sesión';
      return `Permiso denegado por reglas de Firestore para ${email}. Verifica que el correo esté verificado o haz clic en "Refrescar permisos" en la barra superior.`;
    }
    if (msg.includes('offline') || msg.includes('unavailable')) {
      return 'Sin conexión con Firestore. Revisa tu conexión a Internet.';
    }
    return `Error al guardar: ${msg.slice(0, 180)}`;
  };

  const executeAdminFirestoreWrite = async (
    writeFn: () => Promise<void>
  ): Promise<void> => {
    try {
      await writeFn();
    } catch (firstErr) {
      if (isPermissionDeniedError(firstErr) && auth.currentUser) {
        try {
          await syncAdminTokenAndDoc(auth.currentUser, true);
          await writeFn();
          return;
        } catch (retryErr) {
          throw retryErr;
        }
      }
      throw firstErr;
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsSaved(false);

    const trimmedUrl = googlePhotosUrl.trim().slice(0, 500);
    if (trimmedUrl && !trimmedUrl.startsWith('https://')) {
      setSettingsError(
        'El enlace de Google Fotos o Google Drive debe comenzar con https://'
      );
      return;
    }

    const trimmedScriptUrl = appsScriptUrl.trim().slice(0, 500);
    if (trimmedScriptUrl && !isValidAppsScriptUrl(trimmedScriptUrl)) {
      setSettingsError(
        'El endpoint de Google Apps Script debe comenzar con https://script.google.com/'
      );
      return;
    }

    setSavingSettings(true);
    try {
      const nextPayload = buildPersistedSettingsPayload();
      await executeAdminFirestoreWrite(async () => {
        await setDoc(doc(db, 'wedding_settings', 'main'), nextPayload, { merge: true });
      });
      syncLocalConfigFromPayload(nextPayload);
      setSettingsSaved(true);
      window.setTimeout(() => setSettingsSaved(false), 3500);
    } catch (error) {
      setSettingsError(formatFirestoreSaveError(error, currentUser));
    } finally {
      setSavingSettings(false);
    }
  };

  const persistWeddingSection = async (
    sectionKey: WeddingSectionSaveKey,
    godparentIndex?: number
  ) => {
    setSectionSaveErrors((prev) => ({ ...prev, [sectionKey]: '' }));
    setSavedSectionKey(null);

    if (sectionKey === 'date' || sectionKey === 'all') {
      if (
        !/^20[2-9]\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(weddingDateISO)
      ) {
        setSectionSaveErrors((prev) => ({
          ...prev,
          [sectionKey]: 'Selecciona una fecha válida para la boda (2026-2099).',
        }));
        if (sectionKey === 'all') {
          setWeddingDetailsError('Selecciona una fecha válida para la boda.');
        }
        return;
      }
    }

    if (sectionKey === 'ceremony' || sectionKey === 'all') {
      if (!ceremonyVenue.trim()) {
        setSectionSaveErrors((prev) => ({
          ...prev,
          [sectionKey]: 'Ingresa el nombre o lugar de la Ceremonia Religiosa.',
        }));
        if (sectionKey === 'all') {
          setWeddingDetailsError('Ingresa el lugar de la Ceremonia Religiosa.');
        }
        return;
      }
      const cleanCeremonyMap = ceremonyMapUrl.trim();
      if (cleanCeremonyMap && !cleanCeremonyMap.startsWith('https://')) {
        setSectionSaveErrors((prev) => ({
          ...prev,
          [sectionKey]:
            'El enlace de Google Maps de la Ceremonia debe comenzar con https:// (o déjalo vacío).',
        }));
        if (sectionKey === 'all') {
          setWeddingDetailsError(
            'El enlace de Google Maps de la Ceremonia debe comenzar con https://'
          );
        }
        return;
      }
    }

    if (sectionKey === 'reception' || sectionKey === 'all') {
      if (!receptionVenue.trim()) {
        setSectionSaveErrors((prev) => ({
          ...prev,
          [sectionKey]: 'Ingresa el nombre o lugar del Salón de Recepción.',
        }));
        if (sectionKey === 'all') {
          setWeddingDetailsError('Ingresa el lugar de la Recepción.');
        }
        return;
      }
      const cleanReceptionMap = receptionMapUrl.trim();
      if (cleanReceptionMap && !cleanReceptionMap.startsWith('https://')) {
        setSectionSaveErrors((prev) => ({
          ...prev,
          [sectionKey]:
            'El enlace de Google Maps de la Recepción debe comenzar con https:// (o déjalo vacío).',
        }));
        if (sectionKey === 'all') {
          setWeddingDetailsError(
            'El enlace de Google Maps de la Recepción debe comenzar con https://'
          );
        }
        return;
      }
    }

    if (sectionKey === 'parents' || sectionKey === 'all') {
      if (!brideParents.trim() || !groomParents.trim()) {
        setSectionSaveErrors((prev) => ({
          ...prev,
          [sectionKey]:
            'Ingresa los nombres de los Padres de la Novia y Padres del Novio.',
        }));
        if (sectionKey === 'all') {
          setWeddingDetailsError(
            'Ingresa los nombres de los Padres de la Novia y Padres del Novio.'
          );
        }
        return;
      }
    }

    if (typeof godparentIndex === 'number') {
      const item = godparentsList[godparentIndex];
      if (!item || !item.roleName.trim() || !item.names.trim()) {
        setSectionSaveErrors((prev) => ({
          ...prev,
          [sectionKey]:
            'Ingresa tanto el rol/título como el nombre(s) de este padrino antes de guardar.',
        }));
        return;
      }
    }

    if (sectionKey === 'godparents' || sectionKey === 'all') {
      const hasIncomplete = godparentsList.some(
        (g) =>
          (g.roleName.trim().length > 0 && g.names.trim().length === 0) ||
          (g.roleName.trim().length === 0 && g.names.trim().length > 0)
      );
      if (hasIncomplete) {
        setSectionSaveErrors((prev) => ({
          ...prev,
          [sectionKey]:
            'Completa el rol y los nombres en cada fila de padrinos (o elimina las filas vacías).',
        }));
        if (sectionKey === 'all') {
          setWeddingDetailsError(
            'Completa el rol y los nombres en cada fila de padrinos (o elimina las filas vacías).'
          );
        }
        return;
      }
    }

    setSavingSectionKey(sectionKey);
    if (sectionKey === 'all') {
      setSavingWeddingDetails(true);
      setWeddingDetailsError('');
      setWeddingDetailsSaved(false);
    }

    try {
      const payload = buildPersistedSettingsPayload();
      await executeAdminFirestoreWrite(async () => {
        await setDoc(doc(db, 'wedding_settings', 'main'), payload, { merge: true });
      });
      syncLocalConfigFromPayload(payload);
      setSavedSectionKey(sectionKey);
      if (sectionKey === 'all') {
        setWeddingDetailsSaved(true);
      }
      window.setTimeout(() => {
        setSavedSectionKey((curr) => (curr === sectionKey ? null : curr));
        if (sectionKey === 'all') {
          setWeddingDetailsSaved(false);
        }
      }, 3500);
    } catch (error) {
      const errorMsg = formatFirestoreSaveError(error, currentUser);
      setSectionSaveErrors((prev) => ({ ...prev, [sectionKey]: errorMsg }));
      if (sectionKey === 'all') {
        setWeddingDetailsError(errorMsg);
      }
    } finally {
      setSavingSectionKey((curr) => (curr === sectionKey ? null : curr));
      if (sectionKey === 'all') {
        setSavingWeddingDetails(false);
      }
    }
  };

  const handleSaveWeddingDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistWeddingSection('all');
  };

  const handleAddGodparentRow = () => {
    if (godparentsList.length >= 12) return;
    setGodparentsList((prev) => [...prev, { roleName: '', names: '' }]);
    setSectionSaveErrors((prev) => {
      const next = { ...prev };
      delete next.godparents;
      return next;
    });
  };

  const handleUpdateGodparentRow = (
    index: number,
    field: keyof GodparentRole,
    value: string
  ) => {
    setGodparentsList((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      )
    );
    setSectionSaveErrors((prev) => {
      const next = { ...prev };
      delete next[`godparent-${index}`];
      delete next.godparents;
      return next;
    });
  };

  const handleRemoveGodparentRow = (index: number) => {
    setGodparentsList((prev) => prev.filter((_, idx) => idx !== index));
    setSectionSaveErrors((prev) => {
      const next = { ...prev };
      delete next[`godparent-${index}`];
      delete next.godparents;
      return next;
    });
  };

  const handleGiftQrFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGiftQrError('');
    setIsCompressingGiftQr(true);
    try {
      const dataUrl = await compressQrCodeImage(file);
      setGiftQrImage(dataUrl);
    } catch (err) {
      setGiftQrError(
        err instanceof Error
          ? err.message
          : 'No se pudo procesar la imagen del código QR.'
      );
    } finally {
      setIsCompressingGiftQr(false);
      e.target.value = '';
    }
  };

  // --- HERO CAROUSEL IMAGE HANDLERS ---
  const handleUploadHeroImages = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).slice(0, 10);
    setHeroMediaError('');
    setHeroMediaSuccess('');
    setUploadingHeroImages(true);

    try {
      const baseOrder =
        heroPhotosList.length > 0
          ? Math.max(...heroPhotosList.map((p) => p.sortOrder)) + 1
          : 0;
      const hadZeroPhotos = heroPhotosList.length === 0;
      let uploadedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const compressed = await compressWeddingPhoto(files[i]);
        const photoId = `hero_${Date.now()}_${i}_${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        await executeAdminFirestoreWrite(async () => {
          await setDoc(doc(db, 'wedding_hero_photos', photoId), {
            id: photoId,
            imageData: compressed.imageData,
            caption: '',
            sortOrder: Math.min(100, baseOrder + i),
            active: true,
            createdAt: serverTimestamp(),
          });
        });
        uploadedCount += 1;
      }

      if (hadZeroPhotos && !hideDefaultHeroPhotos) {
        const nextPayload = buildPersistedSettingsPayload({
          hideDefaultHeroPhotos: true,
        });
        await executeAdminFirestoreWrite(async () => {
          await setDoc(doc(db, 'wedding_settings', 'main'), nextPayload, {
            merge: true,
          });
        });
        setHideDefaultHeroPhotos(true);
        syncLocalConfigFromPayload(nextPayload);
      }

      setHeroMediaSuccess(
        uploadedCount === 1
          ? 'Imagen agregada al carrusel de portada.'
          : `${uploadedCount} imágenes agregadas al carrusel de portada.`
      );
      window.setTimeout(() => setHeroMediaSuccess(''), 4000);
    } catch (err) {
      setHeroMediaError(
        err instanceof Error && !isPermissionDeniedError(err)
          ? err.message
          : formatFirestoreSaveError(err, currentUser)
      );
    } finally {
      setUploadingHeroImages(false);
      e.target.value = '';
    }
  };

  const handleAddHeroImageByUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setHeroMediaError('');
    setHeroMediaSuccess('');

    const rawUrl = newHeroUrlInput.trim().slice(0, 500);
    const cleanUrl = rawUrl.replace(/^https:\/\//i, 'https://');
    if (!/^https:\/\/[^/]/i.test(cleanUrl)) {
      setHeroMediaError(
        'El enlace de la imagen debe comenzar con https:// (o súbela directamente desde tu dispositivo).'
      );
      return;
    }

    setUploadingHeroImages(true);
    try {
      const nextOrder =
        heroPhotosList.length > 0
          ? Math.min(100, Math.max(...heroPhotosList.map((p) => p.sortOrder)) + 1)
          : 0;
      const hadZeroPhotos = heroPhotosList.length === 0;
      const photoId = `hero_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;

      await executeAdminFirestoreWrite(async () => {
        await setDoc(doc(db, 'wedding_hero_photos', photoId), {
          id: photoId,
          imageData: cleanUrl,
          caption: newHeroCaptionInput.trim().slice(0, 120),
          sortOrder: nextOrder,
          active: true,
          createdAt: serverTimestamp(),
        });
      });

      if (hadZeroPhotos && !hideDefaultHeroPhotos) {
        const nextPayload = buildPersistedSettingsPayload({
          hideDefaultHeroPhotos: true,
        });
        await executeAdminFirestoreWrite(async () => {
          await setDoc(doc(db, 'wedding_settings', 'main'), nextPayload, {
            merge: true,
          });
        });
        setHideDefaultHeroPhotos(true);
        syncLocalConfigFromPayload(nextPayload);
      }

      setNewHeroUrlInput('');
      setNewHeroCaptionInput('');
      setHeroMediaSuccess('Imagen agregada al carrusel de portada.');
      window.setTimeout(() => setHeroMediaSuccess(''), 4000);
    } catch (error) {
      setHeroMediaError(formatFirestoreSaveError(error, currentUser));
    } finally {
      setUploadingHeroImages(false);
    }
  };

  const handleReplaceHeroImageFile = async (
    photo: HeroPhotoRecord,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroMediaError('');
    setHeroMediaSuccess('');
    setReplacingHeroId(photo.id);

    try {
      const compressed = await compressWeddingPhoto(file);
      await executeAdminFirestoreWrite(async () => {
        await updateDoc(doc(db, 'wedding_hero_photos', photo.id), {
          imageData: compressed.imageData,
        });
      });
      setHeroMediaSuccess('Fotografía actualizada correctamente.');
      window.setTimeout(() => setHeroMediaSuccess(''), 3500);
    } catch (err) {
      setHeroMediaError(
        err instanceof Error && !isPermissionDeniedError(err)
          ? err.message
          : formatFirestoreSaveError(err, currentUser)
      );
    } finally {
      setReplacingHeroId(null);
      e.target.value = '';
    }
  };

  const handleSaveHeroCaption = async (photo: HeroPhotoRecord) => {
    setHeroMediaError('');
    const nextCaption = (heroCaptionDrafts[photo.id] ?? photo.caption)
      .trim()
      .slice(0, 120);
    try {
      await executeAdminFirestoreWrite(async () => {
        await updateDoc(doc(db, 'wedding_hero_photos', photo.id), {
          caption: nextCaption,
        });
      });
      setHeroMediaSuccess('Título de foto guardado.');
      window.setTimeout(() => setHeroMediaSuccess(''), 2500);
    } catch (error) {
      setHeroMediaError(formatFirestoreSaveError(error, currentUser));
    }
  };

  const handleToggleHeroPhotoActive = async (photo: HeroPhotoRecord) => {
    setHeroMediaError('');
    try {
      await executeAdminFirestoreWrite(async () => {
        await updateDoc(doc(db, 'wedding_hero_photos', photo.id), {
          active: !photo.active,
        });
      });
    } catch (error) {
      setHeroMediaError(formatFirestoreSaveError(error, currentUser));
    }
  };

  const handleMoveHeroPhoto = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= heroPhotosList.length) return;

    const reordered = [...heroPhotosList];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setHeroMediaError('');
    try {
      await executeAdminFirestoreWrite(async () => {
        const batch = writeBatch(db);
        reordered.forEach((item, idx) => {
          batch.update(doc(db, 'wedding_hero_photos', item.id), {
            sortOrder: idx,
          });
        });
        await batch.commit();
      });
    } catch (error) {
      setHeroMediaError(formatFirestoreSaveError(error, currentUser));
    }
  };

  const handleDeleteHeroPhoto = async (photoId: string) => {
    setHeroMediaError('');
    try {
      await executeAdminFirestoreWrite(async () => {
        await deleteDoc(doc(db, 'wedding_hero_photos', photoId));
      });
      setHeroMediaSuccess('Imagen eliminada del carrusel.');
      window.setTimeout(() => setHeroMediaSuccess(''), 2500);
    } catch (error) {
      setHeroMediaError(formatFirestoreSaveError(error, currentUser));
    }
  };

  const handleToggleHideDefaultHeroPhotos = async (nextHide: boolean) => {
    setHideDefaultHeroPhotos(nextHide);
    setHeroMediaError('');
    try {
      const nextPayload = buildPersistedSettingsPayload({
        hideDefaultHeroPhotos: nextHide,
      });
      await executeAdminFirestoreWrite(async () => {
        await setDoc(doc(db, 'wedding_settings', 'main'), nextPayload, {
          merge: true,
        });
      });
      syncLocalConfigFromPayload(nextPayload);
    } catch (error) {
      setHideDefaultHeroPhotos(!nextHide);
      setHeroMediaError(formatFirestoreSaveError(error, currentUser));
    }
  };

  // --- AMBIENT AUDIO HANDLERS ---
  useEffect(() => {
    let cancelled = false;
    if (
      customAudioMode !== 'uploaded' ||
      !customAudioUpdatedToken ||
      customAudioUpdatedToken === 'default-por-ti-volare'
    ) {
      loadedAdminTokenRef.current = '';
      setAdminPreviewBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
      return;
    }

    if (loadedAdminTokenRef.current === customAudioUpdatedToken) {
      return;
    }

    const loadPreviewChunks = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'wedding_audio_chunks'),
            where('trackToken', '==', customAudioUpdatedToken)
          )
        );
        if (cancelled || snap.empty) return;
        const chunks = snap.docs.map((d) => {
          const data = d.data();
          return {
            index: Number(data.index ?? 0),
            data: String(data.data ?? ''),
            mimeType: String(data.mimeType ?? customAudioMime),
          };
        });
        const nextUrl = assembleAudioBlobUrlFromChunks(chunks, customAudioMime);
        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        loadedAdminTokenRef.current = customAudioUpdatedToken;
        setAdminPreviewBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
      } catch {
        // Ignore preview preload errors
      }
    };

    void loadPreviewChunks();
    return () => {
      cancelled = true;
    };
  }, [customAudioMode, customAudioUpdatedToken, customAudioMime]);

  useEffect(() => {
    return () => {
      if (adminPreviewAudioRef.current) {
        adminPreviewAudioRef.current.pause();
      }
      setAdminPreviewBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
    };
  }, []);

  const cleanupOldAudioChunks = async (keepToken: string) => {
    try {
      const existingSnap = await getDocs(collection(db, 'wedding_audio_chunks'));
      const toDelete = existingSnap.docs.filter(
        (d) => String(d.data().trackToken ?? '') !== keepToken
      );
      for (let i = 0; i < toDelete.length; i += 400) {
        const batch = writeBatch(db);
        toDelete.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch {
      // Non-critical cleanup failure
    }
  };

  const handleAudioFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (adminPreviewAudioRef.current) {
      adminPreviewAudioRef.current.pause();
      setIsAdminPreviewPlaying(false);
    }

    setAudioMediaError('');
    setAudioMediaSuccess('');
    setUploadingAudio(true);
    setAudioUploadProgress('Validando archivo de audio...');

    let createdPreviewUrl = '';
    try {
      const prepared = await prepareAudioFileForUpload(file);
      createdPreviewUrl = prepared.previewUrl;
      const trackToken = `track_${Date.now()}`;

      for (let i = 0; i < prepared.chunks.length; i++) {
        setAudioUploadProgress(
          `Subiendo audio a la nube (${i + 1} de ${prepared.chunks.length})...`
        );
        const chunkId = `${trackToken}_${i}`;
        await executeAdminFirestoreWrite(async () => {
          await setDoc(doc(db, 'wedding_audio_chunks', chunkId), {
            id: chunkId,
            trackToken,
            index: i,
            totalChunks: prepared.chunks.length,
            mimeType: prepared.mimeType,
            data: prepared.chunks[i],
            createdAt: serverTimestamp(),
          });
        });
      }

      setAudioUploadProgress('Activando música en la invitación...');
      const nextSettingsPayload = buildPersistedSettingsPayload({
        customAudioMode: 'uploaded',
        customAudioTitle: prepared.title,
        customAudioMime: prepared.mimeType,
        customAudioChunkCount: prepared.chunks.length,
        customAudioUpdatedToken: trackToken,
        customAudioDurationSec: prepared.durationSec,
      });

      await executeAdminFirestoreWrite(async () => {
        await setDoc(
          doc(db, 'wedding_settings', 'main'),
          nextSettingsPayload,
          { merge: true }
        );
      });
      syncLocalConfigFromPayload(nextSettingsPayload);

      loadedAdminTokenRef.current = trackToken;
      setAdminPreviewBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return prepared.previewUrl;
      });
      createdPreviewUrl = '';
      setCustomAudioMode('uploaded');
      setCustomAudioTitle(prepared.title);
      setCustomAudioMime(prepared.mimeType);
      setCustomAudioChunkCount(prepared.chunks.length);
      setCustomAudioUpdatedToken(trackToken);
      setCustomAudioDurationSec(prepared.durationSec);

      void cleanupOldAudioChunks(trackToken);
      setAudioMediaSuccess(
        `¡Canción "${prepared.title}" guardada y activada! Reemplazó la música anterior y se escuchará al abrir la invitación.`
      );
      window.setTimeout(() => setAudioMediaSuccess(''), 5500);
    } catch (err) {
      if (createdPreviewUrl) {
        URL.revokeObjectURL(createdPreviewUrl);
      }
      setAudioMediaError(
        err instanceof Error && !isPermissionDeniedError(err)
          ? err.message
          : formatFirestoreSaveError(err, currentUser)
      );
    } finally {
      setUploadingAudio(false);
      setAudioUploadProgress('');
      e.target.value = '';
    }
  };

  const handleSaveCustomAudioUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setAudioMediaError('');
    setAudioMediaSuccess('');

    if (adminPreviewAudioRef.current) {
      adminPreviewAudioRef.current.pause();
      setIsAdminPreviewPlaying(false);
    }

    const cleanUrl = customAudioUrl
      .trim()
      .slice(0, 500)
      .replace(/^https:\/\//i, 'https://');
    if (!/^https:\/\/[^/]/i.test(cleanUrl)) {
      setAudioMediaError(
        'El enlace de audio debe comenzar con https:// (por ejemplo, un enlace directo a un archivo .mp3).'
      );
      return;
    }

    setUploadingAudio(true);
    try {
      const nextTitle =
        customAudioTitle.trim().slice(0, 120) || 'Música Personalizada';
      const nextPayload = buildPersistedSettingsPayload({
        customAudioMode: 'url',
        customAudioUrl: cleanUrl,
        customAudioTitle: nextTitle,
      });
      await executeAdminFirestoreWrite(async () => {
        await setDoc(doc(db, 'wedding_settings', 'main'), nextPayload, {
          merge: true,
        });
      });
      syncLocalConfigFromPayload(nextPayload);
      setCustomAudioMode('url');
      setCustomAudioUrl(cleanUrl);
      setCustomAudioTitle(nextTitle);
      setAudioMediaSuccess('Enlace de música guardado y activado.');
      window.setTimeout(() => setAudioMediaSuccess(''), 4000);
    } catch (error) {
      setAudioMediaError(formatFirestoreSaveError(error, currentUser));
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleActivateUploadedAudio = async () => {
    if (!customAudioUpdatedToken || customAudioUpdatedToken === 'default-por-ti-volare') {
      return;
    }
    setAudioMediaError('');
    setAudioMediaSuccess('');
    setUploadingAudio(true);
    if (adminPreviewAudioRef.current) {
      adminPreviewAudioRef.current.pause();
      setIsAdminPreviewPlaying(false);
    }
    try {
      const nextPayload = buildPersistedSettingsPayload({
        customAudioMode: 'uploaded',
      });
      await executeAdminFirestoreWrite(async () => {
        await setDoc(doc(db, 'wedding_settings', 'main'), nextPayload, {
          merge: true,
        });
      });
      syncLocalConfigFromPayload(nextPayload);
      setCustomAudioMode('uploaded');
      setAudioMediaSuccess('Archivo de audio subido activado en la invitación.');
      window.setTimeout(() => setAudioMediaSuccess(''), 3500);
    } catch (error) {
      setAudioMediaError(formatFirestoreSaveError(error, currentUser));
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleUseSynthAudio = async () => {
    setAudioMediaError('');
    setAudioMediaSuccess('');
    setUploadingAudio(true);
    if (adminPreviewAudioRef.current) {
      adminPreviewAudioRef.current.pause();
      setIsAdminPreviewPlaying(false);
    }
    try {
      const nextPayload = buildPersistedSettingsPayload({
        customAudioMode: 'synth',
        customAudioTitle: DEFAULT_INTEGRATED_AUDIO_TITLE,
      });
      await executeAdminFirestoreWrite(async () => {
        await setDoc(doc(db, 'wedding_settings', 'main'), nextPayload, {
          merge: true,
        });
      });
      syncLocalConfigFromPayload(nextPayload);
      setCustomAudioMode('synth');
      setCustomAudioTitle(DEFAULT_INTEGRATED_AUDIO_TITLE);
      setAudioMediaSuccess('Melodía ambiental integrada activada.');
      window.setTimeout(() => setAudioMediaSuccess(''), 3500);
    } catch (error) {
      setAudioMediaError(formatFirestoreSaveError(error, currentUser));
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleDeleteUploadedAudio = async () => {
    setAudioMediaError('');
    setAudioMediaSuccess('');
    setUploadingAudio(true);
    if (adminPreviewAudioRef.current) {
      adminPreviewAudioRef.current.pause();
      setIsAdminPreviewPlaying(false);
    }
    try {
      await cleanupOldAudioChunks('__none__');
      const hasValidUrl = /^https:\/\/[^/]/i.test(customAudioUrl.trim());
      const nextMode: CustomAudioMode = hasValidUrl ? 'url' : 'synth';
      const nextTitle = hasValidUrl
        ? customAudioTitle.trim().slice(0, 120) || 'Música Personalizada'
        : DEFAULT_INTEGRATED_AUDIO_TITLE;
      const nextPayload = buildPersistedSettingsPayload({
        customAudioMode: nextMode,
        customAudioTitle: nextTitle,
        customAudioMime: 'audio/mpeg',
        customAudioChunkCount: 0,
        customAudioUpdatedToken: '',
        customAudioDurationSec: 0,
      });
      await executeAdminFirestoreWrite(async () => {
        await setDoc(doc(db, 'wedding_settings', 'main'), nextPayload, {
          merge: true,
        });
      });
      syncLocalConfigFromPayload(nextPayload);
      setAdminPreviewBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
      loadedAdminTokenRef.current = '';
      setCustomAudioMode(nextMode);
      setCustomAudioTitle(nextTitle);
      setCustomAudioChunkCount(0);
      setCustomAudioUpdatedToken('');
      setCustomAudioDurationSec(0);
      setAudioMediaSuccess('Audio subido eliminado de la nube.');
      window.setTimeout(() => setAudioMediaSuccess(''), 3500);
    } catch (error) {
      setAudioMediaError(formatFirestoreSaveError(error, currentUser));
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleToggleAdminAudioPreview = async () => {
    const el = adminPreviewAudioRef.current;
    if (!el) return;
    setAudioMediaError('');
    if (isAdminPreviewPlaying) {
      el.pause();
      setIsAdminPreviewPlaying(false);
    } else {
      try {
        await el.play();
        setIsAdminPreviewPlaying(true);
      } catch {
        setAudioMediaError(
          'No se pudo reproducir la vista previa. Verifica que el enlace o archivo de audio sea válido y público.'
        );
      }
    }
  };

  const activeRoleLabel = useMemo(() => {
    const email = currentUser?.email?.toLowerCase();
    if (email === AUTHORIZED_COUPLE_ACCOUNTS.admin.email) {
      return AUTHORIZED_COUPLE_ACCOUNTS.admin.roleLabel;
    }
    if (email === AUTHORIZED_COUPLE_ACCOUNTS.novio.email) {
      return AUTHORIZED_COUPLE_ACCOUNTS.novio.roleLabel;
    }
    return 'Novios';
  }, [currentUser]);

  return (
    <section
      id="novios"
      className="relative overflow-hidden py-16 sm:py-20 px-4 sm:px-6 bg-[#fcfbf9] border-t border-[#b89753]/25"
    >
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs uppercase tracking-[0.22em] text-[#b89753] font-semibold">
            · Acceso Privado ·
          </p>
          <h2 className="mt-2 font-serif text-4xl sm:text-5xl font-semibold text-[#2c3e35]">
            Panel de Administración de Novios
          </h2>
          {isAuthorizedCouple && (
            <p className="mt-3 text-sm text-[#2c3e35]/75 leading-relaxed">
              Consulta el listado de invitaciones confirmadas con ubicación de
              mesa, exporta reportes para el salón y descarga todas las
              fotografías del evento.
            </p>
          )}
        </div>

        {/* Gate 1: Not Signed In as Authorized Couple */}
        {!isAuthorizedCouple ? (
          hasUnauthorizedAttempt ? (
            /* Unauthorized Logged-In User Card ("Acceso no autorizado") */
            <div className="max-w-md mx-auto bg-white border border-[#b89753]/35 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
              <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>

              <p className="text-[11px] uppercase tracking-[0.2em] text-[#b89753] font-semibold">
                JESSICA & JORGE
              </p>
              <h3 className="font-serif text-3xl font-semibold text-[#2c3e35] mt-1">
                Acceso no autorizado
              </h3>
              <p className="mt-2 text-sm text-[#2c3e35]/75 leading-relaxed">
                La cuenta con la que intentas ingresar no cuenta con los permisos necesarios para acceder a esta sección.
              </p>

              <div className="bg-[#f7f5f0] border border-[#b89753]/30 rounded-xl p-4 mt-5 text-left flex items-start gap-3">
                <Info className="w-5 h-5 text-[#b89753] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-[#2c3e35]">
                    ¿Necesitas ayuda?
                  </h4>
                  <p className="text-xs text-[#2c3e35]/70 mt-0.5 leading-relaxed">
                    Si consideras que deberías tener acceso, comunícate con el administrador de la boda para solicitar asistencia.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleLogout()}
                className="w-full h-11 rounded-xl bg-[#2c3e35] hover:bg-[#1f2c26] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer inline-flex items-center justify-center gap-2 mt-6 shadow-sm"
              >
                <KeyRound className="w-4 h-4 text-[#b89753]" />
                <span>Ingresar con otra cuenta</span>
              </button>

              <span className="text-[10px] uppercase tracking-[0.2em] text-[#2c3e35]/50 mt-6 block">
                GRACIAS POR SER PARTE DE NUESTRO DÍA ESPECIAL
              </span>
            </div>
          ) : (
            <div className="max-w-md mx-auto bg-white border border-[#b89753]/35 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-[#f7f5f0] border border-[#b89753]/30 text-[#b89753] flex items-center justify-center mx-auto mb-3">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                Acceso Exclusivo (Admin / Novio)
              </h3>
              <p className="mt-1 text-xs text-[#2c3e35]/65">
                Ingresa con tu usuario asignado.
              </p>
            </div>

            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="adminIdentifier"
                  className="block text-xs font-medium text-[#2c3e35] mb-1.5"
                >
                  Usuario o correo electrónico
                </label>
                <input
                  id="adminIdentifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin o novio / correo@gmail.com"
                  autoComplete="username"
                  className="w-full h-11 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3.5 text-sm text-[#2c3e35] placeholder:text-[#2c3e35]/40 focus:outline-none focus:border-[#b89753]"
                />
              </div>

              <div>
                <label
                  htmlFor="adminPassword"
                  className="block text-xs font-medium text-[#2c3e35] mb-1.5"
                >
                  Contraseña
                </label>
                <input
                  id="adminPassword"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full h-11 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3.5 text-sm text-[#2c3e35] placeholder:text-[#2c3e35]/40 focus:outline-none focus:border-[#b89753]"
                />
              </div>

              {authError && (
                <p
                  role="alert"
                  className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 leading-relaxed"
                >
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-11 rounded-xl bg-[#2c3e35] hover:bg-[#1f2c26] disabled:opacity-60 text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4 text-[#b89753]" />
                )}
                <span>Ingresar con Contraseña</span>
              </button>
            </form>

            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-[#b89753]/25 w-full" />
              <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-[#2c3e35]/50 whitespace-nowrap">
                o accede con Google
              </span>
              <div className="border-t border-[#b89753]/25 w-full" />
            </div>

            <GoogleSignInButton
              onClick={() => void handleAdminGoogleLogin()}
              disabled={authLoading}
              label="Ingresar con Google (Admin / Novio)"
              className="w-full h-11"
            />
          </div>
          )
        ) : !currentUser?.emailVerified && !isAuthorizedCouple ? (
          /* Gate 2: Email/Password User Needs Verification */
          <div className="max-w-lg mx-auto bg-white border border-[#b89753]/35 rounded-2xl p-8 text-center shadow-sm space-y-4">
            <MailCheck className="w-10 h-10 text-[#b89753] mx-auto" />
            <h3 className="font-serif text-3xl font-semibold text-[#2c3e35]">
              Verifica tu correo electrónico
            </h3>
            <p className="text-sm text-[#2c3e35]/75 leading-relaxed">
              Iniciaste sesión como{' '}
              <strong className="text-[#2c3e35]">{currentUser?.email}</strong>.
              Por seguridad de tus invitados, Firebase requiere que el correo
              esté verificado antes de abrir el listado RSVP.
            </p>

            {verificationSent && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                Enviamos un enlace de verificación a tu bandeja de entrada.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSendVerification}
                className="px-5 py-2.5 rounded-full bg-[#b89753] hover:bg-[#967739] text-white text-xs font-semibold cursor-pointer"
              >
                Enviar enlace de verificación
              </button>
              <button
                type="button"
                onClick={handleReloadUser}
                className="px-5 py-2.5 rounded-full bg-[#2c3e35] text-white text-xs font-semibold cursor-pointer"
              >
                Ya verifiqué mi correo
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-5 py-2.5 rounded-full border border-[#b89753]/45 text-[#2c3e35] text-xs font-semibold cursor-pointer"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        ) : (
          /* Gate 3: Authenticated Couple Admin Dashboard */
          <div className="space-y-8">
            {/* Session Header Bar */}
            <div className="bg-white border border-[#b89753]/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2c3e35] text-[#b89753] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                      Sesión activa · {activeRoleLabel}
                    </p>
                    <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold text-center">
                      <Check className="w-3 h-3 text-emerald-600" />
                      Reglas Firestore OK
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
                    <p className="text-sm font-medium text-[#2c3e35]">
                      {currentUser?.email}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleRefreshAdminToken()}
                      disabled={refreshingPermissions}
                      className="inline-flex items-center gap-1 text-[11px] text-[#b89753] hover:text-[#967739] font-medium underline underline-offset-2 cursor-pointer"
                      title="Forzar actualización de credenciales de administrador en Firestore"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${refreshingPermissions ? 'animate-spin' : ''}`}
                      />
                      <span>Refrescar permisos</span>
                    </button>
                    {permissionsRefreshedMsg && (
                      <span className="text-[11px] text-emerald-700 font-medium">
                        ✓ {permissionsRefreshedMsg}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    exportWeddingReportPdf(rsvps, totalTables, {
                      weddingDateISO,
                      receptionVenue,
                    })
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                  title="Descargar reporte general de confirmaciones y distribución del salón"
                >
                  <FileText className="w-3.5 h-3.5 text-[#b89753]" />
                  <span>Reporte General (.pdf)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportConfirmedGuestsBySurnamePdf(rsvps, {
                      weddingDateISO,
                      receptionVenue,
                    })
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#7c622c] hover:bg-[#664f21] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shadow-xs"
                  title="Descargar reporte PDF ordenado por apellidos, dividido en familiares y amigos del novio/novia, con mesa, asiento y teléfono"
                >
                  <FileText className="w-3.5 h-3.5 text-[#f7f5f0]" />
                  <span>Directorio por Apellidos (.pdf)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportTablePlaceCardsPdf(rsvps, totalTables, {
                      weddingDateISO,
                      receptionVenue,
                    })
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#141d18] hover:bg-[#2c3e35] text-white text-xs font-semibold cursor-pointer whitespace-nowrap border border-[#b89753]/50 shadow-xs"
                  title="Descargar arte imprimible con listado de 10 asientos por mesa"
                >
                  <FileText className="w-3.5 h-3.5 text-[#b89753]" />
                  <span>Carteles de Mesa PDF (Imprimible)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#2c3e35]/25 hover:border-[#b89753] text-[#2c3e35] text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#b89753]" />
                  <span>Exportar (.csv)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadAllPhotosZip}
                  disabled={isZipping || allPhotos.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#b89753] hover:bg-[#967739] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  {isZipping ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FolderArchive className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isZipping
                      ? 'Comprimiendo...'
                      : `Descargar Fotos (.zip · ${allPhotos.length})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#b89753]/45 text-[#2c3e35] hover:bg-[#f7f5f0] text-xs font-medium cursor-pointer whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Salir</span>
                </button>
              </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#b89753]/25 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-[#2c3e35]/55">
                  Confirmaciones
                </p>
                <p className="mt-1 font-serif text-3xl font-semibold text-[#2c3e35] tabular-nums">
                  {stats.confirmedCount}{' '}
                  <span className="text-sm font-sans font-normal text-[#2c3e35]/60">
                    de {stats.totalInvitations}
                  </span>
                </p>
              </div>
              <div className="bg-white border border-[#b89753]/25 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-[#2c3e35]/55">
                  Total Asientos (Banquete)
                </p>
                <p className="mt-1 font-serif text-3xl font-semibold text-[#b89753] tabular-nums">
                  {stats.totalSeated}{' '}
                  <span className="text-sm font-sans font-normal text-[#2c3e35]/60">
                    ({stats.totalAdults} ad · {stats.totalKids} niñ)
                  </span>
                </p>
              </div>
              <div className="bg-white border border-[#b89753]/25 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-[#2c3e35]/55">
                  Bebés y No Asisten
                </p>
                <p className="mt-1 font-serif text-3xl font-semibold text-[#2c3e35] tabular-nums">
                  {stats.totalBabies}{' '}
                  <span className="text-sm font-sans font-normal text-[#2c3e35]/60">
                    bebés · {stats.declinedCount} declin.
                  </span>
                </p>
              </div>
              <div className="bg-white border border-[#b89753]/25 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-[#2c3e35]/55">
                  Fotografías del Álbum
                </p>
                <p className="mt-1 font-serif text-3xl font-semibold text-[#2c3e35] tabular-nums">
                  {allPhotos.length}
                </p>
              </div>
            </div>

            {/* Segmented Tab Controls */}
            <div className="flex flex-wrap sm:inline-flex items-center gap-1 p-1 bg-[#f7f5f0] border border-[#b89753]/25 rounded-xl w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab('rsvps')}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
                  activeTab === 'rsvps'
                    ? 'bg-white text-[#2c3e35] shadow-xs'
                    : 'text-[#2c3e35]/65 hover:text-[#2c3e35]'
                }`}
              >
                Confirmaciones ({rsvps.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('quotas')}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
                  activeTab === 'quotas'
                    ? 'bg-white text-[#2c3e35] shadow-xs'
                    : 'text-[#2c3e35]/65 hover:text-[#2c3e35]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0 text-[#b89753]" />
                <span>Lista y Cupos ({guestQuotas.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('wedding')}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
                  activeTab === 'wedding'
                    ? 'bg-white text-[#2c3e35] shadow-xs'
                    : 'text-[#2c3e35]/65 hover:text-[#2c3e35]'
                }`}
              >
                <Heart className="w-3.5 h-3.5 shrink-0 text-[#b89753]" />
                <span>Boda y Padrinos</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('media')}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
                  activeTab === 'media'
                    ? 'bg-white text-[#2c3e35] shadow-xs'
                    : 'text-[#2c3e35]/65 hover:text-[#2c3e35]'
                }`}
              >
                <Music className="w-3.5 h-3.5 shrink-0 text-[#b89753]" />
                <span>Portada y Música</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('photos')}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center whitespace-nowrap ${
                  activeTab === 'photos'
                    ? 'bg-white text-[#2c3e35] shadow-xs'
                    : 'text-[#2c3e35]/65 hover:text-[#2c3e35]'
                }`}
              >
                Fotografías ({allPhotos.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`w-full sm:w-auto px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
                  activeTab === 'settings'
                    ? 'bg-white text-[#2c3e35] shadow-xs'
                    : 'text-[#2c3e35]/65 hover:text-[#2c3e35]'
                }`}
              >
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span>Google Drive y Ajustes</span>
              </button>
            </div>

            {/* TAB: HERO CAROUSEL IMAGES & AMBIENT MUSIC */}
            {activeTab === 'media' && (
              <div className="space-y-6 max-w-4xl">
                {/* CARD 1: HERO CAROUSEL IMAGES */}
                <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#f7f5f0] border border-[#b89753]/30 text-[#b89753] flex items-center justify-center shrink-0">
                        <ImagePlus className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                          Carrusel de Inicio y Pantalla del Sobre
                        </p>
                        <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                          Imágenes de Portada ({heroPhotosList.filter((p) => p.active).length} activas)
                        </h3>
                      </div>
                    </div>

                    <label
                      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#b89753] hover:bg-[#967739] text-white text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                        uploadingHeroImages ? 'opacity-60 pointer-events-none' : ''
                      }`}
                    >
                      {uploadingHeroImages ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>
                        {uploadingHeroImages
                          ? 'Subiendo imagen...'
                          : 'Subir Imágenes Directamente'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={uploadingHeroImages}
                        onChange={(e) => void handleUploadHeroImages(e)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <p className="text-xs text-[#2c3e35]/75 leading-relaxed">
                    Sube las fotografías de los novios directamente desde tu teléfono o computadora (puedes seleccionar varias a la vez). La primera imagen visible también se usa como fondo difuminado en el sobre de bienvenida.
                  </p>

                  {/* Default stock photos visibility toggle */}
                  <div className="rounded-xl bg-[#f7f5f0] border border-[#b89753]/25 p-3.5 flex items-start gap-3">
                    <input
                      id="hideDefaultHeroPhotosToggle"
                      type="checkbox"
                      checked={!hideDefaultHeroPhotos}
                      onChange={(e) =>
                        void handleToggleHideDefaultHeroPhotos(!e.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 accent-[#b89753] rounded cursor-pointer"
                    />
                    <label
                      htmlFor="hideDefaultHeroPhotosToggle"
                      className="text-xs text-[#2c3e35] cursor-pointer leading-relaxed"
                    >
                      <span className="font-semibold block">
                        Incluir también las {DEFAULT_HERO_PHOTOS.length} fotos de muestra por defecto
                      </span>
                      <span className="text-[#2c3e35]/65">
                        Desmarca esta casilla cuando ya hayas subido tus propias fotos para mostrar únicamente tus imágenes en el carrusel. (Si no hay fotos propias activas, se mostrarán las de muestra automáticamente).
                      </span>
                    </label>
                  </div>

                  {heroMediaError && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                      {heroMediaError}
                    </p>
                  )}

                  {heroMediaSuccess && (
                    <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{heroMediaSuccess}</span>
                    </p>
                  )}

                  {/* Uploaded / Custom Hero Photos List */}
                  {heroPhotosList.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#b89753]/40 bg-[#fcfbf9] p-6 text-center space-y-2">
                      <ImagePlus className="w-7 h-7 text-[#b89753] mx-auto" />
                      <p className="text-sm font-medium text-[#2c3e35]">
                        Aún no has subido imágenes personalizadas de portada
                      </p>
                      <p className="text-xs text-[#2c3e35]/65">
                        Usa el botón dorado &ldquo;Subir Imágenes Directamente&rdquo; arriba o agrega un enlace debajo.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {heroPhotosList.map((photo, idx) => (
                        <div
                          key={photo.id}
                          className={`rounded-xl border p-3.5 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 transition-colors ${
                            photo.active
                              ? 'bg-[#fcfbf9] border-[#b89753]/35'
                              : 'bg-neutral-50 border-neutral-200 opacity-75'
                          }`}
                        >
                          <div className="relative w-full sm:w-28 h-36 sm:h-20 rounded-lg overflow-hidden border border-[#b89753]/30 bg-[#141d18] shrink-0">
                            <img
                              src={photo.imageData}
                              alt={photo.caption || `Foto portada ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-black/65 text-white text-[10px] font-semibold">
                              #{idx + 1}
                            </span>
                          </div>

                          <div className="flex-1 w-full space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                maxLength={120}
                                value={
                                  heroCaptionDrafts[photo.id] ?? photo.caption
                                }
                                onChange={(e) =>
                                  setHeroCaptionDrafts((prev) => ({
                                    ...prev,
                                    [photo.id]: e.target.value,
                                  }))
                                }
                                placeholder="Título o nota interna opcional (ej. Sesión en la playa)"
                                className="flex-1 min-w-[180px] h-9 bg-white border border-[#b89753]/35 rounded-lg px-3 text-xs text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveHeroCaption(photo)}
                                className="px-3 h-9 rounded-lg border border-[#b89753]/40 bg-white hover:bg-[#f7f5f0] text-[11px] font-semibold text-[#2c3e35] cursor-pointer"
                              >
                                Guardar nota
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <label
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#b89753]/45 bg-white hover:bg-[#f7f5f0] text-[11px] font-semibold text-[#2c3e35] cursor-pointer ${
                                  replacingHeroId === photo.id
                                    ? 'opacity-60 pointer-events-none'
                                    : ''
                                }`}
                              >
                                {replacingHeroId === photo.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Upload className="w-3 h-3 text-[#b89753]" />
                                )}
                                <span>Cambiar imagen</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={replacingHeroId === photo.id}
                                  onChange={(e) =>
                                    void handleReplaceHeroImageFile(photo, e)
                                  }
                                  className="hidden"
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() =>
                                  void handleToggleHeroPhotoActive(photo)
                                }
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer ${
                                  photo.active
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-white text-[#2c3e35]/70 border border-[#2c3e35]/20'
                                }`}
                              >
                                {photo.active ? (
                                  <>
                                    <Eye className="w-3 h-3" />
                                    <span>Visible</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-3 h-3" />
                                    <span>Oculta</span>
                                  </>
                                )}
                              </button>

                              <div className="inline-flex items-center gap-1 ml-auto">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() =>
                                    void handleMoveHeroPhoto(idx, -1)
                                  }
                                  aria-label="Mover imagen arriba"
                                  title="Subir posición"
                                  className="p-1.5 rounded-lg border border-[#b89753]/30 bg-white text-[#2c3e35] disabled:opacity-35 hover:bg-[#f7f5f0] cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === heroPhotosList.length - 1}
                                  onClick={() =>
                                    void handleMoveHeroPhoto(idx, 1)
                                  }
                                  aria-label="Mover imagen abajo"
                                  title="Bajar posición"
                                  className="p-1.5 rounded-lg border border-[#b89753]/30 bg-white text-[#2c3e35] disabled:opacity-35 hover:bg-[#f7f5f0] cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleDeleteHeroPhoto(photo.id)
                                  }
                                  aria-label="Eliminar imagen de portada"
                                  title="Eliminar imagen"
                                  className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Optional Add Hero Photo by HTTPS URL */}
                  <form
                    onSubmit={(e) => void handleAddHeroImageByUrl(e)}
                    className="pt-3 border-t border-[#b89753]/20 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-end"
                  >
                    <div className="flex-1">
                      <label
                        htmlFor="newHeroUrlInput"
                        className="block text-[11px] font-medium text-[#2c3e35]/80 mb-1"
                      >
                        O añadir imagen por enlace HTTPS (opcional)
                      </label>
                      <input
                        id="newHeroUrlInput"
                        type="url"
                        maxLength={500}
                        value={newHeroUrlInput}
                        onChange={(e) => setNewHeroUrlInput(e.target.value)}
                        placeholder="https://... enlace directo de fotografía"
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-xs text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>
                    <div className="sm:w-48">
                      <input
                        type="text"
                        maxLength={120}
                        value={newHeroCaptionInput}
                        onChange={(e) => setNewHeroCaptionInput(e.target.value)}
                        placeholder="Nota opcional"
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-xs text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={uploadingHeroImages || !newHeroUrlInput.trim()}
                      className="h-10 px-4 rounded-xl bg-[#2c3e35] hover:bg-[#1f2c26] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap inline-flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#b89753]" />
                      <span>Agregar URL</span>
                    </button>
                  </form>
                </div>

                {/* CARD 2: AMBIENT MUSIC / CUSTOM AUDIO UPLOAD */}
                <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#f7f5f0] border border-[#b89753]/30 text-[#b89753] flex items-center justify-center shrink-0">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                          Botón Flotante &ldquo;Música activa&rdquo;
                        </p>
                        <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                          Audio y Música de la Invitación
                        </h3>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold self-start sm:self-center ${
                        customAudioMode === 'uploaded'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : customAudioMode === 'url'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-[#f7f5f0] text-[#2c3e35] border border-[#b89753]/35'
                      }`}
                    >
                      <Music className="w-3.5 h-3.5 text-[#b89753]" />
                      <span>
                        {customAudioMode === 'uploaded'
                          ? 'Archivo subido activo'
                          : customAudioMode === 'url'
                            ? 'Enlace directo activo'
                            : 'Melodía integrada activa'}
                      </span>
                    </span>
                  </div>

                  <p className="text-xs text-[#2c3e35]/75 leading-relaxed">
                    Sube directamente la canción o melodía que deseas que se reproduzca automáticamente cuando tus invitados abran el sobre de invitación (formatos MP3, M4A, AAC, OGG o WAV, hasta 6.2 MB).
                  </p>

                  {/* Upload File Box */}
                  <div className="rounded-xl bg-[#f7f5f0] border border-[#b89753]/30 p-4 sm:p-5 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#2c3e35]">
                          Subir archivo de audio desde tu dispositivo
                        </p>
                        <p className="text-xs text-[#2c3e35]/70 mt-0.5">
                          {customAudioUpdatedToken
                            ? `Archivo actual: ${customAudioTitle}${
                                customAudioDurationSec > 0
                                  ? ` · ${formatAudioDuration(customAudioDurationSec)}`
                                  : ''
                              }`
                            : 'Ningún archivo de audio propio cargado todavía.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#b89753] hover:bg-[#967739] text-white text-xs font-semibold cursor-pointer transition-colors ${
                            uploadingAudio ? 'opacity-60 pointer-events-none' : ''
                          }`}
                        >
                          {uploadingAudio ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <span>
                            {customAudioUpdatedToken
                              ? 'Cambiar Archivo de Audio'
                              : 'Subir Archivo de Audio'}
                          </span>
                          <input
                            type="file"
                            accept="audio/*,.mp3,.m4a,.aac,.ogg,.wav,.webm"
                            disabled={uploadingAudio}
                            onChange={(e) => void handleAudioFileUpload(e)}
                            className="hidden"
                          />
                        </label>

                        {customAudioUpdatedToken &&
                          customAudioUpdatedToken !== 'default-por-ti-volare' &&
                          customAudioMode !== 'uploaded' && (
                            <button
                              type="button"
                              disabled={uploadingAudio}
                              onClick={() => void handleActivateUploadedAudio()}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border border-[#b89753]/50 bg-white hover:bg-[#fcfbf9] text-[#2c3e35] text-xs font-semibold cursor-pointer"
                            >
                              <Music className="w-3.5 h-3.5 text-[#b89753]" />
                              <span>Activar este archivo</span>
                            </button>
                          )}

                        {customAudioUpdatedToken && (
                          <button
                            type="button"
                            disabled={uploadingAudio}
                            onClick={() => void handleDeleteUploadedAudio()}
                            className="inline-flex items-center gap-1 px-3.5 py-2.5 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar audio</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {audioUploadProgress && (
                      <p className="text-xs font-medium text-[#b89753] flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{audioUploadProgress}</span>
                      </p>
                    )}

                    {/* Inline Admin Audio Preview Player (supports uploaded, URL, and integrated track) */}
                    {(() => {
                      const adminPreviewSrc =
                        customAudioMode === 'uploaded'
                          ? adminPreviewBlobUrl
                          : customAudioMode === 'url' &&
                              /^https:\/\/[^/]/i.test(customAudioUrl.trim())
                            ? customAudioUrl.trim()
                            : DEFAULT_INTEGRATED_AUDIO_URL;
                      const adminPreviewTitle =
                        customAudioMode === 'synth'
                          ? DEFAULT_INTEGRATED_AUDIO_TITLE
                          : customAudioTitle || DEFAULT_INTEGRATED_AUDIO_TITLE;
                      if (!adminPreviewSrc) return null;
                      return (
                        <div className="rounded-xl bg-white border border-[#b89753]/30 p-3 flex flex-wrap items-center justify-between gap-3">
                          <audio
                            ref={adminPreviewAudioRef}
                            src={adminPreviewSrc}
                            preload="none"
                            onEnded={() => setIsAdminPreviewPlaying(false)}
                            onPause={() => setIsAdminPreviewPlaying(false)}
                            onPlay={() => setIsAdminPreviewPlaying(true)}
                            onError={() => {
                              setIsAdminPreviewPlaying(false);
                              if (customAudioMode === 'url') {
                                setAudioMediaError(
                                  'No se pudo cargar el enlace externo para vista previa. Si falla para los invitados, sonará la melodía integrada de respaldo.'
                                );
                              }
                            }}
                            className="hidden"
                          />
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => void handleToggleAdminAudioPreview()}
                              className="w-9 h-9 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] text-white flex items-center justify-center shrink-0 cursor-pointer"
                              aria-label={
                                isAdminPreviewPlaying
                                  ? 'Pausar vista previa'
                                  : 'Escuchar vista previa'
                              }
                            >
                              {isAdminPreviewPlaying ? (
                                <Pause className="w-4 h-4 text-[#b89753]" />
                              ) : (
                                <Play className="w-4 h-4 text-[#b89753] ml-0.5" />
                              )}
                            </button>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#2c3e35] truncate">
                                {adminPreviewTitle}
                              </p>
                              <p className="text-[11px] text-[#2c3e35]/60">
                                {isAdminPreviewPlaying
                                  ? 'Reproduciendo vista previa...'
                                  : 'Pulsa Play para probar cómo sonará en la invitación'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Alternative: Direct HTTPS Audio URL */}
                  <form
                    onSubmit={(e) => void handleSaveCustomAudioUrl(e)}
                    className="rounded-xl border border-[#b89753]/25 p-4 space-y-3"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#2c3e35]">
                      <Link2 className="w-3.5 h-3.5 text-[#b89753]" />
                      <span>Opción alternativa: usar enlace HTTPS directo (.mp3 / .m4a)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <input
                        type="text"
                        maxLength={120}
                        value={customAudioTitle}
                        onChange={(e) => setCustomAudioTitle(e.target.value)}
                        placeholder="Nombre de la canción"
                        className="sm:col-span-4 h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-xs text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                      <input
                        type="url"
                        maxLength={500}
                        value={customAudioUrl}
                        onChange={(e) => setCustomAudioUrl(e.target.value)}
                        placeholder="https://... enlace directo al archivo de audio"
                        className="sm:col-span-5 h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-xs text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                      <button
                        type="submit"
                        disabled={uploadingAudio || !customAudioUrl.trim()}
                        className="sm:col-span-3 h-10 px-4 rounded-xl bg-[#2c3e35] hover:bg-[#1f2c26] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Activar Enlace
                      </button>
                    </div>
                  </form>

                  {/* Switch back to Built-in Romantic Synth */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <p className="text-xs text-[#2c3e35]/65">
                      Si un navegador bloquea o no soporta un archivo externo, siempre se reproducirá la melodía romántica de respaldo.
                    </p>
                    <button
                      type="button"
                      disabled={uploadingAudio || customAudioMode === 'synth'}
                      onClick={() => void handleUseSynthAudio()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#b89753]/45 bg-[#fcfbf9] hover:bg-[#f7f5f0] disabled:opacity-50 text-[#2c3e35] text-xs font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#b89753]" />
                      <span>Usar melodía integrada</span>
                    </button>
                  </div>

                  {audioMediaError && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                      {audioMediaError}
                    </p>
                  )}

                  {audioMediaSuccess && (
                    <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{audioMediaSuccess}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB: WEDDING DATE, EVENTS, PARENTS & GODPARENTS */}
            {activeTab === 'wedding' && (
              <form
                onSubmit={handleSaveWeddingDetails}
                className="space-y-6 max-w-4xl"
              >
                {/* Wedding Date Card */}
                <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#f7f5f0] border border-[#b89753]/30 text-[#b89753] flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                        Fecha Oficial del Evento
                      </p>
                      <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                        Fecha de la Boda
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <label
                        htmlFor="weddingDateISOInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1.5"
                      >
                        Selecciona la fecha de la boda
                      </label>
                      <input
                        id="weddingDateISOInput"
                        type="date"
                        required
                        value={weddingDateISO}
                        onChange={(e) => setWeddingDateISO(e.target.value)}
                        className="w-full h-11 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3.5 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>
                    <div className="rounded-xl bg-[#f7f5f0] border border-[#b89753]/25 p-3.5">
                      <p className="text-[11px] uppercase tracking-wider text-[#2c3e35]/60">
                        Vista previa en invitación y calendario
                      </p>
                      <p className="mt-1 font-serif text-lg font-semibold text-[#2c3e35]">
                        {formatWeddingEventDateLabel(weddingDateISO)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#b89753]/20">
                    <button
                      type="button"
                      onClick={() => void persistWeddingSection('date')}
                      disabled={savingSectionKey === 'date'}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                    >
                      {savingSectionKey === 'date' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b89753]" />
                      ) : (
                        <Save className="w-3.5 h-3.5 text-[#b89753]" />
                      )}
                      <span>Guardar Fecha</span>
                    </button>
                    {savedSectionKey === 'date' && (
                      <span className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Fecha de la boda guardada en la invitación
                      </span>
                    )}
                  </div>
                  {sectionSaveErrors.date && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                      {sectionSaveErrors.date}
                    </p>
                  )}
                </div>

                {/* Ceremony & Reception Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Ceremonia Religiosa */}
                  <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#f7f5f0] border border-[#b89753]/30 text-[#b89753] flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                          Itinerario 1
                        </p>
                        <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                          Ceremonia Religiosa
                        </h3>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="ceremonyTimeInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1"
                      >
                        Hora ({formatTime12h(ceremonyTime, '16:00')})
                      </label>
                      <input
                        id="ceremonyTimeInput"
                        type="time"
                        required
                        value={ceremonyTime}
                        onChange={(e) => setCeremonyTime(e.target.value)}
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="ceremonyVenueInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1"
                      >
                        Lugar / Iglesia o Parroquia
                      </label>
                      <input
                        id="ceremonyVenueInput"
                        type="text"
                        required
                        maxLength={120}
                        value={ceremonyVenue}
                        onChange={(e) => setCeremonyVenue(e.target.value)}
                        placeholder="Ej. Parroquia Principal"
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="ceremonyAddressInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1"
                      >
                        Dirección
                      </label>
                      <input
                        id="ceremonyAddressInput"
                        type="text"
                        maxLength={200}
                        value={ceremonyAddress}
                        onChange={(e) => setCeremonyAddress(e.target.value)}
                        placeholder="Ej. Centro Histórico, San Salvador"
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="ceremonyMapUrlInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1 flex items-center gap-1"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#b89753]" />
                        <span>Enlace Google Maps (opcional)</span>
                      </label>
                      <input
                        id="ceremonyMapUrlInput"
                        type="url"
                        maxLength={500}
                        value={ceremonyMapUrl}
                        onChange={(e) => setCeremonyMapUrl(e.target.value)}
                        placeholder="https://maps.google.com/?q=..."
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-xs text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#b89753]/20">
                      <button
                        type="button"
                        onClick={() => void persistWeddingSection('ceremony')}
                        disabled={savingSectionKey === 'ceremony'}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                      >
                        {savingSectionKey === 'ceremony' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b89753]" />
                        ) : (
                          <Save className="w-3.5 h-3.5 text-[#b89753]" />
                        )}
                        <span>Guardar Ceremonia</span>
                      </button>
                      {savedSectionKey === 'ceremony' && (
                        <span className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Ceremonia guardada
                        </span>
                      )}
                    </div>
                    {sectionSaveErrors.ceremony && (
                      <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                        {sectionSaveErrors.ceremony}
                      </p>
                    )}
                  </div>

                  {/* Recepción */}
                  <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#f7f5f0] border border-[#b89753]/30 text-[#b89753] flex items-center justify-center shrink-0">
                        <Utensils className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                          Itinerario 2
                        </p>
                        <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                          Recepción
                        </h3>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="receptionTimeInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1"
                      >
                        Hora ({formatTime12h(receptionTime, '19:00')})
                      </label>
                      <input
                        id="receptionTimeInput"
                        type="time"
                        required
                        value={receptionTime}
                        onChange={(e) => setReceptionTime(e.target.value)}
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="receptionVenueInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1"
                      >
                        Lugar / Salón de Recepción
                      </label>
                      <input
                        id="receptionVenueInput"
                        type="text"
                        required
                        maxLength={120}
                        value={receptionVenue}
                        onChange={(e) => setReceptionVenue(e.target.value)}
                        placeholder="Ej. Salón de Eventos Elegance"
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="receptionAddressInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1"
                      >
                        Dirección
                      </label>
                      <input
                        id="receptionAddressInput"
                        type="text"
                        maxLength={200}
                        value={receptionAddress}
                        onChange={(e) => setReceptionAddress(e.target.value)}
                        placeholder="Ej. Zona Escalón, San Salvador"
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="receptionMapUrlInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1 flex items-center gap-1"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#b89753]" />
                        <span>Enlace Google Maps (opcional)</span>
                      </label>
                      <input
                        id="receptionMapUrlInput"
                        type="url"
                        maxLength={500}
                        value={receptionMapUrl}
                        onChange={(e) => setReceptionMapUrl(e.target.value)}
                        placeholder="https://maps.google.com/?q=..."
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-xs text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#b89753]/20">
                      <button
                        type="button"
                        onClick={() => void persistWeddingSection('reception')}
                        disabled={savingSectionKey === 'reception'}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                      >
                        {savingSectionKey === 'reception' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b89753]" />
                        ) : (
                          <Save className="w-3.5 h-3.5 text-[#b89753]" />
                        )}
                        <span>Guardar Recepción</span>
                      </button>
                      {savedSectionKey === 'reception' && (
                        <span className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Recepción guardada
                        </span>
                      )}
                    </div>
                    {sectionSaveErrors.reception && (
                      <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                        {sectionSaveErrors.reception}
                      </p>
                    )}
                  </div>
                </div>

                {/* Parents Card */}
                <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-xs space-y-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                      Sección Familiar
                    </p>
                    <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                      Nuestros Padres
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="brideParentsInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1"
                      >
                        Padres de la Novia
                      </label>
                      <input
                        id="brideParentsInput"
                        type="text"
                        required
                        maxLength={160}
                        value={brideParents}
                        onChange={(e) => setBrideParents(e.target.value)}
                        placeholder="Nombre de los padres de la novia"
                        className="w-full h-11 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3.5 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="groomParentsInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1"
                      >
                        Padres del Novio
                      </label>
                      <input
                        id="groomParentsInput"
                        type="text"
                        required
                        maxLength={160}
                        value={groomParents}
                        onChange={(e) => setGroomParents(e.target.value)}
                        placeholder="Nombre de los padres del novio"
                        className="w-full h-11 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3.5 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#b89753]/20">
                    <button
                      type="button"
                      onClick={() => void persistWeddingSection('parents')}
                      disabled={savingSectionKey === 'parents'}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                    >
                      {savingSectionKey === 'parents' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b89753]" />
                      ) : (
                        <Save className="w-3.5 h-3.5 text-[#b89753]" />
                      )}
                      <span>Guardar Padres</span>
                    </button>
                    {savedSectionKey === 'parents' && (
                      <span className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Nombres de los padres guardados
                      </span>
                    )}
                  </div>
                  {sectionSaveErrors.parents && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                      {sectionSaveErrors.parents}
                    </p>
                  )}
                </div>

                {/* Godparents Card */}
                <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                        Corte de Honor (máximo 12)
                      </p>
                      <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                        Corte de Padrinos
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setGodparentsList(DEFAULT_GODPARENTS_LIST)}
                        className="px-3.5 py-2 rounded-full border border-[#b89753]/40 text-xs font-semibold text-[#2c3e35] hover:bg-[#f7f5f0] cursor-pointer"
                      >
                        Restaurar iniciales
                      </button>
                      <button
                        type="button"
                        disabled={godparentsList.length >= 12}
                        onClick={handleAddGodparentRow}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#b89753]" />
                        <span>Agregar Padrino</span>
                      </button>
                    </div>
                  </div>

                  {godparentsList.length === 0 ? (
                    <p className="text-xs text-[#2c3e35]/65 italic py-4 text-center">
                      No hay padrinos en la lista. Haz clic en &ldquo;Agregar
                      Padrino&rdquo; para añadir uno.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {godparentsList.map((item, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center bg-[#f7f5f0] border border-[#b89753]/25 rounded-xl p-3"
                        >
                          <div className="sm:col-span-5">
                            <label
                              htmlFor={`godparent-role-${idx}`}
                              className="block text-[11px] font-medium text-[#2c3e35]/70 mb-1"
                            >
                              Rol / Título
                            </label>
                            <input
                              id={`godparent-role-${idx}`}
                              type="text"
                              maxLength={100}
                              value={item.roleName}
                              onChange={(e) =>
                                handleUpdateGodparentRow(
                                  idx,
                                  'roleName',
                                  e.target.value
                                )
                              }
                              placeholder="Ej. Padrinos de Anillos"
                              className="w-full h-10 bg-white border border-[#b89753]/35 rounded-lg px-3 text-xs font-semibold text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                            />
                          </div>

                          <div className="sm:col-span-5">
                            <label
                              htmlFor={`godparent-names-${idx}`}
                              className="block text-[11px] font-medium text-[#2c3e35]/70 mb-1"
                            >
                              Nombre(s) de los Padrinos
                            </label>
                            <input
                              id={`godparent-names-${idx}`}
                              type="text"
                              maxLength={160}
                              value={item.names}
                              onChange={(e) =>
                                handleUpdateGodparentRow(
                                  idx,
                                  'names',
                                  e.target.value
                                )
                              }
                              placeholder="Ej. Sr. Roberto Mendoza & Sra. Elena Benítez"
                              className="w-full h-10 bg-white border border-[#b89753]/35 rounded-lg px-3 text-xs text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                            />
                          </div>

                          <div className="sm:col-span-2 flex items-center justify-end gap-1.5 sm:pt-4">
                            <button
                              type="button"
                              onClick={() => void persistWeddingSection(`godparent-${idx}`, idx)}
                              disabled={savingSectionKey === `godparent-${idx}`}
                              title={`Guardar este padrino (${idx + 1})`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#b89753]/40 bg-white hover:bg-[#f7f5f0] text-[#2c3e35] text-xs font-semibold cursor-pointer whitespace-nowrap"
                            >
                              {savingSectionKey === `godparent-${idx}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b89753]" />
                              ) : (
                                <Save className="w-3.5 h-3.5 text-[#b89753]" />
                              )}
                              <span className="hidden sm:inline">Guardar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveGodparentRow(idx)}
                              aria-label={`Eliminar padrino ${idx + 1}`}
                              className="p-1.5 rounded-lg text-[#2c3e35]/55 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {savedSectionKey === `godparent-${idx}` && (
                            <div className="sm:col-span-12">
                              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Padrino #{idx + 1} guardado en la invitación
                              </span>
                            </div>
                          )}

                          {sectionSaveErrors[`godparent-${idx}`] && (
                            <div className="sm:col-span-12">
                              <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                                {sectionSaveErrors[`godparent-${idx}`]}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#b89753]/20">
                    <button
                      type="button"
                      onClick={() => void persistWeddingSection('godparents')}
                      disabled={savingSectionKey === 'godparents'}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      {savingSectionKey === 'godparents' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b89753]" />
                      ) : (
                        <Save className="w-3.5 h-3.5 text-[#b89753]" />
                      )}
                      <span>Guardar Corte de Padrinos</span>
                    </button>
                    {savedSectionKey === 'godparents' && (
                      <span className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Corte de Padrinos guardada en la invitación ({godparentsList.filter((g) => g.roleName.trim() && g.names.trim()).length} padrinos)
                      </span>
                    )}
                  </div>
                  {sectionSaveErrors.godparents && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                      {sectionSaveErrors.godparents}
                    </p>
                  )}
                </div>

                {/* Gift Registry & Lluvia de Sobres Card */}
                <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#f7f5f0] border border-[#b89753]/30 text-[#b89753] flex items-center justify-center shrink-0">
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                        Obsequios y Transferencias
                      </p>
                      <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                        Mesa de Regalos &amp; Lluvia de Sobres
                      </h3>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="giftEnvelopeNoteInput"
                      className="block text-xs font-medium text-[#2c3e35] mb-1"
                    >
                      Mensaje de Lluvia de Sobres en Recepción
                    </label>
                    <textarea
                      id="giftEnvelopeNoteInput"
                      rows={2}
                      maxLength={300}
                      value={giftEnvelopeNote}
                      onChange={(e) => setGiftEnvelopeNote(e.target.value)}
                      placeholder="Ej. Tendremos un cofre dispuesto en la entrada del salón..."
                      className="w-full bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3.5 py-2.5 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="giftBankNameInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1"
                      >
                        Banco / Título de Transferencia
                      </label>
                      <input
                        id="giftBankNameInput"
                        type="text"
                        maxLength={80}
                        value={giftBankName}
                        onChange={(e) => setGiftBankName(e.target.value)}
                        placeholder="Ej. Banco Agrícola · Transferencia Bancaria"
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="giftAccountHolderInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1"
                      >
                        A nombre de (Titular)
                      </label>
                      <input
                        id="giftAccountHolderInput"
                        type="text"
                        maxLength={120}
                        value={giftAccountHolder}
                        onChange={(e) => setGiftAccountHolder(e.target.value)}
                        placeholder="Ej. Jorge Luis Rodas Benítez"
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="giftAccountTypeInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1"
                      >
                        Tipo de Cuenta (opcional)
                      </label>
                      <input
                        id="giftAccountTypeInput"
                        type="text"
                        maxLength={60}
                        value={giftAccountType}
                        onChange={(e) => setGiftAccountType(e.target.value)}
                        placeholder="Ej. Cuenta de Ahorro"
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="giftAccountNumberInput"
                        className="block text-xs font-medium text-[#2c3e35] mb-1"
                      >
                        Número de Cuenta
                      </label>
                      <input
                        id="giftAccountNumberInput"
                        type="text"
                        inputMode="text"
                        maxLength={60}
                        value={giftAccountNumber}
                        onChange={(e) => setGiftAccountNumber(e.target.value)}
                        placeholder="Ej. 0014-8920-3411-7890"
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm font-mono text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>
                  </div>

                  {/* Gift QR Upload or Link */}
                  <div className="rounded-xl bg-[#f7f5f0] border border-[#b89753]/25 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-[#b89753]" />
                      <p className="text-xs font-semibold text-[#2c3e35]">
                        Código QR de la Cuenta o Pago Digital (Opcional)
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="md:col-span-8 space-y-3">
                        <div>
                          <label
                            htmlFor="giftQrValueInput"
                            className="block text-[11px] font-medium text-[#2c3e35]/80 mb-1"
                          >
                            Enlace de pago o texto del QR (genera QR automático)
                          </label>
                          <input
                            id="giftQrValueInput"
                            type="text"
                            maxLength={500}
                            value={giftQrValue}
                            onChange={(e) => setGiftQrValue(e.target.value)}
                            placeholder="https://... o código de transferencia rápida"
                            className="w-full h-10 bg-white border border-[#b89753]/35 rounded-xl px-3 text-xs text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-[#b89753]/45 hover:border-[#b89753] text-xs font-semibold text-[#2c3e35] cursor-pointer">
                            {isCompressingGiftQr ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b89753]" />
                            ) : (
                              <Upload className="w-3.5 h-3.5 text-[#b89753]" />
                            )}
                            <span>
                              {giftQrImage
                                ? 'Cambiar imagen de QR bancario'
                                : 'Subir imagen de QR bancario'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleGiftQrFileChange}
                              className="sr-only"
                            />
                          </label>

                          {giftQrImage && (
                            <button
                              type="button"
                              onClick={() => setGiftQrImage('')}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold cursor-pointer hover:bg-rose-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Quitar imagen QR</span>
                            </button>
                          )}
                        </div>

                        {giftQrError && (
                          <p className="text-xs text-rose-700">{giftQrError}</p>
                        )}
                      </div>

                      <div className="md:col-span-4 flex justify-center">
                        {giftQrImage ? (
                          <div className="p-2.5 rounded-xl bg-white border border-[#b89753]/35 shadow-2xs text-center">
                            <img
                              src={giftQrImage}
                              alt="Vista previa QR bancario"
                              className="w-28 h-28 object-contain mx-auto"
                            />
                            <p className="text-[10px] text-[#2c3e35]/60 mt-1">
                              Imagen QR cargada
                            </p>
                          </div>
                        ) : giftQrValue.trim() ? (
                          <div className="p-2.5 rounded-xl bg-white border border-[#b89753]/35 shadow-2xs text-center">
                            <QRCodeSVG
                              value={giftQrValue.trim()}
                              size={108}
                              bgColor="#ffffff"
                              fgColor="#2c3e35"
                              level="M"
                            />
                            <p className="text-[10px] text-[#2c3e35]/60 mt-1">
                              QR generado
                            </p>
                          </div>
                        ) : (
                          <div className="w-32 h-32 rounded-xl border border-dashed border-[#b89753]/40 bg-white/60 flex flex-col items-center justify-center text-center p-2">
                            <QrCode className="w-6 h-6 text-[#b89753]/60 mb-1" />
                            <span className="text-[10px] text-[#2c3e35]/55">
                              Sin QR configurado
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#b89753]/20">
                    <button
                      type="button"
                      onClick={() => void persistWeddingSection('gifts')}
                      disabled={savingSectionKey === 'gifts'}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      {savingSectionKey === 'gifts' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b89753]" />
                      ) : (
                        <Save className="w-3.5 h-3.5 text-[#b89753]" />
                      )}
                      <span>Guardar Mesa de Regalos &amp; Lluvia de Sobres</span>
                    </button>
                    {savedSectionKey === 'gifts' && (
                      <span className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Datos de regalos y transferencias guardados
                      </span>
                    )}
                  </div>
                  {sectionSaveErrors.gifts && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                      {sectionSaveErrors.gifts}
                    </p>
                  )}
                </div>

                {weddingDetailsError && (
                  <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                    {weddingDetailsError}
                  </p>
                )}

                {weddingDetailsSaved && (
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Fecha, eventos, padres, padrinos y mesa de regalos actualizados en la invitación.
                    </span>
                  </p>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={savingWeddingDetails}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#b89753] hover:bg-[#967739] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                  >
                    {savingWeddingDetails ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Guardar Datos de la Boda</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB: GUEST QUOTAS & BUDGET CONTROL */}
            {activeTab === 'quotas' && (
              <div className="space-y-6">
                {/* Budget & Quota KPI Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-[#b89753]/25 rounded-2xl p-4">
                    <p className="text-[11px] uppercase tracking-wider text-[#2c3e35]/55">
                      Invitados en Lista
                    </p>
                    <p className="mt-1 font-serif text-2xl font-semibold text-[#2c3e35] tabular-nums">
                      {quotaStats.totalFamilies}{' '}
                      <span className="text-xs font-sans font-normal text-[#2c3e35]/60">
                        ({quotaStats.confirmedFamilies} conf ·{' '}
                        {quotaStats.pendingFamilies} pend)
                      </span>
                    </p>
                  </div>
                  <div className="bg-white border border-[#b89753]/25 rounded-2xl p-4">
                    <p className="text-[11px] uppercase tracking-wider text-[#2c3e35]/55">
                      Sillas Asignadas en Lista
                    </p>
                    <p className="mt-1 font-serif text-2xl font-semibold text-[#b89753] tabular-nums">
                      {quotaStats.assignedChairs}{' '}
                      <span className="text-xs font-sans font-normal text-[#2c3e35]/60">
                        de {totalTables * 10} en {totalTables} mesas
                      </span>
                    </p>
                  </div>
                  <div className="bg-white border border-[#b89753]/25 rounded-2xl p-4">
                    <p className="text-[11px] uppercase tracking-wider text-[#2c3e35]/55">
                      Platos de Adulto
                    </p>
                    <p className="mt-1 font-serif text-2xl font-semibold text-[#2c3e35] tabular-nums">
                      {quotaStats.assignedAdultPlates}{' '}
                      <span className="text-xs font-sans font-normal text-[#2c3e35]/60">
                        {budgetAdultPlates > 0
                          ? `/ ${budgetAdultPlates} presup.`
                          : 'asignados'}{' '}
                        · {stats.totalAdults} conf.
                      </span>
                    </p>
                  </div>
                  <div className="bg-white border border-[#b89753]/25 rounded-2xl p-4">
                    <p className="text-[11px] uppercase tracking-wider text-[#2c3e35]/55">
                      Platos de Niño
                    </p>
                    <p className="mt-1 font-serif text-2xl font-semibold text-[#2c3e35] tabular-nums">
                      {quotaStats.assignedKidPlates}{' '}
                      <span className="text-xs font-sans font-normal text-[#2c3e35]/60">
                        {budgetKidPlates > 0
                          ? `/ ${budgetKidPlates} presup.`
                          : 'asignados'}{' '}
                        · {stats.totalKids} conf.
                      </span>
                    </p>
                  </div>
                </div>

                {/* Single Guest Quota Add / Edit Card */}
                <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[#b89753] font-semibold">
                        Control de Presupuesto por Teléfono
                      </p>
                      <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                        {editingPhoneKey
                          ? 'Editar Invitado y Cupo Asignado'
                          : 'Registrar Invitado Nuevo en Lista Oficial'}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowBulkImport((prev) => !prev)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#b89753]/45 bg-[#fcfbf9] hover:bg-[#f7f5f0] text-[#2c3e35] text-xs font-semibold cursor-pointer self-start sm:self-center"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#b89753]" />
                      <span>
                        {showBulkImport
                          ? 'Ocultar Importador Masivo'
                          : 'Importar Listado (CSV / Excel)'}
                      </span>
                    </button>
                  </div>

                  {showBulkImport && (
                    <div className="rounded-xl bg-[#f7f5f0] border border-[#b89753]/30 p-4 sm:p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#2c3e35]">
                            Importación Masiva desde Excel o CSV
                          </p>
                          <p className="text-xs text-[#2c3e35]/70">
                            Formato por línea:{' '}
                            <code>
                              Nombre, Teléfono, Adultos, Niños, Bebés, Vínculo,
                              Mesa, Notas
                            </code>
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-[#b89753]/40 text-xs font-semibold text-[#2c3e35] cursor-pointer hover:border-[#b89753] self-start">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-[#b89753]" />
                          <span>Cargar archivo .csv</span>
                          <input
                            type="file"
                            accept=".csv,.txt"
                            onChange={handleBulkCsvFile}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <textarea
                        rows={5}
                        value={bulkImportText}
                        onChange={(e) => setBulkImportText(e.target.value)}
                        placeholder={
                          'Ejemplo:\nFamilia Rodas, +503 76874760, 2, 1, 0, Familiar del Novio, 1\nCarlos Méndez, 78249210, 1, 0, 0, Amigo de la Novia, 0'
                        }
                        className="w-full bg-white border border-[#b89753]/35 rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />

                      {bulkImportMessage && (
                        <p className="text-xs font-medium text-[#2c3e35] bg-white border border-[#b89753]/30 rounded-lg px-3 py-2">
                          {bulkImportMessage}
                        </p>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={isImportingBulk}
                          onClick={() => void handleBulkImportSubmit()}
                          className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                        >
                          {isImportingBulk ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5 text-[#b89753]" />
                          )}
                          <span>
                            {isImportingBulk
                              ? 'Importando...'
                              : 'Importar Listado a la Nube'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSaveQuota} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label
                          htmlFor="quotaGuestNameInput"
                          className="block text-xs font-medium text-[#2c3e35] mb-1"
                        >
                          Nombre / Familia
                        </label>
                        <input
                          id="quotaGuestNameInput"
                          type="text"
                          required
                          maxLength={120}
                          value={quotaGuestName}
                          onChange={(e) => setQuotaGuestName(e.target.value)}
                          placeholder="Ej. Familia Rodas"
                          className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="quotaPhoneInput"
                          className="block text-xs font-medium text-[#2c3e35] mb-1"
                        >
                          Teléfono autorizado
                        </label>
                        <input
                          id="quotaPhoneInput"
                          type="tel"
                          inputMode="tel"
                          required
                          maxLength={30}
                          value={quotaPhone}
                          onChange={(e) => setQuotaPhone(e.target.value)}
                          placeholder="Ej. +503 7687-4760"
                          className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="quotaGroupInput"
                          className="block text-xs font-medium text-[#2c3e35] mb-1"
                        >
                          Vínculo con los Novios
                        </label>
                        <select
                          id="quotaGroupInput"
                          value={quotaGuestGroup}
                          onChange={(e) =>
                            setQuotaGuestGroup(
                              e.target.value as GuestRelationGroup | ''
                            )
                          }
                          className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                        >
                          <option value="">Sin pre-asignar</option>
                          {GUEST_RELATION_GROUPS.map((group) => (
                            <option key={group.value} value={group.value}>
                              {group.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="assignmentStrategyInput"
                          className="block text-xs font-medium text-[#2c3e35] mb-1"
                        >
                          Estrategia de Asignación
                        </label>
                        <select
                          id="assignmentStrategyInput"
                          value={assignmentMode}
                          onChange={(e) => {
                            const mode = e.target.value as 'auto_novio' | 'auto_novia' | 'manual';
                            setAssignmentMode(mode);
                            if (mode === 'auto_novio') {
                              setQuotaGuestGroup('familiar_novio');
                              setQuotaAssignedTable(0);
                            } else if (mode === 'auto_novia') {
                              setQuotaGuestGroup('familiar_novia');
                              setQuotaAssignedTable(0);
                            } else {
                              if (quotaAssignedTable === 0) setQuotaAssignedTable(1);
                            }
                          }}
                          className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                        >
                          <option value="auto_novio">Automática (Novio)</option>
                          <option value="auto_novia">Automática (Novia)</option>
                          <option value="manual">Manual (Elegir Mesa)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                      <div>
                        <label
                          htmlFor="quotaAdultsInput"
                          className="block text-xs font-medium text-[#2c3e35] mb-1"
                        >
                          Platos Adulto
                        </label>
                        <NumericInput
                          id="quotaAdultsInput"
                          min={1}
                          max={10}
                          defaultValue={1}
                          value={quotaMaxAdults}
                          onCommit={setQuotaMaxAdults}
                          className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] tabular-nums focus:outline-none focus:border-[#b89753]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="quotaKidsInput"
                          className="block text-xs font-medium text-[#2c3e35] mb-1"
                        >
                          Platos Niño
                        </label>
                        <NumericInput
                          id="quotaKidsInput"
                          min={0}
                          max={8}
                          defaultValue={0}
                          value={quotaMaxKids}
                          onCommit={setQuotaMaxKids}
                          className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] tabular-nums focus:outline-none focus:border-[#b89753]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="quotaBabiesInput"
                          className="block text-xs font-medium text-[#2c3e35] mb-1"
                        >
                          Bebés (regazo)
                        </label>
                        <NumericInput
                          id="quotaBabiesInput"
                          min={0}
                          max={5}
                          defaultValue={0}
                          value={quotaMaxBabies}
                          onCommit={setQuotaMaxBabies}
                          className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] tabular-nums focus:outline-none focus:border-[#b89753]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="quotaTableInput"
                          className="block text-xs font-medium text-[#2c3e35] mb-1"
                        >
                          {assignmentMode === 'manual'
                            ? 'Seleccionar Mesa Disponible'
                            : 'Mesa (Auto)'}
                        </label>
                        {assignmentMode === 'manual' ? (
                          <select
                            id="quotaTableInput"
                            value={quotaAssignedTable}
                            onChange={(e) =>
                              setQuotaAssignedTable(Number(e.target.value))
                            }
                            className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                          >
                            <option value={0}>-- Selecciona una mesa --</option>
                            {adminTablesSummary.map((t) => {
                              const remaining = Math.max(
                                0,
                                t.capacity - t.occupied
                              );
                              return (
                                <option key={t.tableNumber} value={t.tableNumber}>
                                  Mesa #{t.tableNumber} ({t.occupied}/{t.capacity}{' '}
                                  ocupados · {remaining} libres)
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <div className="w-full h-10 bg-[#f7f5f0] border border-[#b89753]/30 rounded-xl px-3 flex items-center text-xs text-[#2c3e35]/70 font-medium">
                            Asignación automática por afinidad
                          </div>
                        )}
                      </div>

                      <div className="col-span-2 sm:col-span-1 rounded-xl bg-[#f7f5f0] border border-[#b89753]/25 h-10 px-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#2c3e35] tabular-nums">
                        <Utensils className="w-3.5 h-3.5 text-[#b89753]" />
                        <span>{quotaMaxAdults + quotaMaxKids} sillas</span>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        maxLength={300}
                        value={quotaNotes}
                        onChange={(e) => setQuotaNotes(e.target.value)}
                        placeholder="Notas internas opcionales (ej. invitado agregado por llamada)"
                        className="w-full h-10 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-3 text-xs text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                      />
                    </div>

                    {quotaFormError && (
                      <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2">
                        {quotaFormError}
                      </p>
                    )}

                    {quotaFormSuccess && (
                      <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{quotaFormSuccess}</span>
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="submit"
                        disabled={savingQuota}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#b89753] hover:bg-[#967739] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                      >
                        {savingQuota ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {editingPhoneKey
                            ? 'Guardar Cambios'
                            : 'Agregar Invitado a la Lista'}
                        </span>
                      </button>

                      {editingPhoneKey && (
                        <button
                          type="button"
                          onClick={resetQuotaForm}
                          className="px-4 py-2.5 rounded-full border border-[#b89753]/45 text-xs font-semibold text-[#2c3e35] hover:bg-[#f7f5f0] cursor-pointer"
                        >
                          Cancelar edición
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Roster Table */}
                <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 bg-[#fcfbf9] border border-[#b89753]/30 rounded-xl px-3.5 py-2 flex-1 max-w-md">
                      <Search className="w-4 h-4 text-[#b89753] shrink-0" />
                      <input
                        type="text"
                        value={quotaSearch}
                        onChange={(e) => setQuotaSearch(e.target.value)}
                        placeholder="Buscar por nombre, teléfono o vínculo..."
                        className="w-full bg-transparent text-sm text-[#2c3e35] focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-[#f7f5f0] rounded-lg self-start">
                      {(
                        [
                          ['all', 'Todos'],
                          ['pending', 'Pendientes'],
                          ['confirmed', 'Confirmados'],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setQuotaStatusFilter(key)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                            quotaStatusFilter === key
                              ? 'bg-white text-[#2c3e35] shadow-xs'
                              : 'text-[#2c3e35]/65'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredQuotas.length === 0 ? (
                    <div className="py-12 text-center text-sm text-[#2c3e35]/60">
                      <UserPlus className="w-7 h-7 text-[#b89753] mx-auto mb-2" />
                      Aún no hay invitados registrados en la lista oficial.
                      Agrega uno arriba o importa tu CSV.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-[#b89753]/25 text-xs uppercase tracking-wider text-[#2c3e35]/60">
                            <th className="py-3 pr-4 font-semibold">
                              Invitado / Familia
                            </th>
                            <th className="py-3 px-4 font-semibold">
                              Teléfono
                            </th>
                            <th className="py-3 px-4 font-semibold">
                              Sillas y Platos
                            </th>
                            <th className="py-3 px-4 font-semibold">Mesa</th>
                            <th className="py-3 px-4 font-semibold">Estado</th>
                            <th className="py-3 pl-4 text-right font-semibold">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#b89753]/15">
                          {filteredQuotas.map((item) => (
                            <tr key={item.phoneKey} className="align-top">
                              <td className="py-3 pr-4">
                                <p className="font-semibold text-[#2c3e35]">
                                  {item.guestName}
                                </p>
                                <p className="text-xs text-[#b89753]">
                                  {item.guestGroup
                                    ? getGuestRelationLabel(item.guestGroup)
                                    : 'Vínculo sin pre-asignar'}
                                </p>
                                {item.notes && (
                                  <p className="text-[11px] text-[#2c3e35]/60 italic mt-0.5">
                                    {item.notes}
                                  </p>
                                )}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap text-xs font-medium text-[#2c3e35] tabular-nums">
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-3 h-3 text-[#b89753]" />
                                  <span>{item.phoneDisplay}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap text-xs text-[#2c3e35]/80 tabular-nums">
                                <span className="font-semibold text-[#2c3e35]">
                                  {item.maxAdults + item.maxKids} sillas
                                </span>{' '}
                                · {item.maxAdults} ad · {item.maxKids} niñ
                                {item.maxBabies > 0
                                  ? ` · ${item.maxBabies} bb`
                                  : ''}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap text-xs text-[#2c3e35] tabular-nums">
                                {item.assignedTable > 0
                                  ? `Mesa #${item.assignedTable}`
                                  : 'Automática'}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`text-xs font-semibold ${
                                    item.confirmed
                                      ? 'text-emerald-800'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {item.confirmed ? 'Confirmado' : 'Pendiente'}
                                </span>
                              </td>
                              <td className="py-3 pl-4 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditQuota(item)}
                                    title="Editar cupo o datos"
                                    aria-label={`Editar cupo de ${item.guestName}`}
                                    className="p-1.5 rounded-lg text-[#2c3e35]/65 hover:text-[#b89753] hover:bg-[#f7f5f0] cursor-pointer"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  {item.confirmed && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleReopenQuota(item)
                                      }
                                      title="Reabrir cupo para permitir nueva confirmación"
                                      aria-label={`Reabrir cupo de ${item.guestName}`}
                                      className="p-1.5 rounded-lg text-[#2c3e35]/65 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleDeleteQuota(item.phoneKey)
                                    }
                                    title="Eliminar de la lista oficial"
                                    aria-label={`Eliminar cupo de ${item.guestName}`}
                                    className="p-1.5 rounded-lg text-[#2c3e35]/50 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 1: RSVPS REPORT & SEATING DETAILS */}
            {activeTab === 'rsvps' && (
              <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 bg-[#fcfbf9] border border-[#b89753]/30 rounded-xl px-3.5 py-2 flex-1 max-w-md">
                    <Search className="w-4 h-4 text-[#b89753] shrink-0" />
                    <input
                      type="text"
                      value={rsvpSearch}
                      onChange={(e) => setRsvpSearch(e.target.value)}
                      placeholder="Buscar invitado, mesa, teléfono o nota..."
                      className="w-full bg-transparent text-sm text-[#2c3e35] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-[#f7f5f0] rounded-lg self-start">
                    {(
                      [
                        ['all', 'Todos'],
                        ['yes', 'Confirmados'],
                        ['no', 'No asisten'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRsvpFilter(key)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                          rsvpFilter === key
                            ? 'bg-white text-[#2c3e35] shadow-xs'
                            : 'text-[#2c3e35]/65'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredRsvps.length === 0 ? (
                  <div className="py-12 text-center text-sm text-[#2c3e35]/60">
                    <Users className="w-7 h-7 text-[#b89753] mx-auto mb-2" />
                    Aún no hay confirmaciones registradas con ese filtro.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-[#b89753]/25 text-xs uppercase tracking-wider text-[#2c3e35]/60">
                          <th className="py-3 pr-4 font-semibold">Invitado</th>
                          <th className="py-3 px-4 font-semibold">
                            Grupo / Vínculo
                          </th>
                          <th className="py-3 px-4 font-semibold">Estado</th>
                          <th className="py-3 px-4 font-semibold">
                            Desglose
                          </th>
                          <th className="py-3 px-4 font-semibold">
                            Mesa Asignada
                          </th>
                          <th className="py-3 px-4 font-semibold">
                            Contacto y Notas
                          </th>
                          <th className="py-3 pl-4 text-right font-semibold">
                            Acción
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#b89753]/15">
                        {filteredRsvps.map((r) => {
                          return (
                            <tr key={r.id} className="align-top">
                              <td className="py-3.5 pr-4">
                                <p className="font-semibold text-[#2c3e35]">
                                  {r.guestName}
                                </p>
                                <p className="text-xs text-[#2c3e35]/55 mt-0.5">
                                  {formatRsvpDate(r.createdAt)}
                                </p>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <select
                                  aria-label={`Grupo de ${r.guestName}`}
                                  value={r.guestGroup ?? ''}
                                  onChange={(e) =>
                                    void handleGuestGroupChange(
                                      r,
                                      e.target.value as GuestRelationGroup | ''
                                    )
                                  }
                                  className="h-8 rounded-lg border border-[#b89753]/35 bg-[#fcfbf9] px-2 text-xs font-medium text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                                >
                                  <option value="">Sin clasificar</option>
                                  {GUEST_RELATION_GROUPS.map((group) => (
                                    <option
                                      key={group.value}
                                      value={group.value}
                                    >
                                      {group.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span
                                  className={`text-xs font-semibold ${
                                    r.attending
                                      ? 'text-emerald-800'
                                      : 'text-rose-700'
                                  }`}
                                >
                                  {r.attending ? 'Confirmado' : 'No asiste'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap tabular-nums text-xs text-[#2c3e35]/80">
                                {r.attending ? (
                                  <>
                                    {r.adults} ad · {r.kids} niñ
                                    {r.babies > 0 ? ` · ${r.babies} bb` : ''}
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {r.attending ? (
                                  <div className="flex items-center gap-1.5">
                                    <label
                                      htmlFor={`mesa-${r.id}`}
                                      className="text-xs text-[#2c3e35]/60"
                                    >
                                      Mesa #
                                    </label>
                                    <NumericInput
                                      id={`mesa-${r.id}`}
                                      min={1}
                                      max={100}
                                      defaultValue={r.tableNumber}
                                      value={r.tableNumber}
                                      onCommit={() => {}}
                                      onBlurCommit={(val) => {
                                        if (val >= 1 && val !== r.tableNumber) {
                                          void handleTableReassign(r, val);
                                        }
                                      }}
                                      className="w-16 h-8 rounded-lg border border-[#b89753]/35 bg-[#fcfbf9] px-2 text-xs font-semibold text-[#2c3e35] tabular-nums"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-xs text-[#2c3e35]/50">
                                    N/A
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 max-w-xs text-xs text-[#2c3e35]/75">
                                {r.phone && (
                                  <p className="font-medium text-[#2c3e35]">
                                    {r.phone}
                                  </p>
                                )}
                                {r.notes && (
                                  <p className="mt-0.5 italic">{r.notes}</p>
                                )}
                                {!r.phone && !r.notes && '—'}
                              </td>
                              <td className="py-3.5 pl-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteRsvp(r)}
                                  aria-label={`Eliminar registro de ${r.guestName}`}
                                  className="p-2 rounded-lg text-[#2c3e35]/50 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PHOTO MODERATION & DOWNLOAD */}
            {activeTab === 'photos' && (
              <div className="space-y-5">
                {/* Google Drive Archive Banner */}
                <div className="bg-white border border-[#b89753]/30 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                      <CloudUpload className="w-4 h-4 shrink-0" />
                      <span>Archivo en Carpeta de Google Drive</span>
                    </div>
                    <p className="text-sm text-[#2c3e35] font-medium">
                      {driveFolderId
                        ? `${driveSyncedIds.size} de ${allPhotos.length} fotografía(s) respaldadas en Google Drive`
                        : 'Configura el enlace de tu carpeta de Google Drive en Ajustes'}
                    </p>
                    {driveToken && driveEmail && (
                      <p className="text-xs text-emerald-800">
                        Google conectado: {driveEmail}
                      </p>
                    )}
                    {driveSyncProgress && (
                      <p className="text-xs text-[#b89753] font-medium flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{driveSyncProgress}</span>
                      </p>
                    )}
                    {driveError && (
                      <p className="text-xs text-rose-700">{driveError}</p>
                    )}
                    {driveStatusMsg && (
                      <p className="text-xs text-emerald-800 font-medium">
                        {driveStatusMsg}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleDownloadAllPhotosZip}
                      disabled={isZipping || allPhotos.length === 0}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#b89753] hover:bg-[#967739] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      {isZipping ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FolderArchive className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isZipping
                          ? 'Comprimiendo...'
                          : `Descargar Todas (.zip · ${allPhotos.length})`}
                      </span>
                    </button>

                    {!driveToken ? (
                      <GoogleSignInButton
                        onClick={() => void handleConnectDrive()}
                        disabled={isConnectingDrive}
                        label={
                          isConnectingDrive
                            ? 'Conectando...'
                            : 'Sign in with Google'
                        }
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmDriveModalOpen(true)}
                          disabled={
                            isSyncingDrive ||
                            !driveFolderId ||
                            pendingDrivePhotos.length === 0
                          }
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          <CloudUpload className="w-3.5 h-3.5 text-[#b89753]" />
                          <span>
                            {pendingDrivePhotos.length === 0
                              ? 'Todo respaldado en Drive'
                              : `Archivar ${pendingDrivePhotos.length} en Google Drive`}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void refreshDriveSyncedFiles()}
                          disabled={isSyncingDrive}
                          aria-label="Actualizar estado de Google Drive"
                          className="p-2.5 rounded-full border border-[#b89753]/35 text-[#2c3e35] hover:bg-[#f7f5f0] cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {googlePhotosUrl && (
                      <a
                        href={googlePhotosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#f7f5f0] border border-[#b89753]/40 text-[#2c3e35] hover:border-[#b89753] text-xs font-semibold whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#b89753]" />
                        <span>Abrir Carpeta Drive</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 shadow-xs">
                  {allPhotos.length === 0 ? (
                    <p className="py-12 text-center text-sm text-[#2c3e35]/60">
                      Aún no hay fotografías en el álbum de la boda.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {allPhotos.map((photo, idx) => {
                        const isArchivedInDrive = driveSyncedIds.has(photo.id);
                        return (
                          <div
                            key={photo.id}
                            className="rounded-xl border border-[#b89753]/25 overflow-hidden bg-[#fcfbf9] flex flex-col"
                          >
                            <div className="aspect-[4/3] bg-[#141d18] relative">
                              <img
                                src={photo.imageData}
                                alt={photo.caption || photo.guestName}
                                className={`w-full h-full object-cover ${
                                  !photo.visible ? 'opacity-45 grayscale' : ''
                                }`}
                              />
                              {isArchivedInDrive && (
                                <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-emerald-900/85 text-white text-[10px] font-semibold">
                                  En Google Drive
                                </span>
                              )}
                            </div>
                            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-[#b89753] truncate">
                                    {photo.guestName}
                                  </p>
                                  <span className="text-[11px] text-[#2c3e35]/60">
                                    {photo.visible
                                      ? 'Visible en vivo'
                                      : 'Oculta'}
                                  </span>
                                </div>
                                {photo.caption && (
                                  <p className="mt-1 text-xs text-[#2c3e35]/80">
                                    {photo.caption}
                                  </p>
                                )}
                              </div>

                              <div className="pt-2 border-t border-[#b89753]/15 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleTogglePhotoVisibility(photo)
                                  }
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2c3e35] hover:text-[#b89753] cursor-pointer"
                                >
                                  {photo.visible ? (
                                    <>
                                      <EyeOff className="w-3.5 h-3.5" />
                                      <span>Ocultar</span>
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Mostrar</span>
                                    </>
                                  )}
                                </button>

                                <div className="flex items-center gap-1.5">
                                  {driveToken &&
                                    driveFolderId &&
                                    !isArchivedInDrive && (
                                      <button
                                        type="button"
                                        disabled={isSyncingDrive}
                                        onClick={() =>
                                          void handleUploadSinglePhotoToDrive(
                                            photo
                                          )
                                        }
                                        aria-label="Enviar fotografía a Google Drive"
                                        title="Enviar a Google Drive"
                                        className="p-1.5 rounded-lg text-[#b89753] hover:bg-white cursor-pointer"
                                      >
                                        <CloudUpload className="w-4 h-4" />
                                      </button>
                                    )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDownloadSinglePhoto(photo, idx)
                                    }
                                    aria-label="Descargar fotografía"
                                    className="p-1.5 rounded-lg text-[#2c3e35]/75 hover:text-[#b89753] hover:bg-white cursor-pointer"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleDeletePhoto(photo.id)
                                    }
                                    aria-label="Eliminar fotografía"
                                    className="p-1.5 rounded-lg text-[#2c3e35]/60 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Explicit Confirmation Dialog for Batch Google Drive Upload */}
                {confirmDriveModalOpen && (
                  <div
                    className="fixed inset-0 z-50 bg-[#2c3e35]/55 backdrop-blur-xs flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setConfirmDriveModalOpen(false)}
                  >
                    <div
                      className="relative max-w-md w-full bg-[#fcfbf9] border border-[#b89753]/40 rounded-2xl p-6 shadow-2xl space-y-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setConfirmDriveModalOpen(false)}
                        aria-label="Cerrar confirmación"
                        className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#2c3e35]/65 hover:bg-[#f7f5f0] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="flex items-center gap-2.5 text-[#b89753]">
                        <CloudUpload className="w-5 h-5" />
                        <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                          Confirmar respaldo en Drive
                        </h3>
                      </div>
                      <p className="text-sm text-[#2c3e35]/80 leading-relaxed">
                        Se subirán{' '}
                        <strong className="text-[#2c3e35]">
                          {pendingDrivePhotos.length} fotografía(s)
                        </strong>{' '}
                        del álbum a tu carpeta compartida de Google Drive (
                        <span className="font-mono text-xs">
                          {driveFolderId}
                        </span>
                        ).
                      </p>
                      <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDriveModalOpen(false)}
                          className="px-4 py-2 rounded-full border border-[#b89753]/45 text-xs font-semibold text-[#2c3e35] hover:bg-[#f7f5f0] cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSyncAllPendingToDrive()}
                          className="px-5 py-2 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] text-white text-xs font-semibold cursor-pointer"
                        >
                          Confirmar Envío
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: GOOGLE PHOTOS / DRIVE LINK & FOTO PARTY SETTINGS */}
            {activeTab === 'settings' && (
              <div className="space-y-6 max-w-3xl">
                <form
                  onSubmit={handleSaveSettings}
                  className="bg-white border border-[#b89753]/30 rounded-2xl p-6 sm:p-8 shadow-xs space-y-5"
                >
                  {/* Hero Couple Photograph Quick Link */}
                  <div className="bg-[#f7f5f0] border border-[#b89753]/35 rounded-xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ImagePlus className="w-4 h-4 text-[#b89753]" />
                        <label
                          htmlFor="heroPhotoUrlInput"
                          className="text-sm font-semibold text-[#2c3e35]"
                        >
                          Portada y Música Ambiental
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('media')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#b89753] hover:bg-[#967739] text-white text-xs font-semibold cursor-pointer self-start"
                      >
                        <Music className="w-3.5 h-3.5" />
                        <span>Subir Fotos y Audio</span>
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {(heroPhotosList.find((p) => p.active)?.imageData ||
                        heroPhotoUrl) && (
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border-2 border-[#b89753] shrink-0 shadow-xs bg-[#141d18]">
                          <img
                            src={
                              heroPhotosList.find((p) => p.active)?.imageData ||
                              heroPhotoUrl
                            }
                            alt="Vista previa novios"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="flex-1 w-full space-y-2">
                        <input
                          id="heroPhotoUrlInput"
                          type="url"
                          maxLength={500}
                          value={heroPhotoUrl}
                          onChange={(e) => setHeroPhotoUrl(e.target.value)}
                          placeholder="https://... enlace de foto de respaldo"
                          className="w-full h-11 bg-white border border-[#b89753]/40 rounded-xl px-4 text-xs text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setHeroPhotoUrl(
                                DEFAULT_WEDDING_CONFIG.heroPhotoUrl ?? ''
                              )
                            }
                            className="text-[11px] text-[#b89753] hover:underline font-semibold cursor-pointer"
                          >
                            Restaurar foto de ejemplo
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#2c3e35]/65">
                      Para subir múltiples imágenes directamente desde tu galería y elegir o subir la canción de fondo, abre la pestaña &ldquo;Portada y Música&rdquo;.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="googlePhotosUrl"
                      className="block text-sm font-medium text-[#2c3e35] mb-1.5"
                    >
                      Carpeta Compartida de Google Drive o Álbum de Google Fotos
                      (Archivo de Fotografías y Videos)
                    </label>
                    <input
                      id="googlePhotosUrl"
                      type="url"
                      maxLength={500}
                      value={googlePhotosUrl}
                      onChange={(e) => setGooglePhotosUrl(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/... o https://photos.app.goo.gl/..."
                      className="w-full h-11 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-4 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                    />
                    <p className="mt-1.5 text-xs text-[#2c3e35]/60">
                      Pega aquí el enlace de la carpeta de Google Drive donde se
                      archivarán las fotografías en calidad original y videos.
                      Aparecerá automáticamente en la sección del Álbum para tus
                      invitados.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="appsScriptUrlInput"
                      className="block text-sm font-medium text-[#2c3e35] mb-1.5"
                    >
                      Endpoint Web App de Google Apps Script (Opcional /
                      Avanzado)
                    </label>
                    <input
                      id="appsScriptUrlInput"
                      type="url"
                      maxLength={500}
                      value={appsScriptUrl}
                      onChange={(e) => setAppsScriptUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full h-11 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-4 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                    />
                    <p className="mt-1.5 text-xs text-[#2c3e35]/60">
                      Ya no necesitas Apps Script: el carrusel carga
                      automáticamente las fotos desde el enlace normal de tu
                      carpeta pública. Usa este campo solo si deseas conectar un
                      endpoint propio <code>/exec</code>.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="welcomeNoteInput"
                      className="block text-sm font-medium text-[#2c3e35] mb-1.5"
                    >
                      Mensaje de bienvenida del Álbum
                    </label>
                    <textarea
                      id="welcomeNoteInput"
                      rows={2}
                      maxLength={300}
                      value={welcomeNote}
                      onChange={(e) => setWelcomeNote(e.target.value)}
                      className="w-full bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-4 py-2.5 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="intervalInput"
                      className="block text-sm font-medium text-[#2c3e35] mb-1.5"
                    >
                      Segundos por foto en el proyector (Foto Party en Vivo)
                    </label>
                    <NumericInput
                      id="intervalInput"
                      min={3}
                      max={30}
                      defaultValue={6}
                      value={intervalSec}
                      onCommit={setIntervalSec}
                      className="w-32 h-11 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-4 text-sm text-[#2c3e35] tabular-nums focus:outline-none focus:border-[#b89753]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="totalTablesInput"
                      className="block text-sm font-medium text-[#2c3e35] mb-1.5"
                    >
                      Total de Mesas en la Boda (Organización del Salón)
                    </label>
                    <div className="flex items-center gap-3">
                      <NumericInput
                        id="totalTablesInput"
                        min={1}
                        max={50}
                        defaultValue={10}
                        value={totalTables}
                        onCommit={setTotalTables}
                        className="w-32 h-11 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-4 text-sm text-[#2c3e35] tabular-nums focus:outline-none focus:border-[#b89753]"
                      />
                      <span className="text-xs text-[#2c3e35]/65">
                        mesas de 10 personas ({totalTables * 10} asientos en total)
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-[#2c3e35]/60">
                      Define cuántas mesas habrá en total en la recepción. Se
                      reflejarán de inmediato en la sección pública de
                      &ldquo;Organización del Salón&rdquo; y en el reporte imprimible
                      de carteles de mesa.
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#f7f5f0] border border-[#b89753]/25 p-4 flex items-start gap-3">
                    <input
                      id="albumEnabledEarlyInput"
                      type="checkbox"
                      checked={albumEnabledEarly}
                      onChange={(e) => setAlbumEnabledEarly(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-[#b89753] rounded cursor-pointer"
                    />
                    <label
                      htmlFor="albumEnabledEarlyInput"
                      className="text-sm text-[#2c3e35] cursor-pointer"
                    >
                      <span className="font-semibold block">
                        Habilitar Álbum de Fotos y Foto Party anticipadamente
                      </span>
                      <span className="text-xs text-[#2c3e35]/70">
                        Por defecto la sección de fotografías se abre
                        automáticamente el día de la boda (
                        {formatWeddingReportDateLabel(weddingDateISO)}). Activa
                        esta opción solo si deseas probarlo o abrirlo antes.
                      </span>
                    </label>
                  </div>

                  <div className="rounded-xl bg-[#f7f5f0] border border-[#b89753]/25 p-4 flex items-start gap-3">
                    <input
                      id="tablesVisibleToGuestsInput"
                      type="checkbox"
                      checked={tablesVisibleToGuests}
                      onChange={(e) => setTablesVisibleToGuests(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-[#b89753] rounded cursor-pointer"
                    />
                    <label
                      htmlFor="tablesVisibleToGuestsInput"
                      className="text-sm text-[#2c3e35] cursor-pointer"
                    >
                      <span className="font-semibold block">
                        Mostrar Organización del Salón (Encuentra tu lugar) a los invitados
                      </span>
                      <span className="text-xs text-[#2c3e35]/70">
                        Por defecto esta sección está oculta para el público y
                        solo es visible para Administradores y el Novio. Marca
                        esta casilla y guarda cuando quieras hacerla visible a
                        todos los invitados.
                      </span>
                    </label>
                  </div>

                  <div className="rounded-xl bg-[#f7f5f0] border border-[#b89753]/25 p-4 sm:p-5 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-[#2c3e35]">
                        Teléfonos de Contacto (Invitados no registrados) y Presupuesto
                      </p>
                      <p className="text-xs text-[#2c3e35]/65 mt-0.5">
                        Se muestran cuando un invitado ingresa un número que no está en la lista oficial.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="adminPhoneInput"
                          className="block text-xs font-medium text-[#2c3e35] mb-1"
                        >
                          Teléfono del Administrador
                        </label>
                        <input
                          id="adminPhoneInput"
                          type="tel"
                          inputMode="tel"
                          maxLength={30}
                          value={adminPhone}
                          onChange={(e) => setAdminPhone(e.target.value)}
                          placeholder="+503 76874760"
                          className="w-full h-10 bg-white border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="groomPhoneInput"
                          className="block text-xs font-medium text-[#2c3e35] mb-1"
                        >
                          Teléfono del Novio
                        </label>
                        <input
                          id="groomPhoneInput"
                          type="tel"
                          inputMode="tel"
                          maxLength={30}
                          value={groomPhone}
                          onChange={(e) => setGroomPhone(e.target.value)}
                          placeholder="+503 78249210"
                          className="w-full h-10 bg-white border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="budgetAdultPlatesInput"
                          className="block text-xs font-medium text-[#2c3e35] mb-1"
                        >
                          Presupuesto Platos Adulto (0 = informativo)
                        </label>
                        <NumericInput
                          id="budgetAdultPlatesInput"
                          min={0}
                          max={1000}
                          defaultValue={0}
                          value={budgetAdultPlates}
                          onCommit={setBudgetAdultPlates}
                          className="w-full h-10 bg-white border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] tabular-nums focus:outline-none focus:border-[#b89753]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="budgetKidPlatesInput"
                          className="block text-xs font-medium text-[#2c3e35] mb-1"
                        >
                          Presupuesto Platos Niño (0 = informativo)
                        </label>
                        <NumericInput
                          id="budgetKidPlatesInput"
                          min={0}
                          max={500}
                          defaultValue={0}
                          value={budgetKidPlates}
                          onCommit={setBudgetKidPlates}
                          className="w-full h-10 bg-white border border-[#b89753]/35 rounded-xl px-3 text-sm text-[#2c3e35] tabular-nums focus:outline-none focus:border-[#b89753]"
                        />
                      </div>
                    </div>
                  </div>

                  {settingsError && (
                    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                      {settingsError}
                    </p>
                  )}

                  {settingsSaved && (
                    <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ajustes guardados correctamente.</span>
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#b89753] hover:bg-[#967739] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                    >
                      {savingSettings ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>Guardar Ajustes</span>
                    </button>

                    {googlePhotosUrl && (
                      <a
                        href={googlePhotosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-[#2c3e35]/25 hover:border-[#b89753] text-[#2c3e35] text-xs font-semibold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#b89753]" />
                        <span>Abrir Carpeta de Google Drive</span>
                      </a>
                    )}
                  </div>
                </form>

                {/* Single-File HTML Slideshow Export + Google Apps Script Code */}
                <div className="bg-white border border-[#b89753]/30 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[#b89753] font-semibold">
                        Proyección Independiente en Pantalla Completa
                      </p>
                      <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                        Presentación HTML en un Solo Archivo + Google Apps Script
                      </h3>
                      <p className="mt-1 text-xs text-[#2c3e35]/70 leading-relaxed">
                        Descarga un archivo HTML único (con CSS y JavaScript
                        integrados, sin dependencias externas) listo para abrir en
                        cualquier proyector, Smart TV o computadora cargando las
                        fotos desde tu carpeta pública de Google Drive (
                        <code>{driveFolderId || DEFAULT_DRIVE_FOLDER_ID}</code>
                        ).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        downloadStandaloneSlideshowHtml({
                          appsScriptUrl,
                          driveFolderId:
                            driveFolderId || DEFAULT_DRIVE_FOLDER_ID,
                          driveFolderUrl: googlePhotosUrl,
                          intervalSec,
                        })
                      }
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] text-[#fcfbf9] text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    >
                      <Download className="w-4 h-4 text-[#b89753]" />
                      <span>Descargar Presentación (.html)</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const code = buildGoogleAppsScriptCode(
                          driveFolderId || DEFAULT_DRIVE_FOLDER_ID
                        );
                        void navigator.clipboard.writeText(code);
                        setCopiedAppsScript(true);
                        window.setTimeout(
                          () => setCopiedAppsScript(false),
                          2500
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#b89753]/50 bg-[#fcfbf9] hover:bg-[#f7f5f0] text-[#2c3e35] text-xs font-semibold cursor-pointer"
                    >
                      {copiedAppsScript ? (
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#b89753]" />
                      )}
                      <span>
                        {copiedAppsScript
                          ? 'Código Code.gs copiado'
                          : 'Copiar Código Google Apps Script (Code.gs)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAppsScriptCode((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#2c3e35]/20 hover:border-[#b89753] text-[#2c3e35] text-xs font-semibold cursor-pointer"
                    >
                      <Code2 className="w-3.5 h-3.5 text-[#b89753]" />
                      <span>
                        {showAppsScriptCode
                          ? 'Ocultar Código Code.gs'
                          : 'Ver Instrucciones y Código'}
                      </span>
                    </button>
                  </div>

                  {showAppsScriptCode && (
                    <div className="space-y-3 pt-2">
                      <ol className="text-xs text-[#2c3e35]/80 space-y-1 list-decimal list-inside bg-[#f7f5f0] rounded-xl p-3.5 border border-[#b89753]/20">
                        <li>
                          Asegúrate de que la carpeta de Google Drive esté
                          compartida como{' '}
                          <strong>Cualquier usuario con el enlace (Lector)</strong>.
                        </li>
                        <li>
                          Abre <code>script.google.com</code>, crea un proyecto y
                          pega este código en <code>Code.gs</code>.
                        </li>
                        <li>
                          Haz clic en{' '}
                          <strong>
                            Implementar &gt; Nueva implementación &gt; Aplicación web
                          </strong>{' '}
                          (Ejecutar como: <em>Yo</em>, Acceso:{' '}
                          <em>Cualquier usuario</em>) y pega la URL{' '}
                          <code>/exec</code> arriba.
                        </li>
                      </ol>
                      <pre className="text-[11px] leading-relaxed bg-[#141d18] text-[#fcfbf9] p-4 rounded-xl overflow-x-auto border border-[#b89753]/30">
                        <code>
                          {buildGoogleAppsScriptCode(
                            driveFolderId || DEFAULT_DRIVE_FOLDER_ID
                          )}
                        </code>
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <SectionCornerFlorals variant="default" />
    </section>
  );
};
