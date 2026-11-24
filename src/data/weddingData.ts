export interface WeddingEvent {
  id: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  venue: string;
  address: string;
  mapUrl: string;
  icsStart: string;
  icsEnd: string;
  icsDescription: string;
}

export interface GodparentRole {
  roleName: string;
  names: string;
}

export interface GuestParty {
  id: string;
  name: string;
  surnames: string[];
  adults: number;
  kids: number;
  babies: number;
  tableNumber: number;
  isUserSubmitted?: boolean;
}

export interface TableGroup {
  tableNumber: number;
  zoneLabel: string;
  proximityNote: string;
  capacity: number;
  occupiedSeats: number;
  parties: GuestParty[];
}

export type GuestRelationGroup =
  | 'familiar_novio'
  | 'familiar_novia'
  | 'amigo_novia'
  | 'amigo_novio';

export const GUEST_RELATION_GROUPS: ReadonlyArray<{
  value: GuestRelationGroup;
  label: string;
  shortLabel: string;
}> = [
  {
    value: 'familiar_novio',
    label: 'Familiar del Novio',
    shortLabel: 'Fam. Novio',
  },
  {
    value: 'familiar_novia',
    label: 'Familiar de la Novia',
    shortLabel: 'Fam. Novia',
  },
  {
    value: 'amigo_novia',
    label: 'Amigo de la Novia',
    shortLabel: 'Amigo Novia',
  },
  {
    value: 'amigo_novio',
    label: 'Amigo del Novio',
    shortLabel: 'Amigo Novio',
  },
];

export function getGuestRelationLabel(
  group?: GuestRelationGroup | '' | null
): string {
  const found = GUEST_RELATION_GROUPS.find((g) => g.value === group);
  return found ? found.label : 'Sin clasificar';
}

export interface RsvpRecord {
  id: string;
  guestName: string;
  surnames: string[];
  adults: number;
  kids: number;
  babies: number;
  attending: boolean;
  tableNumber: number;
  phone: string;
  phoneKey?: string;
  notes: string;
  guestGroup?: GuestRelationGroup | '';
  createdAt?: { seconds: number; nanoseconds: number } | null;
}

export interface GuestQuotaRecord {
  phoneKey: string;
  phoneDisplay: string;
  guestName: string;
  maxAdults: number;
  maxKids: number;
  maxBabies: number;
  assignedTable: number;
  guestGroup: GuestRelationGroup | '';
  notes: string;
  confirmed: boolean;
  rsvpId: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
  updatedAt?: { seconds: number; nanoseconds: number } | null;
}

export interface WeddingPhotoRecord {
  id: string;
  guestName: string;
  caption: string;
  imageData: string;
  fallbackUrl?: string;
  width: number;
  height: number;
  visible: boolean;
  createdAt?: { seconds: number; nanoseconds: number } | null;
}

export interface HeroPhotoRecord {
  id: string;
  imageData: string;
  caption: string;
  sortOrder: number;
  active: boolean;
  createdAt?: { seconds: number; nanoseconds: number } | null;
}

export type CustomAudioMode = 'synth' | 'url' | 'uploaded';


export interface WeddingConfigRecord {
  googlePhotosUrl: string;
  appsScriptUrl: string;
  welcomeNote: string;
  fotoPartyIntervalSec: number;
  albumEnabledEarly: boolean;
  totalTables: number;
  heroPhotoUrl?: string;
  tablesVisibleToGuests?: boolean;
  adminPhone?: string;
  groomPhone?: string;
  budgetAdultPlates?: number;
  budgetKidPlates?: number;
  weddingDateISO?: string;
  ceremonyTime?: string;
  ceremonyVenue?: string;
  ceremonyAddress?: string;
  ceremonyMapUrl?: string;
  receptionTime?: string;
  receptionVenue?: string;
  receptionAddress?: string;
  receptionMapUrl?: string;
  brideParents?: string;
  groomParents?: string;
  godparentsList?: GodparentRole[];
  giftEnvelopeNote?: string;
  giftBankName?: string;
  giftAccountHolder?: string;
  giftAccountType?: string;
  giftAccountNumber?: string;
  giftQrValue?: string;
  giftQrImage?: string;
  giftClabeOrId?: string;
  giftBizPhone?: string;
  giftAppAlias?: string;
  hideDefaultHeroPhotos?: boolean;
  customAudioMode?: CustomAudioMode;
  customAudioUrl?: string;
  customAudioTitle?: string;
  customAudioMime?: string;
  customAudioChunkCount?: number;
  customAudioUpdatedToken?: string;
  customAudioDurationSec?: number;
}

export const WEDDING_ALBUM_UNLOCK_ISO = '2027-07-10T00:00:00';

