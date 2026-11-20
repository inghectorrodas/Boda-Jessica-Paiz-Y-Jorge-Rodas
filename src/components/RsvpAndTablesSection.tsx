import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  Heart,
  Loader2,
  MessageCircle,
  Phone,
  Search,
  UserCheck,
  Users,
  Utensils,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { SectionCornerFlorals } from './BotanicalArtwork';
import {
  buildCombinedGoogleCalendarUrl,
  buildSeatingPlan,
  buildTelContactUrl,
  buildWeddingEventsFromConfig,
  buildWhatsAppContactUrl,
  chooseTableForGuest,
  DEFAULT_WEDDING_CONFIG,
  downloadCombinedWeddingICS,
  extractSurnames,
  generateSafeId,
  getGuestRelationLabel,
  GUEST_RELATION_GROUPS,
  GuestParty,
  GuestQuotaRecord,
  GuestRelationGroup,
  INITIAL_GUEST_PARTIES,
  isAuthorizedCoupleEmail,
  isValidPhoneKey,
  mergeWeddingConfig,
  normalizePhoneKey,
  normalizeText,
  openCalendarDirect,
  TABLE_CAPACITY,
  WeddingConfigRecord,
} from '../data/weddingData';
import { buildGoogleCalendarUrlForEvent } from '../utils/calendarHelper';

interface ConfirmationSummary {
  guestName: string;
  attending: boolean;
  adults: number;
  kids: number;
  babies: number;
  assignedTable: number | null;
  matchedFamily: boolean;
  alreadyConfirmed?: boolean;
}

type LookupStatus =
  | 'idle'
  | 'searching'
  | 'found'
  | 'not_found'
  | 'already_confirmed';

