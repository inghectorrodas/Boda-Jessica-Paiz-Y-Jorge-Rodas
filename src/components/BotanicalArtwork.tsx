import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const BotanicalDivider: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <div className={`flex items-center justify-center gap-4 ${className}`} aria-hidden="true">
    <span className="h-px w-16 bg-[#b89753]/35" />
    <svg
      width="28"
      height="16"
      viewBox="0 0 28 16"
      fill="none"
      className="text-[#b89753]"
    >
      <path
        d="M14 14C14 8 10 3.5 4 2C5 7.5 8.5 11.5 14 14Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M14 14C14 8 18 3.5 24 2C23 7.5 19.5 11.5 14 14Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="4.5" r="1.3" fill="currentColor" />
    </svg>
    <span className="h-px w-16 bg-[#b89753]/35" />
  </div>
);

/**
 * Botanical Watercolor Roses Bouquet
 * Renders the user-provided ivory & dusty-blue floral arrangement with sage foliage.
 */
export const WatercolorRosesBouquet: React.FC<{
  className?: string;
  isCoupleOrAdmin?: boolean;
}> = ({ className = '', isCoupleOrAdmin = false }) => (
  <img
    src="/assets/aistudio/FloresCelesteYBlanco17_53ceea19.png"
    alt=""
    aria-hidden="true"
    draggable={isCoupleOrAdmin}
    className={`w-full h-auto select-none ${
      isCoupleOrAdmin ? '' : 'pointer-events-none'
    } ${className}`}
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
);

interface CoupleEditorialPortraitProps {
  heroPhotoUrl?: string;
  isCoupleOrAdmin?: boolean;
  weddingDateFormatted?: string;
  weddingDayName?: string;
  className?: string;
}