export function isWeddingDayReached(
  weddingDateISO?: string,
  ceremonyTime?: string
): boolean {
  const dateStr =
    weddingDateISO && /^\d{4}-\d{2}-\d{2}$/.test(weddingDateISO)
      ? weddingDateISO
      : '2027-07-10';
  const timeStr =
    ceremonyTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(ceremonyTime)
      ? ceremonyTime
      : '16:00';
  const ceremonyMs = new Date(`${dateStr}T${timeStr}:00`).getTime();
  const unlockMs = ceremonyMs - 30 * 60 * 1000; // 30 minutes before ceremony
  return Date.now() >= unlockMs;
}

export const DEFAULT_GODPARENTS_LIST: GodparentRole[] = [
  { roleName: 'Padrinos de Anillos', names: 'Sr. Roberto Mendoza & Sra. Elena Benítez' },
  { roleName: 'Padrinos de Arras', names: 'Lic. Carlos Morales & Dra. Sofia Benítez' },
  { roleName: 'Padrinos de Lazo', names: 'Ing. Alejandro Rodas & Lic. Marcela de Rodas' },
  { roleName: 'Padrinos de Ramo, Biblia y Rosario', names: 'Sr. Mario Guardado & Sra. Claudia de Guardado' },
  { roleName: 'Padrinos de Apoyo / Recepción', names: 'Familia Mendoza Herrera' },
  { roleName: 'Padrinos de Tarjeta', names: 'Elia Cristina & Ing. Héctor Rodas' },
];

export const DEFAULT_WEDDING_CONFIG: WeddingConfigRecord = {
  googlePhotosUrl:
    'https://drive.google.com/drive/folders/13Ii_V2aNXTZUbuvefWLIbS_L6jP0mMfR?usp=sharing',
  appsScriptUrl: '',
  welcomeNote:
    '¡Ayúdanos a no perdernos ningún instante de nuestra boda! Comparte tus fotografías y captura esos momentos espontáneos, divertidos y especiales que quizás nosotros no alcancemos a ver.',
  fotoPartyIntervalSec: 6,
  albumEnabledEarly: false,
  totalTables: 10,
  heroPhotoUrl:
    'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
  tablesVisibleToGuests: false,
  adminPhone: '+503 76874760',
  groomPhone: '+503 78249210',
  budgetAdultPlates: 0,
  budgetKidPlates: 0,
  weddingDateISO: '2027-07-10',
  ceremonyTime: '16:00',
  ceremonyVenue: 'Parroquia Principal',
  ceremonyAddress: 'Centro Histórico, San Salvador, El Salvador',
  ceremonyMapUrl: 'https://maps.google.com/?q=Catedral+Metropolitana+San+Salvador',
  receptionTime: '19:00',
  receptionVenue: 'Salón de Eventos Elegance',
  receptionAddress: 'Zona Escalón, San Salvador, El Salvador',
  receptionMapUrl: 'https://maps.google.com/?q=Colonia+Escalon+San+Salvador',
  brideParents: 'Sra. Guadalupe Mendoza & Sr. Guadalupe Herrera',
  groomParents: 'Sr. Jorge Rodas Morales & Sra. Morena del Carmen Benítez de Rodas (Desde el Cielo)',
  godparentsList: DEFAULT_GODPARENTS_LIST,
  giftEnvelopeNote:
    'Tendremos un cofre dispuesto en la entrada del Salón de Eventos Elegance para recibir sus sobres y buenos deseos.',
  giftBankName: 'Banco / Transferencia Bancaria',
  giftAccountHolder: 'Jorge Luis Rodas Benítez',
  giftAccountType: 'Cuenta Bancaria',
  giftAccountNumber: '0014-8920-3411-7890',
  giftQrValue: '',
  giftQrImage: '',
  hideDefaultHeroPhotos: false,
  customAudioMode: 'url',
  customAudioUrl: '/assets/aistudio/POR_TI_VOLARE_-_Andrea_Bocelli_Arcano_f7efb475.mp3',
  customAudioTitle: 'POR TI VOLARE - Andrea Bocelli / Arcano',
  customAudioMime: 'audio/mpeg',
  customAudioChunkCount: 0,
  customAudioUpdatedToken: 'default-por-ti-volare',
  customAudioDurationSec: 240,
};

export const DEFAULT_HERO_PHOTOS = [
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
] as const;

export const TABLE_CAPACITY = 10;

export const AUTHORIZED_COUPLE_ACCOUNTS = {
  admin: {
    alias: 'admin',
    email: 'ing.hectorrodas@gmail.com',
    roleLabel: 'Administrador',
  },
  novio: {
    alias: 'novio',
    email: 'jorgerodad@gmail.com',
    roleLabel: 'Novio (Jorge Luis)',
  },
} as const;

export function isAuthorizedCoupleEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return (
    lower === AUTHORIZED_COUPLE_ACCOUNTS.admin.email ||
    lower === AUTHORIZED_COUPLE_ACCOUNTS.novio.email
  );
}