export const RsvpAndTablesSection: React.FC = () => {
  const [liveSeatingParties, setLiveSeatingParties] = useState<GuestParty[]>([]);
  const [weddingConfig, setWeddingConfig] = useState<WeddingConfigRecord>(
    DEFAULT_WEDDING_CONFIG
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const configuredTotalTables = weddingConfig.totalTables ?? 10;
  const tablesVisibleToGuests = Boolean(weddingConfig.tablesVisibleToGuests);
  const adminPhone =
    weddingConfig.adminPhone || DEFAULT_WEDDING_CONFIG.adminPhone || '+503 76874760';
  const groomPhone =
    weddingConfig.groomPhone || DEFAULT_WEDDING_CONFIG.groomPhone || '+503 78249210';
  const liveEvents = useMemo(
    () => buildWeddingEventsFromConfig(weddingConfig),
    [weddingConfig]
  );

  // Step 1: Phone Lookup state
  const [phoneInput, setPhoneInput] = useState('');
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const [lookupError, setLookupError] = useState('');
  const [matchedQuota, setMatchedQuota] = useState<GuestQuotaRecord | null>(
    null
  );

  // Step 2: RSVP Confirmation state (bounded by matchedQuota)
  const [guestGroup, setGuestGroup] = useState<GuestRelationGroup | ''>('');
  const [notes, setNotes] = useState('');
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [babies, setBabies] = useState(0);
  const [attendance, setAttendance] = useState<'yes' | 'no'>('yes');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationSummary | null>(
    null
  );

  // Table search state
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'seating_entries'),
      orderBy('createdAt', 'asc')
    );

    const unsubSeating = onSnapshot(
      q,
      (snapshot) => {
        const loaded: GuestParty[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: String(data.displayName ?? ''),
            surnames: Array.isArray(data.surnames)
              ? data.surnames.map(String)
              : [],
            adults: Number(data.seatCount ?? 1),
            kids: 0,
            babies: Number(data.babiesCount ?? 0),
            tableNumber: Number(data.tableNumber ?? 1),
            isUserSubmitted: true,
          };
        });
        setLiveSeatingParties(loaded);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'seating_entries');
      }
    );

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });

    const unsubConfig = onSnapshot(
      doc(db, 'wedding_settings', 'main'),
      (snapshot) => {
        if (snapshot.exists()) {
          setWeddingConfig(mergeWeddingConfig(snapshot.data()));
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'wedding_settings/main');
      }
    );

    return () => {
      unsubAuth();
      unsubSeating();
      unsubConfig();
    };
  }, []);

  const isCoupleOrAdmin = Boolean(
    currentUser && isAuthorizedCoupleEmail(currentUser.email)
  );
  const canSeeTablesSection = isCoupleOrAdmin || tablesVisibleToGuests;

  const allParties = useMemo(
    () => [...INITIAL_GUEST_PARTIES, ...liveSeatingParties],
    [liveSeatingParties]
  );

  const tables = useMemo(
    () => buildSeatingPlan(allParties, configuredTotalTables),
    [allParties, configuredTotalTables]
  );

  const normalizedQuery = normalizeText(searchQuery);

  const matchingTables = useMemo(() => {
    if (!normalizedQuery) return new Set<number>();
    const matches = new Set<number>();
    for (const table of tables) {
      const hit = table.parties.some(
        (party) =>
          normalizeText(party.name).includes(normalizedQuery) ||
          party.surnames.some((s) => s.includes(normalizedQuery))
      );
      if (hit) matches.add(table.tableNumber);
    }
    return matches;
  }, [tables, normalizedQuery]);

  const handlePhoneLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    setFormError('');

    const phoneKey = normalizePhoneKey(phoneInput);
    if (!isValidPhoneKey(phoneKey)) {
      setLookupError(
        'Ingresa un número de teléfono válido (al menos 8 dígitos, ej. 7687-4760 o +503 76874760).'
      );
      return;
    }

    setLookupStatus('searching');

    try {
      const quotaSnap = await getDoc(doc(db, 'guest_quotas', phoneKey));
      if (!quotaSnap.exists()) {
        setMatchedQuota(null);
        setLookupStatus('not_found');
        return;
      }

      const d = quotaSnap.data();
      const quota: GuestQuotaRecord = {
        phoneKey: String(d.phoneKey ?? phoneKey),
        phoneDisplay: String(d.phoneDisplay ?? phoneInput.trim()),
        guestName: String(d.guestName ?? ''),
        maxAdults: Math.max(1, Number(d.maxAdults ?? 1)),
        maxKids: Math.max(0, Number(d.maxKids ?? 0)),
        maxBabies: Math.max(0, Number(d.maxBabies ?? 0)),
        assignedTable: Math.max(0, Number(d.assignedTable ?? 0)),
        guestGroup: (d.guestGroup as GuestRelationGroup | '') ?? '',
        notes: String(d.notes ?? ''),
        confirmed: Boolean(d.confirmed),
        rsvpId: String(d.rsvpId ?? ''),
      };

      setMatchedQuota(quota);

      if (quota.confirmed) {
        let confirmedTable: number | null =
          quota.assignedTable > 0 ? quota.assignedTable : null;
        let confirmedSeats = quota.maxAdults + quota.maxKids;
        let confirmedBabies = quota.maxBabies;
        let isAttending = true;

        if (quota.rsvpId) {
          try {
            const seatSnap = await getDoc(
              doc(db, 'seating_entries', quota.rsvpId)
            );
            if (seatSnap.exists()) {
              const s = seatSnap.data();
              confirmedTable = Number(s.tableNumber ?? confirmedTable ?? 1);
              confirmedSeats = Number(s.seatCount ?? confirmedSeats);
              confirmedBabies = Number(s.babiesCount ?? confirmedBabies);
              isAttending = true;
            } else {
              isAttending = false;
              confirmedTable = null;
            }
          } catch {
            // Keep quota fallback info if seating lookup fails
          }
        }

        setLookupStatus('already_confirmed');
        setConfirmation({
          guestName: quota.guestName,
          attending: isAttending,
          adults: Math.min(quota.maxAdults, confirmedSeats),
          kids: Math.max(0, confirmedSeats - quota.maxAdults),
          babies: confirmedBabies,
          assignedTable: confirmedTable,
          matchedFamily: false,
          alreadyConfirmed: true,
        });
        return;
      }

      // Ready to confirm within exact quota limits
      setAdults(quota.maxAdults);
      setKids(quota.maxKids);
      setBabies(quota.maxBabies);
      setGuestGroup(quota.guestGroup || '');
      setAttendance('yes');
      setNotes('');
      setLookupStatus('found');
    } catch (error) {
      try {
        handleFirestoreError(
          error,
          OperationType.GET,
          `guest_quotas/${phoneKey}`
        );
      } catch {
        setLookupError(
          'No pudimos consultar tu invitación en este momento. Intenta nuevamente.'
        );
        setLookupStatus('idle');
      }
    }
  };

  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedQuota) return;

    const finalGroup = matchedQuota.guestGroup || guestGroup;
    if (!finalGroup) {
      setFormError(
        'Por favor selecciona si eres familiar o amigo del novio o de la novia.'
      );
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    const isAttending = attendance === 'yes';
    const safeAdults = isAttending
      ? Math.min(matchedQuota.maxAdults, Math.max(1, adults))
      : matchedQuota.maxAdults;
    const safeKids = isAttending
      ? Math.min(matchedQuota.maxKids, Math.max(0, kids))
      : 0;
    const safeBabies = isAttending
      ? Math.min(matchedQuota.maxBabies, Math.max(0, babies))
      : 0;
    const safePhone = (matchedQuota.phoneDisplay || phoneInput)
      .trim()
      .slice(0, 30);
    const safeNotes = notes.trim().slice(0, 300);

    const smartChoice = chooseTableForGuest(
      allParties,
      matchedQuota.guestName,
      safeAdults,
      safeKids,
      configuredTotalTables
    );
    const surnames =
      smartChoice.surnames.length > 0
        ? smartChoice.surnames
        : extractSurnames(matchedQuota.guestName);
    const assignedTable =
      matchedQuota.assignedTable > 0
        ? matchedQuota.assignedTable
        : smartChoice.assignedTable;

    const entryId = generateSafeId('rsvp');
    const finalTable = isAttending ? assignedTable : 0;

    // Open the Calendar app synchronously inside the user click gesture
    if (isAttending) {
      openCalendarDirect(
        buildCombinedGoogleCalendarUrl(
          matchedQuota.guestName,
          assignedTable,
          weddingConfig
        )
      );
    }

    try {
      const batch = writeBatch(db);

      batch.set(doc(db, 'rsvps', entryId), {
        id: entryId,
        guestName: matchedQuota.guestName,
        surnames,
        adults: safeAdults,
        kids: safeKids,
        babies: safeBabies,
        attending: isAttending,
        tableNumber: finalTable,
        phone: safePhone,
        phoneKey: matchedQuota.phoneKey,
        notes: safeNotes,
        guestGroup: finalGroup,
        createdAt: serverTimestamp(),
      });

      if (isAttending) {
        batch.set(doc(db, 'seating_entries', entryId), {
          id: entryId,
          displayName: matchedQuota.guestName,
          surnames,
          seatCount: Math.min(18, Math.max(1, safeAdults + safeKids)),
          babiesCount: safeBabies,
          tableNumber: assignedTable,
          createdAt: serverTimestamp(),
        });
      }

      batch.update(doc(db, 'guest_quotas', matchedQuota.phoneKey), {
        confirmed: true,
        rsvpId: entryId,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      if (isAttending) {
        setSearchQuery(
          surnames[surnames.length - 1] ?? matchedQuota.guestName
        );
      }

      setConfirmation({
        guestName: matchedQuota.guestName,
        attending: isAttending,
        adults: isAttending ? safeAdults : 0,
        kids: isAttending ? safeKids : 0,
        babies: isAttending ? safeBabies : 0,
        assignedTable: isAttending ? assignedTable : null,
        matchedFamily:
          matchedQuota.assignedTable === 0 && smartChoice.matchedFamily,
      });
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, `rsvps/${entryId}`);
      } catch {
        setFormError(
          'No pudimos guardar tu confirmación en este momento. Si ya confirmaste anteriormente, comunícate con los novios.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetRsvp = () => {
    setPhoneInput('');
    setLookupStatus('idle');
    setLookupError('');
    setMatchedQuota(null);
    setGuestGroup('');
    setNotes('');
    setAdults(1);
    setKids(0);
    setBabies(0);
    setAttendance('yes');
    setFormError('');
    setConfirmation(null);
  };

  const totalConfirmedGuests = useMemo(
    () => allParties.reduce((acc, p) => acc + p.adults + p.kids, 0),
    [allParties]
  );

  const notFoundMessage = `Hola, intenté confirmar mi asistencia a la boda de Jessica & Jorge con el teléfono ${phoneInput.trim() || '(sin número)'} pero no aparece en la lista registrada. ¿Podrían ayudarme?`;

  const changeConfirmedMessage = `Hola, ya había confirmado mi asistencia a la boda de Jessica & Jorge (${matchedQuota?.guestName ?? ''}, tel: ${matchedQuota?.phoneDisplay || phoneInput.trim()}), ¿podrían ayudarme a realizar un cambio?`;

  return (
    <>
      {/* RSVP SECTION */}
      <section
        id="rsvp"
        className="relative overflow-hidden py-16 sm:py-20 px-4 sm:px-6 bg-[#f7f5f0] border-t border-[#b89753]/25"
      >
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.22em] text-[#b89753] font-semibold">
              Reserva tu lugar
            </p>
            <h2 className="mt-2 font-serif text-4xl sm:text-5xl font-semibold text-[#2c3e35]">
              Confirmación de Asistencia
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#2c3e35]/75 max-w-xl mx-auto leading-relaxed">
              Ingresa tu número de teléfono para consultar automáticamente tus
              sillas y platos asignados e iniciar tu confirmación.
            </p>
          </div>

          {/* VIEW 4: CONFIRMATION SUMMARY (Just submitted or already confirmed) */}
          {confirmation ? (
            <div className="bg-white border border-[#b89753]/40 rounded-2xl p-5 sm:p-8 text-center shadow-sm space-y-5">
              <div className="w-12 h-12 rounded-full bg-[#f7f5f0] text-[#2c3e35] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-[#b89753]" />
              </div>

              {confirmation.attending ? (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#b89753] font-semibold">
                      {confirmation.alreadyConfirmed
                        ? 'Invitación Ya Confirmada'
                        : 'Asistencia Confirmada'}
                    </p>
                    <h3 className="mt-1 font-serif text-3xl font-semibold text-[#2c3e35]">
                      ¡Gracias, {confirmation.guestName}!
                    </h3>
                  </div>

                  <p className="text-sm text-[#2c3e35]/80 max-w-md mx-auto leading-relaxed">
                    {confirmation.alreadyConfirmed
                      ? 'Tu confirmación ya se encontraba registrada con tu cupo de sillas y platos.'
                      : 'Tu lugar ha sido guardado en la nube'}
                    {!confirmation.alreadyConfirmed &&
                      (confirmation.matchedFamily
                        ? ' y agrupado automáticamente junto a familiares con tu apellido.'
                        : ' con tus platos y sillas reservados.')}
                  </p>

                  <div className="border-y border-[#b89753]/20 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto text-sm">
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-[#2c3e35]/55">
                        Mesa Asignada
                      </span>
                      <span className="font-serif text-2xl font-semibold text-[#b89753] tabular-nums">
                        {confirmation.assignedTable
                          ? `Mesa #${confirmation.assignedTable}`
                          : 'Por asignar'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-[#2c3e35]/55">
                        Sillas y Platos
                      </span>
                      <span className="font-medium text-[#2c3e35] tabular-nums">
                        {confirmation.adults} adulto
                        {confirmation.adults === 1 ? '' : 's'}
                        {confirmation.kids > 0
                          ? ` · ${confirmation.kids} niño${confirmation.kids === 1 ? '' : 's'}`
                          : ''}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs uppercase tracking-wider text-[#2c3e35]/55">
                        Bebés
                      </span>
                      <span className="font-medium text-[#2c3e35] tabular-nums">
                        {confirmation.babies > 0
                          ? `${confirmation.babies} en regazo`
                          : 'Ninguno'}
                      </span>
                    </div>
                  </div>

                  {/* Calendar Schedule Summary & Direct Open App Links */}
                  <div className="rounded-xl bg-[#fcfbf9] border border-[#b89753]/25 p-4 sm:p-5 text-left space-y-3.5 max-w-xl mx-auto">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#b89753] font-semibold text-center">
                      Agendar en tu Calendario
                    </p>
                    <p className="text-xs text-[#2c3e35]/70 text-center leading-relaxed">
                      Guarda la fecha, hora y lugar de nuestra boda en tu
                      calendario favorito:
                    </p>

                    <div className="text-center">
                      <a
                        href={buildCombinedGoogleCalendarUrl(
                          confirmation.guestName,
                          confirmation.assignedTable,
                          weddingConfig
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-full bg-[#b89753] hover:bg-[#967739] text-white text-xs font-semibold tracking-wide transition-colors"
                      >
                        <CalendarPlus className="w-4 h-4 shrink-0" />
                        <span>Abrir Calendario (Ceremonia y Recepción)</span>
                      </a>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {liveEvents.map((ev) => (
                        <a
                          key={ev.id}
                          href={buildGoogleCalendarUrlForEvent(
                            ev,
                            confirmation.assignedTable
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col justify-between rounded-xl bg-white border border-[#b89753]/35 p-3.5 hover:border-[#b89753] transition-colors"
                        >
                          <div>
                            <span className="text-xs font-semibold text-[#2c3e35] block">
                              {ev.title} · {ev.timeLabel}
                            </span>
                            <span className="text-[11px] text-[#2c3e35]/65 block mt-0.5">
                              {ev.venue}
                            </span>
                          </div>
                          <span className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#b89753]">
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span>
                              Agendar solo{' '}
                              {ev.id === 'ceremony' ? 'Ceremonia' : 'Recepción'}
                            </span>
                          </span>
                        </a>
                      ))}
                    </div>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          downloadCombinedWeddingICS(
                            confirmation.guestName,
                            confirmation.assignedTable,
                            weddingConfig
                          )
                        }
                        className="inline-flex items-center justify-center gap-1.5 text-[11px] text-[#2c3e35]/65 underline underline-offset-4 hover:text-[#b89753] cursor-pointer text-center"
                      >
                        <span>
                          ¿Usas Apple Calendar u Outlook? Descargar invitación
                          (.ics)
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-serif text-3xl font-semibold text-[#2c3e35]">
                    Gracias por avisarnos, {confirmation.guestName}
                  </h3>
                  <p className="text-sm text-[#2c3e35]/75 max-w-md mx-auto">
                    Tu respuesta quedó registrada para los novios. Sentiremos
                    mucho no contar con tu presencia y agradecemos tus buenos
                    deseos.
                  </p>
                </>
              )}

              {confirmation.alreadyConfirmed && (
                <div className="max-w-lg mx-auto rounded-xl bg-[#f7f5f0] border border-[#b89753]/25 p-3.5 text-xs text-[#2c3e35]/75 space-y-2">
                  <p>
                    ¿Necesitas modificar la cantidad de asistentes o actualizar
                    tu respuesta? Contáctanos directamente:
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <a
                      href={buildWhatsAppContactUrl(
                        adminPhone,
                        changeConfirmedMessage
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#b89753]/40 text-[#2c3e35] font-semibold hover:border-[#b89753]"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Administrador ({adminPhone})</span>
                    </a>
                    <a
                      href={buildWhatsAppContactUrl(
                        groomPhone,
                        changeConfirmedMessage
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#b89753]/40 text-[#2c3e35] font-semibold hover:border-[#b89753]"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Novio ({groomPhone})</span>
                    </a>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                {confirmation.attending && canSeeTablesSection && (
                  <a
                    href="#mesas"
                    className="px-6 py-2.5 rounded-full bg-[#2c3e35] text-white text-xs font-medium tracking-wide hover:bg-[#1f2c26] transition-colors whitespace-nowrap"
                  >
                    Ver mi mesa en el plano
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleResetRsvp}
                  className="px-6 py-2.5 rounded-full border border-[#b89753]/50 text-[#2c3e35] text-xs font-medium hover:bg-[#f7f5f0] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Consultar otro teléfono
                </button>
              </div>
            </div>
          ) : lookupStatus === 'not_found' ? (
            /* VIEW 2: UNREGISTERED PHONE NOTICE WITH ADMIN & GROOM CONTACT */
            <div className="bg-white border border-[#b89753]/40 rounded-2xl p-6 sm:p-9 shadow-sm space-y-6 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div className="space-y-3 max-w-lg mx-auto">
                <p className="text-xs uppercase tracking-[0.2em] text-[#b89753] font-semibold">
                  NÚMERO NO REGISTRADO
                </p>
                <h3 className="font-serif text-3xl font-semibold text-[#2c3e35]">
                  ¡Queremos confirmar tu asistencia!
                </h3>
                <p className="text-sm text-[#2c3e35]/85 leading-relaxed">
                  El número de teléfono{' '}
                  <strong className="text-[#2c3e35] tabular-nums">
                    {phoneInput.trim()}
                  </strong>{' '}
                  no se encuentra registrado en nuestra lista oficial de
                  invitados.
                </p>
                <p className="text-sm text-[#2c3e35]/75 leading-relaxed">
                  Para garantizar la correcta organización de nuestro evento y
                  la disponibilidad de tu espacio, la confirmación de asistencia
                  está habilitada únicamente para los números previamente
                  registrados.
                </p>

                <div className="pt-2 rounded-xl bg-[#fcfbf9] border border-[#b89753]/25 p-4 text-center space-y-1.5">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#b89753] font-semibold">
                    ¿Qué puedes hacer?
                  </p>
                  <p className="text-xs sm:text-sm text-[#2c3e35]/80 leading-relaxed">
                    Si cambiaste de número, recibiste una invitación
                    recientemente o consideras que se trata de un error,
                    comunícate con nosotros para verificar tus datos y habilitar
                    tu confirmación.
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-[#2c3e35]">
                    Estaremos encantados de ayudarte.
                  </p>
                </div>
              </div>

              <div className="space-y-3 max-w-xl mx-auto">
                <p className="text-xs uppercase tracking-[0.18em] text-[#2c3e35]/70 font-semibold">
                  Contactos para asistencia:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className="rounded-xl bg-[#fcfbf9] border border-[#b89753]/30 p-4 space-y-3 text-center">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#b89753] font-semibold text-center">
                        Admin Hector Rodas (Padrino de Tarjeta)
                      </p>
                      <p className="font-serif text-xl font-semibold text-[#2c3e35] mt-0.5 tabular-nums">
                        {adminPhone}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={buildWhatsAppContactUrl(
                          adminPhone,
                          notFoundMessage
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#2c3e35] hover:bg-[#1f2c26] text-white text-xs font-semibold transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#b89753]" />
                        <span>WhatsApp</span>
                      </a>
                      <a
                        href={buildTelContactUrl(adminPhone)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#b89753]/45 text-[#2c3e35] hover:bg-[#f7f5f0] text-xs font-semibold transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#b89753]" />
                        <span>Llamar</span>
                      </a>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#fcfbf9] border border-[#b89753]/30 p-4 space-y-3 text-center">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#b89753] font-semibold">
                        Jorge Luis (Novio)
                      </p>
                      <p className="font-serif text-xl font-semibold text-[#2c3e35] mt-0.5 tabular-nums">
                        {groomPhone}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={buildWhatsAppContactUrl(
                          groomPhone,
                          notFoundMessage
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#2c3e35] hover:bg-[#1f2c26] text-white text-xs font-semibold transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#b89753]" />
                        <span>WhatsApp</span>
                      </a>
                      <a
                        href={buildTelContactUrl(groomPhone)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#b89753]/45 text-[#2c3e35] hover:bg-[#f7f5f0] text-xs font-semibold transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#b89753]" />
                        <span>Llamar</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs sm:text-sm italic text-[#2c3e35]/75">
                Gracias por ayudarnos a preparar este día tan especial.
              </p>

              <div>
                <button
                  type="button"
                  onClick={handleResetRsvp}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#b89753]/50 text-[#2c3e35] text-xs font-semibold hover:bg-[#f7f5f0] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Probar con otro número de teléfono</span>
                </button>
              </div>
            </div>
          ) : lookupStatus === 'found' && matchedQuota ? (
            /* VIEW 3: REGISTERED GUEST QUOTA DISPLAY & BOUNDED CONFIRMATION FORM */
            <form
              onSubmit={handleRsvpSubmit}
              className="bg-white border border-[#b89753]/35 rounded-2xl p-6 sm:p-9 shadow-sm space-y-6"
              noValidate
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#b89753]/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#f7f5f0] border border-[#b89753]/35 text-[#b89753] flex items-center justify-center shrink-0 mt-0.5">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[#b89753] font-semibold">
                      Invitación Verificada · Tel.{' '}
                      {matchedQuota.phoneDisplay || phoneInput.trim()}
                    </p>
                    <h3 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2c3e35]">
                      {matchedQuota.guestName}
                    </h3>
                    {matchedQuota.guestGroup && (
                      <p className="text-xs text-[#2c3e35]/65 mt-0.5">
                        {getGuestRelationLabel(matchedQuota.guestGroup)}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetRsvp}
                  className="self-start sm:self-center inline-flex items-center gap-1.5 text-xs font-semibold text-[#2c3e35]/65 hover:text-[#b89753] cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Cambiar teléfono</span>
                </button>
              </div>

              {/* Assigned Quota Breakdown Banner */}
              <div className="rounded-xl bg-[#fcfbf9] border border-[#b89753]/30 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Cupo Asignado para tu Invitación</span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-white border border-[#b89753]/20 py-3 px-2">
                    <span className="block font-serif text-2xl sm:text-3xl font-semibold text-[#2c3e35] tabular-nums">
                      {matchedQuota.maxAdults + matchedQuota.maxKids}
                    </span>
                    <span className="block text-[11px] text-[#2c3e35]/70 font-medium">
                      Silla
                      {matchedQuota.maxAdults + matchedQuota.maxKids === 1
                        ? ''
                        : 's'}{' '}
                      asignada
                      {matchedQuota.maxAdults + matchedQuota.maxKids === 1
                        ? ''
                        : 's'}
                    </span>
                  </div>
                  <div className="rounded-xl bg-white border border-[#b89753]/20 py-3 px-2">
                    <span className="block font-serif text-2xl sm:text-3xl font-semibold text-[#b89753] tabular-nums">
                      {matchedQuota.maxAdults}
                    </span>
                    <span className="block text-[11px] text-[#2c3e35]/70 font-medium">
                      Plato{matchedQuota.maxAdults === 1 ? '' : 's'} adulto
                    </span>
                  </div>
                  <div className="rounded-xl bg-white border border-[#b89753]/20 py-3 px-2">
                    <span className="block font-serif text-2xl sm:text-3xl font-semibold text-[#2c3e35] tabular-nums">
                      {matchedQuota.maxKids}
                    </span>
                    <span className="block text-[11px] text-[#2c3e35]/70 font-medium">
                      Plato{matchedQuota.maxKids === 1 ? '' : 's'} niño
                    </span>
                  </div>
                </div>

                {matchedQuota.maxBabies > 0 && (
                  <p className="text-center text-xs text-[#2c3e35]/65">
                    + {matchedQuota.maxBabies} bebé
                    {matchedQuota.maxBabies === 1 ? '' : 's'} permitido
                    {matchedQuota.maxBabies === 1 ? '' : 's'} en regazo (sin
                    silla ni plato adicional).
                  </p>
                )}
              </div>

              {/* Attendance & Group */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="attendanceStatus"
                    className="block text-sm font-medium text-[#2c3e35] mb-2"
                  >
                    ¿Confirmas tu asistencia?
                  </label>
                  <select
                    id="attendanceStatus"
                    value={attendance}
                    onChange={(e) =>
                      setAttendance(e.target.value as 'yes' | 'no')
                    }
                    className="w-full h-12 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-4 text-sm text-[#2c3e35] focus:outline-none focus:border-[#b89753]"
                  >
                    <option value="yes">¡Sí, ahí estaré con mucho gusto!</option>
                    <option value="no">Lamentablemente no podré asistir</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="guestGroupSelect"
                    className="block text-sm font-medium text-[#2c3e35] mb-2"
                  >
                    Vínculo con los Novios
                  </label>
                  <select
                    id="guestGroupSelect"
                    required
                    disabled={Boolean(matchedQuota.guestGroup)}
                    value={matchedQuota.guestGroup || guestGroup}
                    onChange={(e) =>
                      setGuestGroup(e.target.value as GuestRelationGroup | '')
                    }
                    className="w-full h-12 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-4 text-sm text-[#2c3e35] disabled:opacity-75 focus:outline-none focus:border-[#b89753]"
                  >
                    <option value="">Selecciona una opción...</option>
                    {GUEST_RELATION_GROUPS.map((group) => (
                      <option key={group.value} value={group.value}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bounded Seat/Plate Selection (Cannot exceed assigned quota) */}
              {attendance === 'yes' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="adultsCount"
                        className="block text-sm font-medium text-[#2c3e35] mb-1.5"
                      >
                        Adultos (plato adulto)
                      </label>
                      <select
                        id="adultsCount"
                        value={adults}
                        onChange={(e) => setAdults(Number(e.target.value))}
                        className="w-full h-12 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-4 text-sm text-[#2c3e35] tabular-nums focus:outline-none focus:border-[#b89753]"
                      >
                        {Array.from(
                          { length: matchedQuota.maxAdults },
                          (_, i) => i + 1
                        ).map((num) => (
                          <option key={num} value={num}>
                            {num} adulto{num === 1 ? '' : 's'} ({num} plato
                            {num === 1 ? '' : 's'})
                          </option>
                        ))}
                      </select>
                      <span className="block text-[11px] text-[#2c3e35]/55 mt-1">
                        Máximo asignado: {matchedQuota.maxAdults}
                      </span>
                    </div>

                    <div>
                      <label
                        htmlFor="kidsCount"
                        className="block text-sm font-medium text-[#2c3e35] mb-1.5"
                      >
                        Niños (plato niño)
                      </label>
                      <select
                        id="kidsCount"
                        disabled={matchedQuota.maxKids === 0}
                        value={kids}
                        onChange={(e) => setKids(Number(e.target.value))}
                        className="w-full h-12 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-4 text-sm text-[#2c3e35] tabular-nums disabled:opacity-60 focus:outline-none focus:border-[#b89753]"
                      >
                        {Array.from(
                          { length: matchedQuota.maxKids + 1 },
                          (_, i) => i
                        ).map((num) => (
                          <option key={num} value={num}>
                            {num} niño{num === 1 ? '' : 's'} ({num} plato
                            {num === 1 ? '' : 's'})
                          </option>
                        ))}
                      </select>
                      <span className="block text-[11px] text-[#2c3e35]/55 mt-1">
                        Máximo asignado: {matchedQuota.maxKids}
                      </span>
                    </div>

                    <div>
                      <label
                        htmlFor="babiesCount"
                        className="block text-sm font-medium text-[#2c3e35] mb-1.5"
                      >
                        Bebés (regazo)
                      </label>
                      <select
                        id="babiesCount"
                        disabled={matchedQuota.maxBabies === 0}
                        value={babies}
                        onChange={(e) => setBabies(Number(e.target.value))}
                        className="w-full h-12 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-4 text-sm text-[#2c3e35] tabular-nums disabled:opacity-60 focus:outline-none focus:border-[#b89753]"
                      >
                        {Array.from(
                          { length: matchedQuota.maxBabies + 1 },
                          (_, i) => i
                        ).map((num) => (
                          <option key={num} value={num}>
                            {num} bebé{num === 1 ? '' : 's'}
                          </option>
                        ))}
                      </select>
                      <span className="block text-[11px] text-[#2c3e35]/55 mt-1">
                        Máximo asignado: {matchedQuota.maxBabies}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#2c3e35]/80 bg-[#f7f5f0] border border-[#b89753]/25 rounded-xl px-4 py-2.5 text-center font-medium tabular-nums">
                    Confirmarás: <strong>{adults + kids} silla{adults + kids === 1 ? '' : 's'}</strong> ·{' '}
                    <strong>{adults} plato{adults === 1 ? '' : 's'} de adulto</strong>
                    {kids > 0
                      ? ` · ${kids} plato${kids === 1 ? '' : 's'} de niño`
                      : ''}
                    {babies > 0
                      ? ` · ${babies} bebé${babies === 1 ? '' : 's'} en regazo`
                      : ''}
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="guestNotes"
                  className="block text-sm font-medium text-[#2c3e35] mb-2"
                >
                  Mensaje para los novios o restricción alimentaria (opcional)
                </label>
                <textarea
                  id="guestNotes"
                  rows={2}
                  maxLength={300}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Alergia a mariscos, silla alta para bebé o buenos deseos..."
                  className="w-full bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl px-4 py-3 text-sm text-[#2c3e35] placeholder:text-[#2c3e35]/40 focus:outline-none focus:border-[#b89753] focus:ring-1 focus:ring-[#b89753]"
                />
              </div>

              {formError && (
                <p
                  role="alert"
                  className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5"
                >
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl bg-[#b89753] hover:bg-[#967739] disabled:opacity-60 text-white text-sm font-semibold tracking-wide transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {isSubmitting
                    ? 'Registrando confirmación...'
                    : 'Confirmar Mi Asistencia'}
                </span>
              </button>
            </form>
          ) : (
            /* VIEW 1: PHONE ENTRY TO START RSVP */
            <form
              onSubmit={handlePhoneLookup}
              className="bg-white border border-[#b89753]/30 rounded-2xl p-6 sm:p-10 shadow-sm space-y-5 max-w-xl mx-auto"
              noValidate
            >
              <div>
                <label
                  htmlFor="lookupPhoneInput"
                  className="block text-sm font-medium text-[#2c3e35] mb-2"
                >
                  Número de Teléfono / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#b89753] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="lookupPhoneInput"
                    type="tel"
                    inputMode="tel"
                    required
                    maxLength={30}
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="Ej. 7687-4760 o +503 76874760"
                    className="w-full h-12 bg-[#fcfbf9] border border-[#b89753]/35 rounded-xl pl-11 pr-4 text-sm text-[#2c3e35] placeholder:text-[#2c3e35]/40 focus:outline-none focus:border-[#b89753] focus:ring-1 focus:ring-[#b89753]"
                  />
                </div>
                <p className="mt-2 text-xs text-[#2c3e35]/60">
                  Verificaremos tu teléfono en la lista de invitados para
                  mostrarte tus sillas y platos asignados.
                </p>
              </div>

              {lookupError && (
                <p
                  role="alert"
                  className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5"
                >
                  {lookupError}
                </p>
              )}

              <button
                type="submit"
                disabled={lookupStatus === 'searching'}
                className="w-full h-12 rounded-xl bg-[#b89753] hover:bg-[#967739] disabled:opacity-60 text-white text-sm font-semibold tracking-wide transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                {lookupStatus === 'searching' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>
                  {lookupStatus === 'searching'
                    ? 'Buscando tu invitación...'
                    : 'Buscar mi Invitación'}
                </span>
              </button>
            </form>
          )}
        </div>
        <SectionCornerFlorals variant="alternating" />
      </section>

      {/* INTELLIGENT TABLE ORGANIZER & SEARCH (Admins/Groom always; Guests when enabled) */}
      {canSeeTablesSection && (
        <section
          id="mesas"
          className="relative overflow-hidden py-16 sm:py-20 px-4 sm:px-6"
        >
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="text-center max-w-2xl mx-auto mb-10">
              {isCoupleOrAdmin && !tablesVisibleToGuests && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-300/70 text-amber-900 text-[11px] font-semibold mb-4">
                  <span>
                    Modo Privado · Oculta para invitados (solo visible para
                    Administradores y Novio)
                  </span>
                </div>
              )}
              <p className="text-xs uppercase tracking-[0.22em] text-[#b89753] font-semibold">
                Organización de Salón · Mesas de 10
              </p>
              <h2 className="mt-2 font-serif text-4xl sm:text-5xl font-semibold text-[#2c3e35]">
                Buscador y Distribución de Mesas
              </h2>
              <p className="mt-3 text-sm sm:text-base text-[#2c3e35]/75 leading-relaxed">
                Ingresa tu apellido para localizar tu mesa. Las familias se
                agrupan por afinidad de apellidos en mesas de 10 personas
                alrededor de la Mesa Principal.
              </p>
            </div>

            {/* Search Toolbar */}
            <div className="max-w-xl mx-auto mb-10">
              <div className="bg-white border border-[#b89753]/35 rounded-2xl p-2 sm:p-2.5 flex items-center gap-2 shadow-sm">
                <Search className="w-4 h-4 text-[#b89753] ml-2 sm:ml-2.5 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por apellido (ej. Rodas, Benítez)..."
                  aria-label="Buscar mesa por apellido"
                  className="flex-1 min-w-0 bg-transparent px-2 py-2 text-sm text-[#2c3e35] placeholder:text-[#2c3e35]/45 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="px-3 py-1.5 text-xs font-medium text-[#2c3e35]/70 hover:text-[#2c3e35] cursor-pointer whitespace-nowrap"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Search Feedback */}
              <div className="mt-3 text-center min-h-[24px]">
                {normalizedQuery ? (
                  matchingTables.size > 0 ? (
                    <p className="text-sm text-[#2c3e35] font-medium">
                      Encontrado en{' '}
                      <span className="text-[#b89753] font-semibold">
                        {Array.from(matchingTables)
                          .map((n) => `Mesa #${n}`)
                          .join(', ')}
                      </span>{' '}
                      · Resaltada abajo en el plano del salón
                    </p>
                  ) : (
                    <p className="text-sm text-[#2c3e35]/65">
                      No encontramos el apellido &ldquo;{searchQuery}&rdquo; aún.{' '}
                      <a
                        href="#rsvp"
                        className="text-[#b89753] underline underline-offset-4 hover:text-[#967739]"
                      >
                        Confirma tu asistencia arriba
                      </a>{' '}
                      para asignarte una mesa.
                    </p>
                  )
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-[#2c3e35]/60 tabular-nums">
                    <span>{tables.length} mesas configuradas</span>
                    <span aria-hidden="true">·</span>
                    <span>{totalConfirmedGuests} lugares asignados</span>
                    <span aria-hidden="true">·</span>
                    <span>Capacidad de {TABLE_CAPACITY} personas por mesa</span>
                  </div>
                )}
              </div>
            </div>

            {/* Head Table Anchor */}
            <div className="max-w-md mx-auto mb-10">
              <div className="bg-[#2c3e35] text-[#fcfbf9] rounded-2xl px-6 py-5 text-center border border-[#b89753]/50 shadow-sm">
                <div className="flex items-center justify-center gap-2 text-[#b89753] text-xs uppercase tracking-[0.2em] font-semibold">
                  <Heart className="w-3.5 h-3.5" />
                  <span>Mesa Principal de los Novios</span>
                </div>
                <p className="mt-1.5 font-['Great_Vibes'] text-3xl sm:text-4xl font-normal text-[#f7f5f0]">
                  Jessica Guadalupe{' '}
                  <span className="font-serif italic text-[#b89753] text-2xl sm:text-3xl">
                    &amp;
                  </span>{' '}
                  Jorge Luis
                </p>
              </div>
            </div>

            {/* Tables Grid (Mesas de 10) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tables.map((table) => {
                const isHighlighted = matchingTables.has(table.tableNumber);
                const remaining = Math.max(
                  0,
                  table.capacity - table.occupiedSeats
                );

                return (
                  <article
                    key={table.tableNumber}
                    className={`rounded-2xl p-6 transition-all duration-200 border ${
                      isHighlighted
                        ? 'bg-white border-[#b89753] ring-2 ring-[#b89753]/30 shadow-md'
                        : 'bg-white border-[#b89753]/25 shadow-xs'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2 pb-3 border-b border-[#b89753]/15">
                      <div>
                        <h3 className="font-serif text-2xl font-semibold text-[#2c3e35]">
                          Mesa {table.tableNumber}
                        </h3>
                        <p className="text-xs text-[#b89753] font-medium">
                          {table.zoneLabel}
                        </p>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="text-sm font-semibold text-[#2c3e35]">
                          {table.occupiedSeats}/{table.capacity}
                        </span>
                        <span className="block text-[11px] text-[#2c3e35]/55">
                          {remaining > 0
                            ? `${remaining} disponibles`
                            : 'Mesa completa'}
                        </span>
                      </div>
                    </div>

                    {/* 10-seat visual ring */}
                    <div
                      className="py-3.5 flex items-center justify-between gap-1.5"
                      aria-label={`${table.occupiedSeats} de ${table.capacity} asientos ocupados`}
                    >
                      {Array.from({ length: table.capacity }).map((_, idx) => {
                        const isFilled = idx < table.occupiedSeats;
                        return (
                          <span
                            key={idx}
                            className={`h-2.5 flex-1 rounded-full transition-colors ${
                              isFilled
                                ? isHighlighted
                                  ? 'bg-[#b89753]'
                                  : 'bg-[#2c3e35]'
                                : 'bg-[#f3efe6] border border-[#b89753]/30'
                            }`}
                          />
                        );
                      })}
                    </div>

                    <p className="text-xs text-[#2c3e35]/60 mb-3">
                      {table.proximityNote}
                    </p>

                    {/* Grouped Families List */}
                    <ul className="space-y-2.5 pt-2 border-t border-[#b89753]/10">
                      {table.parties.length === 0 ? (
                        <li className="text-xs text-[#2c3e35]/50 italic">
                          Disponible para nuevos invitados
                        </li>
                      ) : (
                        table.parties.map((party) => {
                          const isPartyMatch =
                            normalizedQuery.length > 0 &&
                            (normalizeText(party.name).includes(
                              normalizedQuery
                            ) ||
                              party.surnames.some((s) =>
                                s.includes(normalizedQuery)
                              ));

                          return (
                            <li
                              key={party.id}
                              className={`flex items-start justify-between gap-3 text-sm rounded-lg px-2.5 py-1.5 ${
                                isPartyMatch ? 'bg-[#f7f5f0]' : ''
                              }`}
                            >
                              <div className="flex items-start gap-2 min-w-0">
                                <Users className="w-3.5 h-3.5 text-[#b89753] shrink-0 mt-1" />
                                <span
                                  className={`truncate ${
                                    isPartyMatch
                                      ? 'font-semibold text-[#2c3e35]'
                                      : 'text-[#2c3e35]/85'
                                  }`}
                                >
                                  {party.name}
                                </span>
                              </div>
                              <span className="text-xs text-[#2c3e35]/60 whitespace-nowrap shrink-0 tabular-nums mt-0.5">
                                {party.adults + party.kids} lug.
                                {party.babies > 0
                                  ? ` · ${party.babies} bb`
                                  : ''}
                              </span>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
          <SectionCornerFlorals variant="default" />
        </section>
      )}
    </>
  );
};