export const CoupleEditorialPortrait: React.FC<CoupleEditorialPortraitProps> = ({
  heroPhotoUrl,
  isCoupleOrAdmin = false,
  weddingDateFormatted = '18 · Diciembre · 2026',
  weddingDayName = 'Viernes',
  className = '',
}) => {
  const couplePhotos = React.useMemo(() => {
    const list: string[] = [];
    if (heroPhotoUrl && heroPhotoUrl.trim().length > 0) {
      list.push(heroPhotoUrl.trim());
    }
    const defaults = [
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
    ];
    for (const url of defaults) {
      if (!list.includes(url)) {
        list.push(url);
      }
    }
    return list;
  }, [heroPhotoUrl]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    if (couplePhotos.length <= 1 || isHovered) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % couplePhotos.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [couplePhotos.length, isHovered, currentIndex]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + couplePhotos.length) % couplePhotos.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % couplePhotos.length);
  };

  const activeIndex = currentIndex % couplePhotos.length;
  const currentPhoto = couplePhotos[activeIndex];

  return (
    <div
      className={`relative w-full max-w-xl mx-auto flex flex-col items-center select-none ${className}`}
    >
      {/* PHOTO FRAME WITH INTERACTIVE 5-SECOND CAROUSEL CONTROLS */}
      <div
        className="relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border border-[#b89753]/35 bg-[#141d18]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={(e) => {
          touchStartXRef.current = e.touches?.[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchStartXRef.current === null || couplePhotos.length <= 1) return;
          const endX = e.changedTouches?.[0]?.clientX;
          if (typeof endX !== 'number') return;
          const deltaX = endX - touchStartXRef.current;
          touchStartXRef.current = null;
          if (Math.abs(deltaX) > 40) {
            setCurrentIndex((prev) =>
              deltaX < 0
                ? (prev + 1) % couplePhotos.length
                : (prev - 1 + couplePhotos.length) % couplePhotos.length
            );
          }
        }}
        onContextMenu={(e) => {
          if (!isCoupleOrAdmin) e.preventDefault();
        }}
      >
        {/* Ambient Blurred Underlay */}
        <div
          className="absolute inset-0 bg-cover bg-center blur-xl scale-110 opacity-30 pointer-events-none transition-all duration-700"
          style={{ backgroundImage: `url("${currentPhoto}")` }}
        />

        {/* Smooth Crossfade Stack of Protected Couple Images */}
        {couplePhotos.map((photoUrl, idx) => {
          const isCurrent = idx === activeIndex;
          return (
            <img
              key={`${photoUrl}-${idx}`}
              src={photoUrl}
              alt="Jessica Paiz y Jorge Rodas"
              draggable={isCoupleOrAdmin}
              aria-hidden={!isCurrent}
              className={`absolute inset-0 w-full h-full object-cover select-none transition-all duration-700 ease-in-out ${
                isCurrent ? 'opacity-100 scale-100 z-[1]' : 'opacity-0 scale-105 z-0 pointer-events-none'
              } ${isCoupleOrAdmin ? '' : 'pointer-events-none'}`}
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
          );
        })}

        {/* Transparent Protective Glass Shield (blocks mobile Chrome/Safari long-press image download sheet for guests) */}
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

        {/* Carousel Navigation Arrow - Left */}
        {couplePhotos.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Foto anterior"
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/65 backdrop-blur-xs text-white/95 flex items-center justify-center transition-all cursor-pointer shadow-md border border-white/20 active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Carousel Navigation Arrow - Right */}
        {couplePhotos.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Siguiente foto"
            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/65 backdrop-blur-xs text-white/95 flex items-center justify-center transition-all cursor-pointer shadow-md border border-white/20 active:scale-95"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Pagination Dots at Bottom of Photo */}
        {couplePhotos.length > 1 && (
          <div className="absolute bottom-14 sm:bottom-16 inset-x-0 z-30 flex items-center justify-center gap-2 pointer-events-auto">
            {couplePhotos.map((_, idx) => {
              const isActive = idx === (currentIndex % couplePhotos.length);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  aria-label={`Ver foto ${idx + 1}`}
                  className={`transition-all rounded-full cursor-pointer ${
                    isActive
                      ? 'w-6 h-1.5 bg-white shadow-sm'
                      : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* WATERCOLOR ROSES BOUQUET OVERLAPPING PHOTO BASE */}
      <div
        className="relative -mt-12 sm:-mt-16 z-20 w-full flex justify-center pointer-events-none px-2 sm:px-4 select-none"
        onContextMenu={(e) => {
          if (!isCoupleOrAdmin) e.preventDefault();
        }}
      >
        <div className="relative w-full max-w-[380px] sm:max-w-[460px]">
          <WatercolorRosesBouquet
            isCoupleOrAdmin={isCoupleOrAdmin}
            className="drop-shadow-md"
          />
          {!isCoupleOrAdmin && (
            <div
              className="absolute inset-0 z-10 bg-transparent select-none pointer-events-none"
              style={{
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
            />
          )}
        </div>
      </div>

      {/* DATE CALLOUT SECTION BELOW THE BOUQUET */}
      <div className="pt-2 sm:pt-3 text-center space-y-1 sm:space-y-1.5 select-none">
        <p className="font-serif text-sm sm:text-base text-[#2c3e35]/80 tracking-wide font-normal">
          Te esperamos el día:
        </p>

        <p className="font-['Great_Vibes'] text-3xl sm:text-5xl text-[#2c3e35] leading-none py-1 sm:py-1.5">
          {weddingDayName}
        </p>

        <p className="font-serif text-base sm:text-lg font-semibold tracking-[0.22em] text-[#b89753] uppercase">
          {weddingDateFormatted}
        </p>
      </div>
    </div>
  );
};

export const ChapelArchitecturalPlate: React.FC = () => (
  <div
    className="relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-xl bg-white border border-[#b89753]/25 flex items-center justify-center pt-2 pb-6 px-3 overflow-hidden select-none"
    aria-hidden="true"
    onContextMenu={(e) => e.preventDefault()}
  >
    <img
      src="/assets/aistudio/pareja-casada-altar_39751bdd.jpg"
      alt=""
      draggable={false}
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      className="w-full h-full max-h-[240px] sm:max-h-[260px] object-contain pointer-events-none select-none"
    />
  </div>
);

export const ConservatoryTablePlate: React.FC = () => (
  <div
    className="relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-xl bg-white border border-[#b89753]/25 flex items-center justify-center pt-2 pb-6 px-3 overflow-hidden select-none"
    aria-hidden="true"
    onContextMenu={(e) => e.preventDefault()}
  >
    <img
      src="/assets/aistudio/pareja-alegre-bailando_9b4e721f.jpg"
      alt=""
      draggable={false}
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      className="w-full h-full max-h-[240px] sm:max-h-[260px] object-contain rounded-lg pointer-events-none select-none"
    />
  </div>
);

interface SectionCornerFloralsProps {
  variant?: 'default' | 'hero' | 'alternating' | 'compact';
}

const protectedImgStyle: React.CSSProperties = {
  WebkitTouchCallout: 'none',
  WebkitUserSelect: 'none',
  userSelect: 'none',
};

export const SectionCornerFlorals: React.FC<SectionCornerFloralsProps> = ({
  variant = 'default',
}) => {
  if (variant === 'hero') {
    return (
      <div
        className="pointer-events-none select-none"
        aria-hidden="true"
      >
        {/* Top-left watercolor rose cluster */}
        <img
          src="/assets/aistudio/FloresCelesteYBlanco01_264f8a30.png"
          alt=""
          draggable={false}
          style={protectedImgStyle}
          className="absolute -top-2 -left-2 z-0 w-28 sm:w-44 md:w-56 lg:w-64 h-auto opacity-80 sm:opacity-90 pointer-events-none select-none"
        />
        {/* Top-right watercolor rose cluster */}
        <img
          src="/assets/aistudio/FloresCelesteYBlanco02_e05b3a1e.png"
          alt=""
          draggable={false}
          style={protectedImgStyle}
          className="absolute -top-2 -right-2 z-0 w-28 sm:w-44 md:w-56 lg:w-64 h-auto opacity-80 sm:opacity-90 pointer-events-none select-none"
        />
        {/* Bottom-left delicate golden botanical sprig above countdown */}
        <img
          src="/assets/aistudio/FloresNaranjas_5022b34a.png"
          alt=""
          draggable={false}
          style={protectedImgStyle}
          className="hidden sm:block absolute bottom-20 left-2 z-0 w-28 md:w-36 lg:w-44 h-auto opacity-55 lg:opacity-70 -scale-x-100 pointer-events-none select-none"
        />
        {/* Bottom-right delicate golden botanical sprig above countdown */}
        <img
          src="/assets/aistudio/FloresNaranjas_5022b34a.png"
          alt=""
          draggable={false}
          style={protectedImgStyle}
          className="hidden sm:block absolute bottom-20 right-2 z-0 w-28 md:w-36 lg:w-44 h-auto opacity-55 lg:opacity-70 pointer-events-none select-none"
        />
      </div>
    );
  }

  if (variant === 'alternating') {
    return (
      <div
        className="pointer-events-none select-none"
        aria-hidden="true"
      >
        {/* Top-left delicate golden floral accent (mirrored) */}
        <img
          src="/assets/aistudio/FloresNaranjas_5022b34a.png"
          alt=""
          draggable={false}
          style={protectedImgStyle}
          className="absolute top-1 left-1 sm:top-2 sm:left-3 z-0 w-20 sm:w-32 md:w-40 h-auto opacity-50 sm:opacity-70 -scale-x-100 -scale-y-100 pointer-events-none select-none"
        />
        {/* Top-right delicate golden floral accent */}
        <img
          src="/assets/aistudio/FloresNaranjas_5022b34a.png"
          alt=""
          draggable={false}
          style={protectedImgStyle}
          className="absolute top-1 right-1 sm:top-2 sm:right-3 z-0 w-20 sm:w-32 md:w-40 h-auto opacity-50 sm:opacity-70 -scale-y-100 pointer-events-none select-none"
        />
        {/* Bottom-left watercolor rose cluster */}
        <img
          src="/assets/aistudio/FloresCelesteYBlanco01_264f8a30.png"
          alt=""
          draggable={false}
          style={protectedImgStyle}
          className="absolute -bottom-2 -left-2 z-0 w-24 sm:w-40 md:w-52 h-auto opacity-75 sm:opacity-90 -scale-y-100 pointer-events-none select-none"
        />
        {/* Bottom-right watercolor rose cluster */}
        <img
          src="/assets/aistudio/FloresCelesteYBlanco02_e05b3a1e.png"
          alt=""
          draggable={false}
          style={protectedImgStyle}
          className="absolute -bottom-2 -right-2 z-0 w-24 sm:w-40 md:w-52 h-auto opacity-75 sm:opacity-90 -scale-y-100 pointer-events-none select-none"
        />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className="pointer-events-none select-none"
        aria-hidden="true"
      >
        {/* Top-left delicate golden floral accent */}
        <img
          src="/assets/aistudio/FloresNaranjas_5022b34a.png"
          alt=""
          draggable={false}
          style={protectedImgStyle}
          className="absolute top-1 left-1 sm:top-2 sm:left-4 z-0 w-16 sm:w-28 md:w-36 h-auto opacity-45 sm:opacity-65 -scale-x-100 -scale-y-100 pointer-events-none select-none"
        />
        {/* Top-right delicate golden floral accent */}
        <img
          src="/assets/aistudio/FloresNaranjas_5022b34a.png"
          alt=""
          draggable={false}
          style={protectedImgStyle}
          className="absolute top-1 right-1 sm:top-2 sm:right-4 z-0 w-16 sm:w-28 md:w-36 h-auto opacity-45 sm:opacity-65 -scale-y-100 pointer-events-none select-none"
        />
        {/* Bottom-left watercolor rose cluster */}
        <img
          src="/assets/aistudio/FloresCelesteYBlanco01_264f8a30.png"
          alt=""
          draggable={false}
          style={protectedImgStyle}
          className="absolute -bottom-2 -left-2 z-0 w-24 sm:w-36 md:w-44 h-auto opacity-75 sm:opacity-90 -scale-y-100 pointer-events-none select-none"
        />
        {/* Bottom-right watercolor rose cluster */}
        <img
          src="/assets/aistudio/FloresCelesteYBlanco02_e05b3a1e.png"
          alt=""
          draggable={false}
          style={protectedImgStyle}
          className="absolute -bottom-2 -right-2 z-0 w-24 sm:w-36 md:w-44 h-auto opacity-75 sm:opacity-90 -scale-y-100 pointer-events-none select-none"
        />
      </div>
    );
  }

  // 'default': Top corners watercolor roses + bottom corners golden line-art
  return (
    <div
      className="pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Top-left watercolor rose cluster */}
      <img
        src="/assets/aistudio/FloresCelesteYBlanco01_264f8a30.png"
        alt=""
        draggable={false}
        style={protectedImgStyle}
        className="absolute -top-2 -left-2 z-0 w-24 sm:w-40 md:w-52 h-auto opacity-75 sm:opacity-90 pointer-events-none select-none"
      />
      {/* Top-right watercolor rose cluster */}
      <img
        src="/assets/aistudio/FloresCelesteYBlanco02_e05b3a1e.png"
        alt=""
        draggable={false}
        style={protectedImgStyle}
        className="absolute -top-2 -right-2 z-0 w-24 sm:w-40 md:w-52 h-auto opacity-75 sm:opacity-90 pointer-events-none select-none"
      />
      {/* Bottom-left delicate golden floral accent (mirrored) */}
      <img
        src="/assets/aistudio/FloresNaranjas_5022b34a.png"
        alt=""
        draggable={false}
        style={protectedImgStyle}
        className="absolute bottom-1 left-1 sm:bottom-2 sm:left-3 z-0 w-20 sm:w-32 md:w-40 h-auto opacity-50 sm:opacity-70 -scale-x-100 pointer-events-none select-none"
      />
      {/* Bottom-right delicate golden floral accent */}
      <img
        src="/assets/aistudio/FloresNaranjas_5022b34a.png"
        alt=""
        draggable={false}
        style={protectedImgStyle}
        className="absolute bottom-1 right-1 sm:bottom-2 sm:right-3 z-0 w-20 sm:w-32 md:w-40 h-auto opacity-50 sm:opacity-70 pointer-events-none select-none"
      />
    </div>
  );
};

