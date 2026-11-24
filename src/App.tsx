import React, { useEffect, useState } from 'react';
import {
  CalendarPlus,
  Gift,
  MapPin,
  Menu,
  X,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDoc, limit, onSnapshot, query, where } from 'firebase/firestore';
import { AmbientMusicPlayer } from './components/AmbientMusicPlayer';
import {
  BotanicalDivider,
  ChapelArchitecturalPlate,
  ConservatoryTablePlate,
  CoupleEditorialPortrait,
  SectionCornerFlorals,
} from './components/BotanicalArtwork';
import { CountdownTimer } from './components/CountdownTimer';
import { CoupleAdminSection } from './components/CoupleAdminSection';
import { GiftRegistryModal } from './components/GiftRegistryModal';
import { PhotoAlbumSection } from './components/PhotoAlbumSection';
import { RsvpAndTablesSection } from './components/RsvpAndTablesSection';
import { WeddingEnvelopeIntro } from './components/WeddingEnvelopeIntro';
import {
  buildCombinedGoogleCalendarUrl,
  buildCountdownTargetISO,
  buildWeddingEventsFromConfig,
  COUPLE_INFO,
  DEFAULT_GODPARENTS_LIST,
  DEFAULT_WEDDING_CONFIG,
  downloadCombinedWeddingICS,
  formatWeddingDateDots,
  formatWeddingDateUpper,
  formatWeddingDayName,
  getStoredWeddingConfig,
  HeroPhotoRecord,
  isAuthorizedCoupleEmail,
  isWeddingDayReached,
  mergeWeddingConfig,
  WeddingConfigRecord,
} from './data/weddingData';
import { buildGoogleCalendarUrlForEvent } from './utils/calendarHelper';
import { auth, db } from './firebase';

