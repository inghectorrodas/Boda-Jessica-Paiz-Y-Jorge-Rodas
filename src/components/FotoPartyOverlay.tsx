import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Sparkles,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { WeddingPhotoRecord } from '../data/weddingData';

interface FotoPartyOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  photos: WeddingPhotoRecord[];
  intervalSec: number;
}

export const FotoPartyOverlay: React.FC<FotoPartyOverlayProps> = ({
  isOpen,
  onClose,
  photos,
  intervalSec,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const prevCountRef = useRef(photos.length);

  // Jump immediately to the newest photo when a guest uploads one during the party
  useEffect(() => {
    if (isOpen && photos.length > prevCountRef.current) {
      setCurrentIndex(0);
    }
    prevCountRef.current = photos.length;
  }, [photos.length, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && photos.length > 0) {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
      }
      if (e.key === 'ArrowLeft' && photos.length > 0) {
        setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
      }
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, photos.length]);

  useEffect(() => {
    if (!isOpen || !isPlaying || photos.length <= 1) return;
    const ms = Math.max(3, Math.min(30, intervalSec)) * 1000;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, ms);
    return () => window.clearInterval(timer);
  }, [isOpen, isPlaying, photos.length, intervalSec]);

  if (!isOpen) return null;

  const safeIndex = photos.length > 0 ? currentIndex % photos.length : 0;
  const activePhoto = photos[safeIndex];
  const uploadUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/#album` : '#album';

  return (
    <div
      className="fixed inset-0 h-[100dvh] overflow-hidden z-50 bg-[#141d18] text-[#fcfbf9] flex flex-col justify-between p-4 sm:p-8 select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Transmisión Foto Party en Vivo"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-[#b89753]/25 pb-3 sm:pb-4">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.26em] text-[#b89753] font-semibold truncate">
            Foto Party en Vivo · 18 Diciembre 2026
          </p>
          <h2 className="font-serif text-xl sm:text-3xl font-medium text-[#fcfbf9] truncate">
            Jessica Paiz &amp; Jorge Rodas
          </h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex(
                    (prev) => (prev - 1 + photos.length) % photos.length
                  )
                }
                aria-label="Foto anterior"
                className="w-10 h-10 rounded-full border border-[#b89753]/35 flex items-center justify-center text-[#fcfbf9] hover:bg-[#b89753]/20 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                aria-label={isPlaying ? 'Pausar carrusel' : 'Reanudar carrusel'}
                className="h-10 px-4 rounded-full border border-[#b89753]/45 flex items-center gap-2 text-xs font-medium text-[#fcfbf9] hover:bg-[#b89753]/20 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-[#b89753]" />
                    <span className="hidden sm:inline">Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-[#b89753]" />
                    <span className="hidden sm:inline">Reanudar</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((prev) => (prev + 1) % photos.length)
                }
                aria-label="Siguiente foto"
                className="w-10 h-10 rounded-full border border-[#b89753]/35 flex items-center justify-center text-[#fcfbf9] hover:bg-[#b89753]/20 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Salir de Foto Party"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[#fcfbf9] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Projection Stage */}
      <div className="flex-1 flex items-center justify-center py-6 min-h-0">
        {activePhoto ? (
          <div
            className="relative w-full h-full max-w-5xl flex items-center justify-center select-none"
            onContextMenu={(e) => e.preventDefault()}
          >
            <img
              key={activePhoto.id}
              src={activePhoto.imageData}
              alt={activePhoto.caption || `Foto compartida por ${activePhoto.guestName}`}
              onError={(e) => {
                const imgEl = e.currentTarget;
                if (
                  activePhoto.fallbackUrl &&
                  imgEl.src !== activePhoto.fallbackUrl
                ) {
                  imgEl.src = activePhoto.fallbackUrl;
                }
              }}
              draggable={false}
              className="max-h-full max-w-full object-contain rounded-xl border border-[#b89753]/35 shadow-2xl pointer-events-none select-none"
              style={{
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
            />
            {/* Protective transparent glass shield */}
            <div
              className="absolute inset-0 z-10 bg-transparent select-none"
              style={{
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        ) : (
          <div className="text-center max-w-md space-y-4">
            <div className="w-16 h-16 rounded-full border border-[#b89753]/40 flex items-center justify-center mx-auto text-[#b89753]">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="font-serif text-3xl text-[#fcfbf9]">
              Esperando las primeras fotografías
            </h3>
            <p className="text-sm text-[#fcfbf9]/70 leading-relaxed">
              Escanea el código QR con tu teléfono para compartir la primera
              foto y verla proyectada en vivo aquí.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Editorial Caption + Live QR Invite */}
      <div className="border-t border-[#b89753]/25 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left min-w-0 flex-1">
          {activePhoto ? (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-[#b89753] font-semibold">
                Compartida por {activePhoto.guestName} ·{' '}
                <span className="tabular-nums">
                  {safeIndex + 1} / {photos.length}
                </span>
              </p>
              {activePhoto.caption && (
                <p className="mt-1 font-serif italic text-xl sm:text-2xl text-[#fcfbf9]/95 truncate">
                  &ldquo;{activePhoto.caption}&rdquo;
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-[#fcfbf9]/70">
              Transmisión en tiempo real · Las nuevas fotos aparecen al instante
            </p>
          )}
        </div>

        <div className="flex items-center gap-3.5 bg-[#fcfbf9] text-[#2c3e35] rounded-xl px-3.5 py-2.5 shrink-0 border border-[#b89753]/40">
          <QRCodeSVG
            value={uploadUrl}
            size={64}
            bgColor="#fcfbf9"
            fgColor="#2c3e35"
            level="M"
          />
          <div className="text-left">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#b89753] font-semibold">
              Escanea y sube
            </p>
            <p className="font-serif text-base font-semibold leading-tight text-[#2c3e35]">
              Tu foto en vivo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