export function resolveLoginIdentifier(identifier: string): string {
  const clean = identifier.trim().toLowerCase();
  if (clean === 'admin') return AUTHORIZED_COUPLE_ACCOUNTS.admin.email;
  if (clean === 'novio') return AUTHORIZED_COUPLE_ACCOUNTS.novio.email;
  return clean;
}

export const COUPLE_INFO = {
  bride: 'Jessica Paiz',
  groom: 'Jorge Rodas',
  shortTitle: 'Jessica & Jorge',
  dateISO: '2027-07-10T16:00:00',
  dateDisplay: 'Sábado 10 de Julio, 2027',
  dressCode: 'Business Casual · Casual Elegante',
  giftRegistry: 'Lluvia de Sobres o Mesa de Regalos en Tiendas Departamentales',
  quote:
    'Hay momentos en la vida que son inolvidables, compartirlos los hace perfectos.',
  parents: {
    bride: 'Sra. Guadalupe Mendoza & Sr. Guadalupe Herrera',
    groom: 'Sr. Jorge Rodas Morales & Sra. Morena del Carmen Benítez de Rodas (Desde el Cielo)',
  },
  godparentsList: DEFAULT_GODPARENTS_LIST,
};

export const WEDDING_EVENTS: WeddingEvent[] = [
  {
    id: 'ceremony',
    title: 'Ceremonia Religiosa',
    dateLabel: 'Sábado 10 de Julio, 2027',
    timeLabel: '4:00 PM',
    venue: 'Parroquia Principal',
    address: 'Centro Histórico, San Salvador, El Salvador',
    mapUrl: 'https://maps.google.com/?q=Catedral+Metropolitana+San+Salvador',
    icsStart: '20270710T220000Z',
    icsEnd: '20270711T000000Z',
    icsDescription:
      'Ceremonia religiosa de matrimonio de Jessica Paiz y Jorge Rodas (4:00 PM · Parroquia Principal).',
  },
  {
    id: 'reception',
    title: 'Recepción',
    dateLabel: 'Sábado 10 de Julio, 2027',
    timeLabel: '7:00 PM',
    venue: 'Salón de Eventos Elegance',
    address: 'Zona Escalón, San Salvador, El Salvador',
    mapUrl: 'https://maps.google.com/?q=Colonia+Escalon+San+Salvador',
    icsStart: '20270711T010000Z',
    icsEnd: '20270711T080000Z',
    icsDescription:
      'Recepción y cena de celebración por la boda de Jessica Paiz y Jorge Rodas (7:00 PM · Salón de Eventos Elegance).',
  },
];

const SPANISH_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

const SPANISH_WEEKDAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

export function parseWeddingDateParts(dateISO?: string): {
  year: number;
  monthIndex: number;
  day: number;
  weekdayIndex: number;
} {
  const match = dateISO?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const year = match ? Number(match[1]) : 2026;
  const monthIndex = match ? Math.min(11, Math.max(0, Number(match[2]) - 1)) : 11;
  const day = match ? Math.min(31, Math.max(1, Number(match[3]))) : 18;
  const weekdayIndex = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0)).getUTCDay();
  return { year, monthIndex, day, weekdayIndex };
}

export function formatWeddingDateUpper(dateISO?: string): string {
  const { year, monthIndex, day } = parseWeddingDateParts(dateISO);
  return `${day} DE ${SPANISH_MONTHS[monthIndex].toUpperCase()}, ${year}`;
}

export function formatWeddingDateDots(dateISO?: string): string {
  const { year, monthIndex, day } = parseWeddingDateParts(dateISO);
  return `${day} · ${SPANISH_MONTHS[monthIndex]} · ${year}`;
}

export function formatWeddingDayName(dateISO?: string): string {
  const { weekdayIndex } = parseWeddingDateParts(dateISO);
  return SPANISH_WEEKDAYS[weekdayIndex];
}

export function formatWeddingEventDateLabel(dateISO?: string): string {
  const { year, monthIndex, day, weekdayIndex } = parseWeddingDateParts(dateISO);
  return `${SPANISH_WEEKDAYS[weekdayIndex]} ${day} de ${SPANISH_MONTHS[monthIndex]}, ${year}`;
}

export function formatWeddingReportDateLabel(dateISO?: string): string {
  const { year, monthIndex, day } = parseWeddingDateParts(dateISO);
  return `${day} de ${SPANISH_MONTHS[monthIndex]}, ${year}`;
}

export function parseTime24Parts(timeStr?: string): { hour: number; minute: number } {
  const match24 = timeStr?.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (match24) {
    return { hour: Number(match24[1]), minute: Number(match24[2]) };
  }
  const match12 = timeStr?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = Number(match12[1]) % 12;
    if (match12[3].toUpperCase() === 'PM') h += 12;
    return { hour: h, minute: Number(match12[2]) };
  }
  return { hour: 16, minute: 0 };
}