export default function App() {
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [weddingConfig, setWeddingConfig] = useState<WeddingConfigRecord>(() =>
    getStoredWeddingConfig()
  );
  const [heroPhotos, setHeroPhotos] = useState<HeroPhotoRecord[]>([]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasOpenedEnvelope, setHasOpenedEnvelope] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash === '#compartir-foto';
    }
    return false;
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30000);

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });

    // Single-fetch static wedding config with fallback to localStorage
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'wedding_settings', 'main'));
        if (snap.exists()) {
          setWeddingConfig(mergeWeddingConfig(snap.data()));
        }
      } catch (err) {
        setWeddingConfig(getStoredWeddingConfig());
      }
    };
    void fetchConfig();

    const handleConfigUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setWeddingConfig(mergeWeddingConfig(detail));
      }
    };
    window.addEventListener('wedding:config-updated', handleConfigUpdate as EventListener);

    const unsubHeroPhotos = onSnapshot(
      query(
        collection(db, 'wedding_hero_photos'),
        where('active', '==', true),
        limit(30)
      ),
      (snap) => {
        const list: HeroPhotoRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              imageData: String(data.imageData ?? ''),
              caption: String(data.caption ?? ''),
              sortOrder: Number(data.sortOrder ?? 0),
              active: Boolean(data.active ?? true),
              createdAt: data.createdAt ?? null,
            };
          })
          .filter((item) => item.imageData.length > 0)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setHeroPhotos(list);
      },
      () => {}
    );

    return () => {
      window.clearInterval(timer);
      unsubAuth();
      window.removeEventListener('wedding:config-updated', handleConfigUpdate as EventListener);
      unsubHeroPhotos();
    };
  }, []);

  const isWeddingDayActive = React.useMemo(() => {
    void nowTick;
    return isWeddingDayReached(weddingConfig.weddingDateISO);
  }, [nowTick, weddingConfig.weddingDateISO]);

  const albumEnabledEarly = Boolean(weddingConfig.albumEnabledEarly);
  const tablesVisibleToGuests = Boolean(weddingConfig.tablesVisibleToGuests);
  const activeHeroPhotoUrls = React.useMemo(
    () => heroPhotos.map((item) => item.imageData),
    [heroPhotos]
  );
  const heroPhotoUrl =
    activeHeroPhotoUrls[0] ??
    weddingConfig.heroPhotoUrl ??
    DEFAULT_WEDDING_CONFIG.heroPhotoUrl ??
    '';
  const envelopeConfig = React.useMemo(
    () => ({ ...weddingConfig, heroPhotoUrl }),
    [weddingConfig, heroPhotoUrl]
  );
  const liveEvents = React.useMemo(
    () => buildWeddingEventsFromConfig(weddingConfig),
    [weddingConfig]
  );
  const weddingDateUpper = formatWeddingDateUpper(weddingConfig.weddingDateISO);
  const weddingDateDots = formatWeddingDateDots(weddingConfig.weddingDateISO);
  const weddingDayName = formatWeddingDayName(weddingConfig.weddingDateISO);
  const countdownTargetISO = buildCountdownTargetISO(weddingConfig);
  const godparentsList =
    weddingConfig.godparentsList ?? DEFAULT_GODPARENTS_LIST;

  const isCoupleOrAdmin = Boolean(
    currentUser && isAuthorizedCoupleEmail(currentUser.email)
  );

  const isAlbumVisible = isWeddingDayActive || albumEnabledEarly;
  const isTablesNavVisible = isCoupleOrAdmin || tablesVisibleToGuests;

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-[#2c3e35] flex flex-col overflow-x-clip">
      {/* TOP BAR CONTRACT: 3 ZONES — BRAND, 4 NAV LINKS, 1 PRIMARY ACTION */}
      <header className="sticky top-0 z-30 bg-[#fcfbf9]/95 backdrop-blur-md border-b border-[#b89753]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 lg:gap-8">
          <a
            href="#inicio"
            className="font-['Great_Vibes'] text-2xl sm:text-3xl font-normal tracking-wide text-[#b89753] whitespace-nowrap shrink-0"
          >
            Jessica{' '}
            <span className="font-serif italic text-[#7e919e] text-xl sm:text-2xl">
              &amp;
            </span>{' '}
            Jorge
          </a>

          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-4 lg:gap-7 text-xs uppercase tracking-[0.14em] lg:tracking-[0.16em] font-medium text-[#2c3e35]/75"
          >
            <a
              href="#eventos"
              className="hover:text-[#b89753] transition-colors whitespace-nowrap shrink-0"
            >
              Eventos
            </a>
            {isTablesNavVisible && (
              <a
                href="#mesas"
                className="hover:text-[#b89753] transition-colors whitespace-nowrap shrink-0"
              >
                Mesas
              </a>
            )}
            <a
              href="#album"
              className="hover:text-[#b89753] transition-colors whitespace-nowrap shrink-0"
            >
              Álbum
            </a>
            <a
              href="#novios"
              className="hover:text-[#b89753] transition-colors whitespace-nowrap shrink-0"
            >
              Novios
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="#rsvp"
              className="inline-flex items-center justify-center px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full bg-[#b89753] hover:bg-[#967739] text-white text-[11px] sm:text-xs font-semibold tracking-wide transition-colors whitespace-nowrap shrink-0"
            >
              Confirmar
              <span className="hidden sm:inline">&nbsp;Asistencia</span>
            </a>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              className="md:hidden w-9 h-9 rounded-full border border-[#b89753]/35 flex items-center justify-center text-[#2c3e35] hover:bg-[#f7f5f0] transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Menú móvil"
            className="md:hidden border-t border-[#b89753]/15 bg-[#fcfbf9] px-4 py-3 grid grid-cols-2 gap-2 text-xs uppercase tracking-[0.14em] font-medium text-[#2c3e35]"
          >
            <a
              href="#eventos"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl bg-white border border-[#b89753]/20 text-center"
            >
              Eventos
            </a>
            {isTablesNavVisible && (
              <a
                href="#mesas"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl bg-white border border-[#b89753]/20 text-center"
              >
                Mesas
              </a>
            )}
            <a
              href="#album"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl bg-white border border-[#b89753]/20 text-center"
            >
              Álbum
            </a>
            <a
              href="#novios"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl bg-white border border-[#b89753]/20 text-center"
            >
              Novios
            </a>
          </nav>
        )}
      </header>

      <main className="flex-1">
        {/* HERO SPLIT SECTION */}
        <section id="inicio" className="relative overflow-hidden bg-white">
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-14 items-stretch">
            {/* Left Typographic Hierarchy */}
            <div className="lg:col-span-6 flex flex-col justify-center text-center lg:text-left">
              <p className="text-xs sm:text-sm text-center uppercase tracking-[0.26em] text-[#2c3e35]/70 font-semibold mb-2 sm:mb-3">
                Boda
              </p>

              <h1 className="font-['Great_Vibes'] text-5xl sm:text-6xl lg:text-7xl font-normal text-[#b89753] leading-[1.12] text-center">
                <span className="block text-center">Jessica Paiz</span>
                <span className="block font-serif italic text-3xl sm:text-5xl text-[#7e919e] my-0.5 sm:my-1 text-center font-normal">
                  &amp;
                </span>
                <span className="block text-center">Jorge Rodas</span>
              </h1>

              <p className="mt-4 sm:mt-5 text-xs sm:text-sm text-center uppercase tracking-[0.28em] text-[#b89753] font-semibold">
                {weddingDateUpper}
              </p>

              <p className="mt-6 sm:mt-7 font-serif italic text-[25px] text-center text-[#2c3e35]/80 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                &ldquo;{COUPLE_INFO.quote}&rdquo;
              </p>

              <div className="mt-7 sm:mt-9 flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4">
                <a
                  href="#rsvp"
                  className="px-6 sm:px-7 py-3 sm:py-3.5 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] text-[#fcfbf9] text-sm font-medium tracking-wide transition-colors whitespace-nowrap"
                >
                  Confirmar Asistencia
                </a>
                {isAlbumVisible && (
                  <a
                    href="#album"
                    className="px-6 sm:px-7 py-3 sm:py-3.5 rounded-full border border-[#b89753] text-[#2c3e35] hover:bg-[#f7f5f0] text-sm font-medium tracking-wide transition-colors whitespace-nowrap"
                  >
                    Álbum y Foto Party
                  </a>
                )}
              </div>
            </div>

            {/* Right Framed Editorial Portrait */}
            <div className="lg:col-span-6 flex">
              <CoupleEditorialPortrait
                heroPhotoUrl={heroPhotoUrl}
                customHeroPhotos={activeHeroPhotoUrls}
                hideDefaultHeroPhotos={Boolean(weddingConfig.hideDefaultHeroPhotos)}
                isCoupleOrAdmin={isCoupleOrAdmin}
                weddingDateFormatted={weddingDateDots}
                weddingDayName={weddingDayName}
              />
            </div>
          </div>

          {/* Full-Width Countdown Row Below Hero Split */}
          <div className="relative z-10">
            <CountdownTimer targetDateISO={countdownTargetISO} />
          </div>
          <SectionCornerFlorals variant="hero" />
        </section>

        {/* PARENTS & GODPARENTS */}
        <section id="padres" className="relative overflow-hidden py-16 sm:py-20 px-4 sm:px-6 text-center">
          <div className="max-w-4xl mx-auto relative z-10">
          <p className="text-xs uppercase tracking-[0.22em] text-[#b89753] font-semibold">
            Con la bendición de Dios y nuestros padres
          </p>
          <h2 className="mt-2 font-serif text-3xl sm:text-5xl font-semibold text-[#2c3e35]">
            Nuestros Padres y Padrinos
          </h2>

          <BotanicalDivider className="my-8" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 text-center">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[#2c3e35]/70 font-bold">
                Padres de la Novia
              </p>
              <p className="font-serif text-xl sm:text-2xl font-medium text-[#2c3e35]">
                {weddingConfig.brideParents || COUPLE_INFO.parents.bride}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[#2c3e35]/70 font-bold">
                Padres del Novio
              </p>
              <p className="font-serif text-xl sm:text-2xl font-medium text-[#2c3e35]">
                {weddingConfig.groomParents || COUPLE_INFO.parents.groom}
              </p>
            </div>
          </div>

          {godparentsList.length > 0 && (
            <div className="mt-12 sm:mt-16 pt-10 border-t border-[#b89753]/20 max-w-2xl mx-auto space-y-6">
              <h3 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2c3e35] text-center">
                Corte de Padrinos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
                {godparentsList.map((g, idx) => (
                  <div
                    key={idx}
                    className="bg-[#f7f5f0] border border-[#b89753]/25 rounded-2xl p-4 shadow-2xs"
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#b89753] font-semibold">
                      {g.roleName}
                    </p>
                    <p className="mt-1 font-serif text-lg font-medium text-[#2c3e35]">
                      {g.names}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
          <SectionCornerFlorals variant="default" />
        </section>

        {/* CEREMONY & RECEPTION */}
        <section
          id="eventos"
          className="relative overflow-hidden py-16 sm:py-20 px-4 sm:px-6 bg-[#f7f5f0]/70 border-y border-[#b89753]/20"
        >
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="text-center mb-10 sm:mb-12">
              <p className="text-xs uppercase tracking-[0.22em] text-[#b89753] font-semibold">
                Itinerario del Enlace
              </p>
              <h2 className="mt-2 font-serif text-3xl sm:text-5xl font-semibold text-[#2c3e35]">
                Ceremonia y Recepción
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-stretch">
              {liveEvents.map((event) => {
                const isCeremony = event.id === 'ceremony';
                return (
                  <article
                    key={event.id}
                    className="bg-white border border-[#b89753]/30 rounded-2xl p-5 sm:p-8 shadow-sm flex flex-col justify-between text-center"
                  >
                    <div>
                      {isCeremony ? (
                        <ChapelArchitecturalPlate />
                      ) : (
                        <ConservatoryTablePlate />
                      )}

                      <div
                        className="w-12 h-12 rounded-full bg-[#f7f5f0] border border-[#b89753]/30 text-[#b89753] flex items-center justify-center mx-auto -mt-6 relative z-10 shadow-xs select-none"
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {isCeremony ? (
                          <img
                            src="/assets/aistudio/iglesia-grande-480x480_be9185b3.png"
                            alt=""
                            aria-hidden="true"
                            draggable={false}
                            style={{
                              WebkitTouchCallout: 'none',
                              WebkitUserSelect: 'none',
                              userSelect: 'none',
                            }}
                            className="w-6 h-6 object-contain pointer-events-none select-none"
                          />
                        ) : (
                          <img
                            src="/assets/aistudio/salud-5-480x480_80d87bfc.png"
                            alt=""
                            aria-hidden="true"
                            draggable={false}
                            style={{
                              WebkitTouchCallout: 'none',
                              WebkitUserSelect: 'none',
                              userSelect: 'none',
                            }}
                            className="w-6 h-6 object-contain pointer-events-none select-none"
                          />
                        )}
                      </div>

                      <h3 className="mt-4 font-serif text-3xl font-semibold text-[#2c3e35]">
                        {event.title}
                      </h3>

                      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-sm font-medium text-[#b89753]">
                        <span>{event.dateLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{event.timeLabel}</span>
                      </div>

                      <p className="mt-4 font-medium text-[#2c3e35]">
                        {event.venue}
                      </p>
                      <p className="mt-1 text-sm text-[#2c3e35]/70">
                        {event.address}
                      </p>
                    </div>

                    <div className="mt-7 sm:mt-8 pt-6 border-t border-[#b89753]/15 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                      <a
                        href={event.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#f7f5f0] border border-[#b89753]/60 text-[#2c3e35] text-xs font-semibold hover:bg-[#b89753] hover:text-white transition-colors whitespace-nowrap"
                      >
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>Ver Ubicación</span>
                      </a>

                      <a
                        href={buildGoogleCalendarUrlForEvent(event)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#b89753] hover:bg-[#967739] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                        <span>Agendar en Calendario</span>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col items-center gap-2.5 text-center">
              <a
                href={buildCombinedGoogleCalendarUrl('Invitado', null, weddingConfig)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#2c3e35] hover:bg-[#1f2c26] text-white text-xs font-semibold transition-colors text-center"
              >
                <CalendarPlus className="w-4 h-4 text-[#b89753] shrink-0" />
                <span>Agendar Ceremonia y Recepción en Calendario</span>
              </a>

              <button
                type="button"
                onClick={() =>
                  downloadCombinedWeddingICS('Invitado', null, weddingConfig)
                }
                className="text-[11px] text-[#2c3e35]/65 underline underline-offset-4 hover:text-[#b89753] cursor-pointer"
              >
                ¿Usas Apple Calendar u Outlook? Descargar archivo (.ics)
              </button>
            </div>
          </div>
          <SectionCornerFlorals variant="alternating" />
        </section>

        {/* DRESS CODE & GIFT REGISTRY */}
        <section id="detalles" className="relative overflow-hidden py-16 sm:py-20 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center items-stretch">
            {/* Dress Code (Reference Illustration) */}
            <div
              className="bg-white border border-[#b89753]/30 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col items-center justify-center relative overflow-hidden select-none"
              onContextMenu={(e) => {
                if (!isCoupleOrAdmin) e.preventDefault();
              }}
            >
              <div className="relative w-full max-w-md mx-auto flex items-center justify-center">
                <img
                  src="/assets/aistudio/file_000000001a6481f5a9dcc15b171af746_89e6d8b2.png"
                  alt="Código de Vestimenta: Business Casual y Casual Elegante. Dejemos los colores claros para la novia."
                  draggable={isCoupleOrAdmin}
                  className={`w-full h-auto max-h-[540px] object-contain rounded-xl select-none ${
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
                {/* Protective transparent shield against mobile image download menu */}
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
            </div>

            {/* Gift Registry / Lluvia de sobres */}
            <div className="bg-white border border-[#b89753]/30 rounded-2xl p-8 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-full bg-[#f7f5f0] border border-[#b89753]/30 text-[#b89753] flex items-center justify-center mx-auto mb-5">
                  <Gift className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-3xl font-semibold text-[#2c3e35]">
                  Mesa de Regalos
                </h3>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#b89753] font-semibold">
                  Lluvia de Sobres
                </p>
                <p className="mt-5 text-sm text-[#2c3e35]/80 leading-relaxed max-w-sm mx-auto">
                  Su presencia es nuestro mayor regalo. Si desean acompañarnos
                  con un obsequio adicional, contaremos con lluvia de sobres en
                  recepción y opción de transferencia bancaria.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#b89753]/15">
                <button
                  type="button"
                  onClick={() => setIsGiftModalOpen(true)}
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#b89753] hover:bg-[#967739] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer whitespace-nowrap"
                >
                  Ver Detalles y Cuenta
                </button>
              </div>
            </div>
          </div>
          </div>
          <SectionCornerFlorals variant="default" />
        </section>

        {/* RSVP & SMART TABLE ORGANIZER */}
        <RsvpAndTablesSection />

        {/* WEDDING PHOTO ALBUM & LIVE FOTO PARTY */}
        <PhotoAlbumSection isWeddingDayActive={isWeddingDayActive} />

        {/* FIXED COUPLE ADMIN PORTAL */}
        <CoupleAdminSection />
      </main>

      {/* FOOTER */}
      <footer className="relative overflow-hidden py-14 px-6 text-center bg-white border-t border-[#b89753]/25">
        <div className="relative z-10">
          <BotanicalDivider className="mb-6" />
          <p className="font-['Great_Vibes'] text-4xl sm:text-5xl font-normal text-[#b89753]">
            Jessica Paiz{' '}
            <span className="font-serif italic text-3xl sm:text-4xl text-[#7e919e]">
              &amp;
            </span>{' '}
            Jorge Rodas
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.25em] text-[#b89753] font-semibold">
            {weddingDateDots}
          </p>
          <p className="mt-3 text-xs text-[#2c3e35]/55">
            San Salvador, El Salvador
          </p>
        </div>
        <SectionCornerFlorals variant="compact" />
      </footer>

      {/* FLOATING AMBIENT MUSIC PLAYER */}
      <AmbientMusicPlayer config={weddingConfig} />

      {/* GIFT REGISTRY MODAL */}
      <GiftRegistryModal
        isOpen={isGiftModalOpen}
        onClose={() => setIsGiftModalOpen(false)}
        config={weddingConfig}
      />

      {/* INTERACTIVE ENVELOPE PRELOAD SCREEN */}
      {!hasOpenedEnvelope && (
        <WeddingEnvelopeIntro
          config={envelopeConfig}
          onOpen={() => setHasOpenedEnvelope(true)}
        />
      )}
    </div>
  );
}
