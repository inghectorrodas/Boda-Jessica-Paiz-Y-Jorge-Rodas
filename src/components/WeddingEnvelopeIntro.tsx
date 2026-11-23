import React, { useEffect, useState } from 'react';
import {
  DEFAULT_WEDDING_CONFIG,
  formatTime12h,
  formatWeddingEventDateLabel,
  WeddingConfigRecord,
} from '../data/weddingData';

interface WeddingEnvelopeIntroProps {
  config: WeddingConfigRecord;
  onOpen: () => void;
}

export const WeddingEnvelopeIntro: React.FC<WeddingEnvelopeIntroProps> = ({
  config,
  onOpen,
}) => {
  const [isOpening, setIsOpening] = useState(false);

  const heroPhotoUrl =
    config.heroPhotoUrl?.trim() ||
    DEFAULT_WEDDING_CONFIG.heroPhotoUrl ||
    '';
  const dateLabel = formatWeddingEventDateLabel(config.weddingDateISO);
  const ceremonyTimeLabel = formatTime12h(config.ceremonyTime, '16:00');

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleOpenEnvelope = () => {
    if (isOpening) return;
    setIsOpening(true);
    window.dispatchEvent(new CustomEvent('wedding:start-ambient-music'));

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.setTimeout(
      () => {
        onOpen();
      },
      prefersReducedMotion ? 120 : 620
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sobre de invitación de boda de Jessica Paiz y Jorge Rodas"
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1d2722] transition-opacity duration-500 ${
        isOpening ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Blurred Ambient Backdrop */}
      {heroPhotoUrl && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center scale-110 blur-xl opacity-55 pointer-events-none"
          style={{ backgroundImage: `url("${heroPhotoUrl}")` }}
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-[#1a241f]/50 via-[#2c3e35]/40 to-[#141d18]/65 pointer-events-none"
      />

      {/* Invitation Preload Card */}
      <div
        onClick={handleOpenEnvelope}
        className={`relative z-10 w-full max-w-[430px] max-h-[94dvh] overflow-y-auto rounded-2xl bg-[#fcfbf9] border border-[#b89753]/30 shadow-2xl text-center transition-all duration-500 cursor-pointer ${
          isOpening ? 'scale-105 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <div className="px-6 sm:px-9 pt-8 sm:pt-10 pb-2 space-y-5">
          {/* Couple Names Lockup */}
          <div className="select-none">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#b89753] font-semibold mb-1.5">
              Nuestra Boda
            </p>
            <h1 className="font-['Great_Vibes'] text-4xl sm:text-5xl text-[#b89753] leading-tight flex items-center justify-center flex-wrap gap-x-2">
              <span>Jessica</span>
              <span className="font-serif italic text-[#7e919e] text-4xl sm:text-5xl font-normal leading-none">
                &amp;
              </span>
              <span>Jorge</span>
            </h1>
          </div>

          {/* Cordial Invitation Copy + Live Date & Time */}
          <div className="space-y-2 max-w-xs mx-auto">
            <p className="font-serif italic text-base sm:text-lg text-[#2c3e35]/85 leading-relaxed">
              Con inmensa alegría en nuestros corazones, te invitamos
              cordialmente a celebrar nuestro enlace matrimonial
            </p>
            <p className="font-serif text-base sm:text-lg font-semibold text-[#b89753]">
              {dateLabel} <span aria-hidden="true">·</span>{' '}
              <span className="tabular-nums">{ceremonyTimeLabel}</span>
            </p>
          </div>

          {/* Click Instruction */}
          <p className="font-serif text-lg sm:text-xl text-[#2c3e35] pt-1">
            Haz clic en el sobre para abrir la invitación:
          </p>

          {/* Interactive Wax-Sealed Envelope Button */}
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={handleOpenEnvelope}
              aria-label="Haz clic en el sobre para abrir la invitación"
              className="group relative w-64 sm:w-72 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b89753] cursor-pointer transition-transform duration-300 hover:-translate-y-1 active:scale-95"
            >
              <div className="relative w-full aspect-[16/10.5] rounded-lg shadow-[0_14px_30px_-10px_rgba(44,62,53,0.32)] group-hover:shadow-[0_20px_38px_-10px_rgba(184,151,83,0.42)] transition-shadow duration-300 overflow-hidden bg-[#f4efe3] border border-[#d8cbb0]">
                {/* Inner Invitation Card Peeking When Opening */}
                <div
                  className={`absolute inset-x-3 top-2 bottom-2 rounded-md bg-white border border-[#b89753]/25 flex flex-col items-center justify-center transition-transform duration-500 ${
                    isOpening ? '-translate-y-5' : 'translate-y-0'
                  }`}
                >
                  <span className="font-['Great_Vibes'] text-2xl text-[#b89753]">
                    J{' '}
                    <span className="font-serif italic text-[#7e919e] text-xl">
                      &amp;
                    </span>{' '}
                    J
                  </span>
                </div>

                {/* Envelope Base SVG */}
                <svg
                  viewBox="0 0 320 210"
                  className="relative z-10 w-full h-full block"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="envBody" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#fbf8f0" />
                      <stop offset="100%" stopColor="#efe7d4" />
                    </linearGradient>
                    <linearGradient id="envLeft" x1="0" y1="0" x2="1" y2="0.5">
                      <stop offset="0%" stopColor="#f7f2e5" />
                      <stop offset="100%" stopColor="#eae0c9" />
                    </linearGradient>
                    <linearGradient id="envRight" x1="1" y1="0" x2="0" y2="0.5">
                      <stop offset="0%" stopColor="#f5efe0" />
                      <stop offset="100%" stopColor="#e8ddc5" />
                    </linearGradient>
                    <linearGradient id="envBottom" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="#f9f5eb" />
                      <stop offset="100%" stopColor="#efe6d1" />
                    </linearGradient>
                    <linearGradient id="envFlap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fdfbf6" />
                      <stop offset="100%" stopColor="#f1e8d5" />
                    </linearGradient>
                    <radialGradient id="waxSeal" cx="40%" cy="35%" r="65%">
                      <stop offset="0%" stopColor="#d4b36a" />
                      <stop offset="65%" stopColor="#b48f48" />
                      <stop offset="100%" stopColor="#8c6b2d" />
                    </radialGradient>
                    <clipPath id="waxSealRingsClip">
                      <circle cx="160" cy="112" r="18.5" />
                    </clipPath>
                  </defs>

                  <rect width="320" height="210" fill="url(#envBody)" />
                  {/* Left & Right Folds */}
                  <polygon points="0,0 160,115 0,210" fill="url(#envLeft)" />
                  <polygon points="320,0 160,115 320,210" fill="url(#envRight)" />
                  {/* Bottom Fold */}
                  <polygon
                    points="0,210 160,96 320,210"
                    fill="url(#envBottom)"
                    stroke="#dccfae"
                    strokeWidth="1"
                  />
                  {/* Top Flap Shadow */}
                  <polygon
                    points="2,4 160,126 318,4"
                    fill="rgba(44,62,53,0.10)"
                    className={`transition-opacity duration-300 ${
                      isOpening ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                  {/* Top Flap */}
                  <g
                    style={{
                      transformOrigin: '160px 0px',
                      transform: isOpening ? 'scaleY(-0.35)' : 'scaleY(1)',
                      transition: 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <polygon
                      points="0,0 160,121 320,0"
                      fill="url(#envFlap)"
                      stroke="#ded2b5"
                      strokeWidth="1.2"
                    />
                  </g>

                  {/* Golden Wax Seal */}
                  <g
                    style={{
                      transformOrigin: '160px 112px',
                      transform: isOpening ? 'scale(0.85)' : 'scale(1)',
                      opacity: isOpening ? 0 : 1,
                      transition: 'transform 300ms ease, opacity 300ms ease',
                    }}
                  >
                    <circle
                      cx="160"
                      cy="115"
                      r="25"
                      fill="rgba(44,62,53,0.18)"
                    />
                    <circle
                      cx="160"
                      cy="112"
                      r="24"
                      fill="url(#waxSeal)"
                      stroke="#8a6829"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="160"
                      cy="112"
                      r="18.5"
                      fill="none"
                      stroke="#f6e7c1"
                      strokeOpacity="0.45"
                      strokeWidth="1"
                    />
                    {/* Anillos de Boda Dorados en el Sello */}
                    <g clipPath="url(#waxSealRingsClip)">
                      <image
                        href="/assets/aistudio/ANILLOS_05201339.png"
                        x="141"
                        y="94"
                        width="38"
                        height="38"
                        preserveAspectRatio="xMidYMid meet"
                        style={{
                          filter: 'drop-shadow(0px 1px 2px rgba(45,28,8,0.45))',
                        }}
                      />
                    </g>
                  </g>
                </svg>
              </div>
              <span className="mt-2.5 inline-block text-[11px] uppercase tracking-[0.2em] font-semibold text-[#b89753] group-hover:text-[#967739] transition-colors">
                Tocar para abrir
              </span>
            </button>
          </div>

          {/* Important Notice */}
          <div className="pt-1 space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-[#2c3e35]/80 font-semibold">
              Importante
            </p>
            <p className="font-serif text-base sm:text-lg text-[#2c3e35]/80 leading-snug max-w-[260px] mx-auto">
              Desactiva el modo oscuro y sube el volumen
            </p>
          </div>
        </div>

        {/* Bottom Watercolor Roses Arrangement */}
        <div className="pt-2 flex justify-center pointer-events-none select-none overflow-hidden">
          <img
            src="/assets/aistudio/FloresCelesteYBlanco17_53ceea19.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="w-72 sm:w-80 h-auto object-contain -mb-1"
          />
        </div>
      </div>
    </div>
  );
};