export function formatTime12h(timeStr?: string, fallbackTime = '16:00'): string {
  const clean = timeStr?.trim() || fallbackTime;
  const { hour, minute } = parseTime24Parts(clean);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

export function buildCountdownTargetISO(
  config?: Partial<WeddingConfigRecord>
): string {
  const dateISO =
    config?.weddingDateISO && /^\d{4}-\d{2}-\d{2}$/.test(config.weddingDateISO)
      ? config.weddingDateISO
      : DEFAULT_WEDDING_CONFIG.weddingDateISO!;
  const { hour, minute } = parseTime24Parts(
    config?.ceremonyTime || DEFAULT_WEDDING_CONFIG.ceremonyTime
  );
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${dateISO}T${hh}:${mm}:00-06:00`;
}

export function toElSalvadorUtcCompact(
  dateISO: string,
  time24: string,
  addHours = 0
): string {
  const { year, monthIndex, day } = parseWeddingDateParts(dateISO);
  const { hour, minute } = parseTime24Parts(time24);
  // El Salvador is UTC-6 year round
  const utcMs = Date.UTC(year, monthIndex, day, hour + 6 + addHours, minute, 0);
  const d = new Date(utcMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
    d.getUTCDate()
  )}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

export function toElSalvadorUtcIso(
  dateISO: string,
  time24: string,
  addHours = 0
): string {
  const compact = toElSalvadorUtcCompact(dateISO, time24, addHours);
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(
    6,
    8
  )}T${compact.slice(9, 11)}:${compact.slice(11, 13)}:00Z`;
}

export function sanitizeGodparentsList(raw: unknown): GodparentRole[] {
  if (!Array.isArray(raw)) return DEFAULT_GODPARENTS_LIST;
  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null
    )
    .map((item) => ({
      roleName: String(item.roleName ?? '').trim().slice(0, 100),
      names: String(item.names ?? '').trim().slice(0, 160),
    }))
    .filter((item) => item.roleName.length > 0 && item.names.length > 0)
    .slice(0, 12);
}

export const LOCAL_STORAGE_CONFIG_KEY = 'boda_wedding_config_local';

export function getStoredWeddingConfig(): WeddingConfigRecord {
  if (typeof window === 'undefined') return DEFAULT_WEDDING_CONFIG;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return mergeWeddingConfigDirect(parsed);
      }
    }
  } catch (e) {}
  return DEFAULT_WEDDING_CONFIG;
}

export function saveStoredWeddingConfig(config: Partial<WeddingConfigRecord>): WeddingConfigRecord {
  const current = getStoredWeddingConfig();
  const merged = mergeWeddingConfigDirect({ ...current, ...config });
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(merged));
      window.dispatchEvent(
        new CustomEvent('wedding:config-updated', { detail: merged })
      );
    } catch (e) {}
  }
  return merged;
}

export const LOCAL_STORAGE_QUOTAS_KEY = 'boda_guest_quotas_local';

export function getStoredGuestQuotas(): GuestQuotaRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_QUOTAS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveStoredGuestQuotas(quotas: GuestQuotaRecord[]) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_QUOTAS_KEY, JSON.stringify(quotas));
      window.dispatchEvent(
        new CustomEvent('wedding:quotas-updated', { detail: quotas })
      );
    } catch (e) {}
  }
}

function mergeWeddingConfigDirect(raw?: Record<string, unknown> | null): WeddingConfigRecord {
  if (!raw) return DEFAULT_WEDDING_CONFIG;
  return {
    googlePhotosUrl: String(
      raw.googlePhotosUrl || DEFAULT_WEDDING_CONFIG.googlePhotosUrl
    ),
    appsScriptUrl: String(raw.appsScriptUrl || ''),
    welcomeNote: String(raw.welcomeNote || DEFAULT_WEDDING_CONFIG.welcomeNote),
    fotoPartyIntervalSec: Number(
      raw.fotoPartyIntervalSec ?? DEFAULT_WEDDING_CONFIG.fotoPartyIntervalSec
    ),
    albumEnabledEarly: Boolean(raw.albumEnabledEarly ?? false),
    totalTables: Number(raw.totalTables ?? DEFAULT_WEDDING_CONFIG.totalTables),
    heroPhotoUrl: raw.heroPhotoUrl
      ? String(raw.heroPhotoUrl)
      : DEFAULT_WEDDING_CONFIG.heroPhotoUrl,
    tablesVisibleToGuests: Boolean(raw.tablesVisibleToGuests ?? false),
    adminPhone:
      typeof raw.adminPhone === 'string' && raw.adminPhone.trim()
        ? raw.adminPhone.trim()
        : DEFAULT_WEDDING_CONFIG.adminPhone,
    groomPhone:
      typeof raw.groomPhone === 'string' && raw.groomPhone.trim()
        ? raw.groomPhone.trim()
        : DEFAULT_WEDDING_CONFIG.groomPhone,
    budgetAdultPlates:
      typeof raw.budgetAdultPlates === 'number'
        ? Number(raw.budgetAdultPlates)
        : 0,
    budgetKidPlates:
      typeof raw.budgetKidPlates === 'number' ? Number(raw.budgetKidPlates) : 0,
    weddingDateISO:
      typeof raw.weddingDateISO === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(raw.weddingDateISO)
        ? raw.weddingDateISO
        : DEFAULT_WEDDING_CONFIG.weddingDateISO,
    ceremonyTime:
      typeof raw.ceremonyTime === 'string' &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.ceremonyTime)
        ? raw.ceremonyTime
        : DEFAULT_WEDDING_CONFIG.ceremonyTime,
    ceremonyVenue:
      typeof raw.ceremonyVenue === 'string' && raw.ceremonyVenue.trim()
        ? raw.ceremonyVenue.trim()
        : DEFAULT_WEDDING_CONFIG.ceremonyVenue,
    ceremonyAddress:
      typeof raw.ceremonyAddress === 'string' && raw.ceremonyAddress.trim()
        ? raw.ceremonyAddress.trim()
        : DEFAULT_WEDDING_CONFIG.ceremonyAddress,
    ceremonyMapUrl:
      typeof raw.ceremonyMapUrl === 'string'
        ? raw.ceremonyMapUrl.trim()
        : DEFAULT_WEDDING_CONFIG.ceremonyMapUrl,
    receptionTime:
      typeof raw.receptionTime === 'string' &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.receptionTime)
        ? raw.receptionTime
        : DEFAULT_WEDDING_CONFIG.receptionTime,
    receptionVenue:
      typeof raw.receptionVenue === 'string' && raw.receptionVenue.trim()
        ? raw.receptionVenue.trim()
        : DEFAULT_WEDDING_CONFIG.receptionVenue,
    receptionAddress:
      typeof raw.receptionAddress === 'string' && raw.receptionAddress.trim()
        ? raw.receptionAddress.trim()
        : DEFAULT_WEDDING_CONFIG.receptionAddress,
    receptionMapUrl:
      typeof raw.receptionMapUrl === 'string'
        ? raw.receptionMapUrl.trim()
        : DEFAULT_WEDDING_CONFIG.receptionMapUrl,
    brideParents:
      typeof raw.brideParents === 'string'
        ? raw.brideParents
        : DEFAULT_WEDDING_CONFIG.brideParents,
    groomParents:
      typeof raw.groomParents === 'string'
        ? raw.groomParents
        : DEFAULT_WEDDING_CONFIG.groomParents,
    godparentsList: sanitizeGodparentsList(raw.godparentsList),
    giftEnvelopeNote:
      typeof raw.giftEnvelopeNote === 'string' ? raw.giftEnvelopeNote : '',
    giftBankName: typeof raw.giftBankName === 'string' ? raw.giftBankName : '',
    giftAccountHolder:
      typeof raw.giftAccountHolder === 'string' ? raw.giftAccountHolder : '',
    giftAccountNumber:
      typeof raw.giftAccountNumber === 'string' ? raw.giftAccountNumber : '',
    giftAccountType:
      typeof raw.giftAccountType === 'string' ? raw.giftAccountType : '',
    giftClabeOrId:
      typeof raw.giftClabeOrId === 'string' ? raw.giftClabeOrId : '',
    giftBizPhone: typeof raw.giftBizPhone === 'string' ? raw.giftBizPhone : '',
    giftAppAlias: typeof raw.giftAppAlias === 'string' ? raw.giftAppAlias : '',
    customAudioMode:
      raw.customAudioMode === 'uploaded' && raw.customAudioUpdatedToken
        ? 'uploaded'
        : 'url',
    customAudioUrl:
      raw.customAudioMode === 'uploaded' && raw.customAudioUpdatedToken && typeof raw.customAudioUrl === 'string' && raw.customAudioUrl.trim()
        ? raw.customAudioUrl.trim()
        : DEFAULT_WEDDING_CONFIG.customAudioUrl,
    customAudioTitle:
      raw.customAudioMode === 'uploaded' && raw.customAudioUpdatedToken && typeof raw.customAudioTitle === 'string' && raw.customAudioTitle.trim()
        ? raw.customAudioTitle.trim()
        : DEFAULT_WEDDING_CONFIG.customAudioTitle,
    customAudioMime:
      typeof raw.customAudioMime === 'string' ? raw.customAudioMime : '',
    customAudioChunkCount:
      typeof raw.customAudioChunkCount === 'number'
        ? raw.customAudioChunkCount
        : 0,
    customAudioUpdatedToken:
      typeof raw.customAudioUpdatedToken === 'string'
        ? raw.customAudioUpdatedToken
        : '',
    customAudioDurationSec:
      typeof raw.customAudioDurationSec === 'number'
        ? raw.customAudioDurationSec
        : 0,
    hideDefaultHeroPhotos: Boolean(raw.hideDefaultHeroPhotos ?? false),
  };
}

export function mergeWeddingConfig(
  raw?: Record<string, unknown> | null
): WeddingConfigRecord {
  const local = getStoredWeddingConfig();
  if (!raw) return local;
  const mergedRaw = { ...local, ...raw };
  return mergeWeddingConfigDirect(mergedRaw);
}


export function buildWeddingEventsFromConfig(
  config?: Partial<WeddingConfigRecord>
): WeddingEvent[] {
  const dateISO =
    config?.weddingDateISO || DEFAULT_WEDDING_CONFIG.weddingDateISO!;
  const dateLabel = formatWeddingEventDateLabel(dateISO);

  const ceremonyTime24 =
    config?.ceremonyTime || DEFAULT_WEDDING_CONFIG.ceremonyTime!;
  const ceremonyTimeLabel = formatTime12h(ceremonyTime24, '16:00');
  const ceremonyVenue =
    config?.ceremonyVenue?.trim() || DEFAULT_WEDDING_CONFIG.ceremonyVenue!;
  const ceremonyAddress =
    config?.ceremonyAddress?.trim() || DEFAULT_WEDDING_CONFIG.ceremonyAddress!;
  const ceremonyMapUrl =
    config?.ceremonyMapUrl?.trim() ||
    `https://maps.google.com/?q=${encodeURIComponent(
      `${ceremonyVenue}, ${ceremonyAddress}`
    )}`;

  const receptionTime24 =
    config?.receptionTime || DEFAULT_WEDDING_CONFIG.receptionTime!;
  const receptionTimeLabel = formatTime12h(receptionTime24, '19:00');
  const receptionVenue =
    config?.receptionVenue?.trim() || DEFAULT_WEDDING_CONFIG.receptionVenue!;
  const receptionAddress =
    config?.receptionAddress?.trim() || DEFAULT_WEDDING_CONFIG.receptionAddress!;
  const receptionMapUrl =
    config?.receptionMapUrl?.trim() ||
    `https://maps.google.com/?q=${encodeURIComponent(
      `${receptionVenue}, ${receptionAddress}`
    )}`;

  return [
    {
      id: 'ceremony',
      title: 'Ceremonia Religiosa',
      dateLabel,
      timeLabel: ceremonyTimeLabel,
      venue: ceremonyVenue,
      address: ceremonyAddress,
      mapUrl: ceremonyMapUrl,
      icsStart: toElSalvadorUtcCompact(dateISO, ceremonyTime24, 0),
      icsEnd: toElSalvadorUtcCompact(dateISO, ceremonyTime24, 2),
      icsDescription: `Ceremonia religiosa de matrimonio de Jessica Paiz y Jorge Rodas (${ceremonyTimeLabel} · ${ceremonyVenue}).`,
    },
    {
      id: 'reception',
      title: 'Recepción',
      dateLabel,
      timeLabel: receptionTimeLabel,
      venue: receptionVenue,
      address: receptionAddress,
      mapUrl: receptionMapUrl,
      icsStart: toElSalvadorUtcCompact(dateISO, receptionTime24, 0),
      icsEnd: toElSalvadorUtcCompact(dateISO, receptionTime24, 7),
      icsDescription: `Recepción y cena de celebración por la boda de Jessica Paiz y Jorge Rodas (${receptionTimeLabel} · ${receptionVenue}).`,
    },
  ];
}

export const INITIAL_GUEST_PARTIES: GuestParty[] = [];

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizePhoneKey(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  const cleaned = digits.startsWith('00') ? digits.slice(2) : digits;
  if (cleaned.length === 8) {
    return `503${cleaned}`;
  }
  return cleaned.slice(0, 18);
}

export function isValidPhoneKey(phoneKey: string): boolean {
  return /^[0-9]{7,18}$/.test(phoneKey);
}

export function buildWhatsAppContactUrl(
  rawPhone: string,
  message: string
): string {
  const key = normalizePhoneKey(rawPhone);
  return `https://wa.me/${key}?text=${encodeURIComponent(message)}`;
}

export function buildTelContactUrl(rawPhone: string): string {
  const sanitized = rawPhone.replace(/[^\d+]/g, '');
  return `tel:${sanitized}`;
}

export function extractSurnames(fullName: string): string[] {
  const stopWords = new Set([
    'familia',
    'fam',
    'sr',
    'sra',
    'srta',
    'dr',
    'dra',
    'ing',
    'lic',
    'de',
    'del',
    'la',
    'las',
    'los',
    'y',
  ]);
  const tokens = normalizeText(fullName)
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.slice(0, 40))
    .filter((token) => token.length > 1 && !stopWords.has(token));

  if (tokens.length === 0) {
    const fallback = normalizeText(fullName).replace(/[^a-z0-9]/g, '').slice(0, 40);
    return [fallback || 'invitado'];
  }

  if (normalizeText(fullName).startsWith('familia') || tokens.length <= 2) {
    return Array.from(new Set(tokens)).slice(0, 4);
  }
  return Array.from(new Set(tokens.slice(-2))).slice(0, 4);
}

export function getSurnameSortKey(fullName: string): string {
  const stopWords = new Set([
    'familia',
    'fam',
    'flia',
    'sr',
    'sra',
    'srta',
    'dr',
    'dra',
    'ing',
    'lic',
    'de',
    'del',
    'la',
    'las',
    'los',
    'y',
  ]);
  const norm = normalizeText(fullName);
  const tokens = norm
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0 && !stopWords.has(token));

  if (tokens.length === 0) {
    return norm;
  }

  if (norm.startsWith('familia') || norm.startsWith('fam')) {
    return `${tokens.join(' ')} ${norm}`;
  }

  if (tokens.length === 1) {
    return `${tokens[0]} ${norm}`;
  }

  if (tokens.length === 2) {
    return `${tokens[1]} ${tokens[0]} ${norm}`;
  }

  const lastTwo = tokens.slice(-2).join(' ');
  const rest = tokens.slice(0, -2).join(' ');
  return `${lastTwo} ${rest} ${norm}`;
}

export function getZoneInfo(tableNumber: number): {
  zoneLabel: string;
  proximityNote: string;
} {
  if (tableNumber <= 2) {
    return {
      zoneLabel: 'Zona Preferencial',
      proximityNote: 'Junto a la Mesa Principal de los Novios',
    };
  }
  if (tableNumber <= 4) {
    return {
      zoneLabel: 'Zona Jardín Central',
      proximityNote: 'Segunda fila frente a la pista principal',
    };
  }
  return {
    zoneLabel: 'Zona Terraza',
    proximityNote: 'Área panorámica con vista al jardín',
  };
}

export function buildSeatingPlan(
  parties: GuestParty[],
  configuredTotalTables?: number
): TableGroup[] {
  const tableMap = new Map<number, GuestParty[]>();
  let maxTable = Math.max(1, configuredTotalTables ?? 10);

  for (const party of parties) {
    maxTable = Math.max(maxTable, party.tableNumber);
    const list = tableMap.get(party.tableNumber) ?? [];
    list.push(party);
    tableMap.set(party.tableNumber, list);
  }

  const tables: TableGroup[] = [];
  for (let num = 1; num <= maxTable; num++) {
    const tableParties = tableMap.get(num) ?? [];
    const occupiedSeats = tableParties.reduce(
      (sum, p) => sum + p.adults + p.kids,
      0
    );
    const { zoneLabel, proximityNote } = getZoneInfo(num);
    tables.push({
      tableNumber: num,
      zoneLabel,
      proximityNote,
      capacity: TABLE_CAPACITY,
      occupiedSeats,
      parties: tableParties,
    });
  }

  return tables;
}

export function chooseTableForGuest(
  existingParties: GuestParty[],
  guestName: string,
  adults: number,
  kids: number,
  configuredTotalTables?: number
): { assignedTable: number; matchedFamily: boolean; surnames: string[] } {
  const seatedCount = Math.max(1, adults + kids);
  const surnames = extractSurnames(guestName);
  const tables = buildSeatingPlan(existingParties, configuredTotalTables);
  const coupleSurnames = new Set(['rodas', 'paiz', 'benitez', 'guadalupe']);
  const isCloseFamily = surnames.some((s) => coupleSurnames.has(s));

  let chosenTable: number | null = null;
  let matchedFamily = false;

  if (surnames.length > 0) {
    const surnameMatch = tables.find((table) => {
      const hasRemaining = table.capacity - table.occupiedSeats >= seatedCount;
      if (!hasRemaining) return false;
      return table.parties.some((party) =>
        party.surnames.some((ps) => surnames.includes(ps))
      );
    });
    if (surnameMatch) {
      chosenTable = surnameMatch.tableNumber;
      matchedFamily = true;
    }
  }

  if (chosenTable === null && isCloseFamily) {
    const nearestAvailable = tables.find(
      (table) => table.capacity - table.occupiedSeats >= seatedCount
    );
    if (nearestAvailable) {
      chosenTable = nearestAvailable.tableNumber;
    }
  }

  if (chosenTable === null) {
    const available = tables.find(
      (table) => table.capacity - table.occupiedSeats >= seatedCount
    );
    if (available) {
      chosenTable = available.tableNumber;
    } else {
      const counts = tables.map((t) => t.occupiedSeats);
      const minOccupied = Math.min(...counts);
      const leastBusy = tables.find((t) => t.occupiedSeats === minOccupied);
      chosenTable = leastBusy ? leastBusy.tableNumber : 1;
    }
  }

  return { assignedTable: chosenTable, matchedFamily, surnames };
}

export function generateSafeId(prefix: string): string {
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

export function buildGoogleCalendarUrl(
  title: string,
  startISO: string,
  endISO: string,
  details: string,
  location: string
): string {
  const formatTime = (iso: string) =>
    iso.replace(/[-:]/g, '').split('.')[0] + 'Z';
  const start = formatTime(startISO);
  const end = formatTime(endISO);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${start}/${end}&details=${encodeURIComponent(
    details
  )}&location=${encodeURIComponent(location)}`;
}

export function buildCombinedGoogleCalendarUrl(
  guestName: string,
  assignedTable: number | null,
  config?: Partial<WeddingConfigRecord>
): string {
  const dateISO =
    config?.weddingDateISO || DEFAULT_WEDDING_CONFIG.weddingDateISO!;
  const ceremonyTime24 =
    config?.ceremonyTime || DEFAULT_WEDDING_CONFIG.ceremonyTime!;
  const receptionTime24 =
    config?.receptionTime || DEFAULT_WEDDING_CONFIG.receptionTime!;
  const ceremonyTimeLabel = formatTime12h(ceremonyTime24, '16:00');
  const receptionTimeLabel = formatTime12h(receptionTime24, '19:00');
  const ceremonyVenue =
    config?.ceremonyVenue?.trim() || DEFAULT_WEDDING_CONFIG.ceremonyVenue!;
  const ceremonyAddress =
    config?.ceremonyAddress?.trim() || DEFAULT_WEDDING_CONFIG.ceremonyAddress!;
  const receptionVenue =
    config?.receptionVenue?.trim() || DEFAULT_WEDDING_CONFIG.receptionVenue!;
  const receptionAddress =
    config?.receptionAddress?.trim() || DEFAULT_WEDDING_CONFIG.receptionAddress!;

  const tableText =
    assignedTable !== null ? ` · Mesa Asignada: #${assignedTable}` : '';
  const title = `Boda de Jessica & Jorge (${guestName}${tableText})`;
  const startISO = toElSalvadorUtcIso(dateISO, ceremonyTime24, 0);
  const endISO = toElSalvadorUtcIso(dateISO, receptionTime24, 7);
  const details = `Estimado/a ${guestName}: Nos alegra enormemente contar con su asistencia a nuestra boda.\n\n${ceremonyTimeLabel} - Ceremonia Religiosa (${ceremonyVenue}, ${ceremonyAddress}).\n${receptionTimeLabel} - Recepción y Celebración (${receptionVenue}, ${receptionAddress})${tableText}.`;
  const location = `${receptionVenue} & ${ceremonyVenue}`;
  const formatTime = (iso: string) =>
    iso.replace(/[-:]/g, '').split('.')[0] + 'Z';
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${formatTime(startISO)}/${formatTime(endISO)}&details=${encodeURIComponent(
    details
  )}&location=${encodeURIComponent(location)}`;
}

export function openCalendarDirect(url: string): void {
  if (typeof window === 'undefined') return;
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function downloadCombinedWeddingICS(
  guestName: string,
  assignedTable: number | null,
  config?: Partial<WeddingConfigRecord>
): void {
  const dateISO =
    config?.weddingDateISO || DEFAULT_WEDDING_CONFIG.weddingDateISO!;
  const ceremonyTime24 =
    config?.ceremonyTime || DEFAULT_WEDDING_CONFIG.ceremonyTime!;
  const receptionTime24 =
    config?.receptionTime || DEFAULT_WEDDING_CONFIG.receptionTime!;
  const ceremonyTimeLabel = formatTime12h(ceremonyTime24, '16:00');
  const receptionTimeLabel = formatTime12h(receptionTime24, '19:00');
  const ceremonyVenue =
    config?.ceremonyVenue?.trim() || DEFAULT_WEDDING_CONFIG.ceremonyVenue!;
  const receptionVenue =
    config?.receptionVenue?.trim() || DEFAULT_WEDDING_CONFIG.receptionVenue!;

  const tableText =
    assignedTable !== null ? ` (Mesa #${assignedTable})` : '';
  const dtStart = toElSalvadorUtcCompact(dateISO, ceremonyTime24, 0);
  const dtEnd = toElSalvadorUtcCompact(dateISO, receptionTime24, 7);
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Jessica y Jorge//Boda Digital//ES
BEGIN:VEVENT
UID:boda-jessica-jorge-2026-${Date.now()}@wedding.app
DTSTAMP:20261118T000000Z
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:Boda de Jessica Paiz y Jorge Rodas${tableText}
DESCRIPTION:Ceremonia (${ceremonyTimeLabel} · ${ceremonyVenue}) y Recepción (${receptionTimeLabel} · ${receptionVenue}) de Jessica Paiz y Jorge Rodas. Invitado: ${guestName}${tableText}.
LOCATION:${receptionVenue}, ${ceremonyVenue}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([icsContent], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Boda_Jessica_y_Jorge_Luis.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
