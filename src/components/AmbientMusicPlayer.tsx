import React, { useEffect, useRef, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Music, Volume2, VolumeX } from 'lucide-react';
import { WeddingConfigRecord, DEFAULT_WEDDING_CONFIG } from '../data/weddingData';
import { db } from '../firebase';
import { assembleAudioBlobUrlFromChunks } from '../utils/audioStorage';

const AUDIO_BLOB_CACHE = new Map<string, string>();

interface AmbientMusicPlayerProps {
  config: WeddingConfigRecord;
}

export const AmbientMusicPlayer: React.FC<AmbientMusicPlayerProps> = ({
  config,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const audioToken = config.customAudioUpdatedToken?.trim() ?? '';
  const audioMode = audioToken && config.customAudioMode !== 'url'
    ? 'uploaded'
    : 'url';

  const audioUrl = config.customAudioUrl?.trim() || DEFAULT_WEDDING_CONFIG.customAudioUrl || '/assets/aistudio/POR_TI_VOLARE_-_Andrea_Bocelli_Arcano_f7efb475.mp3';
  const audioMime = config.customAudioMime?.trim() || 'audio/mpeg';
  const audioTitle = config.customAudioTitle?.trim() || 'POR TI VOLARE - Andrea Bocelli / Arcano';

  const [uploadedBlobUrl, setUploadedBlobUrl] = useState<string>(() => {
    if (audioMode === 'uploaded' && audioToken && AUDIO_BLOB_CACHE.has(audioToken)) {
      return AUDIO_BLOB_CACHE.get(audioToken)!;
    }
    return '';
  });

  const loadedTokenRef = useRef<string>(
    AUDIO_BLOB_CACHE.has(audioToken) ? audioToken : ''
  );
  const loadChunksPromiseRef = useRef<Promise<string> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    let cancelled = false;

    if (audioMode !== 'uploaded' || !audioToken) {
      loadedTokenRef.current = '';
      setUploadedBlobUrl('');
      loadChunksPromiseRef.current = null;
      return;
    }

    if (AUDIO_BLOB_CACHE.has(audioToken)) {
      const cached = AUDIO_BLOB_CACHE.get(audioToken)!;
      loadedTokenRef.current = audioToken;
      setUploadedBlobUrl(cached);
      loadChunksPromiseRef.current = Promise.resolve(cached);
      return;
    }

    const loadChunks = async (): Promise<string> => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'wedding_audio_chunks'),
            where('trackToken', '==', audioToken)
          )
        );
        if (cancelled || snap.empty) return '';

        const rawChunks = snap.docs.map((d) => {
          const data = d.data();
          return {
            index: Number(data.index ?? 0),
            data: String(data.data ?? ''),
            mimeType: String(data.mimeType ?? audioMime),
          };
        });

        rawChunks.sort((a, b) => a.index - b.index);
        if (rawChunks.length === 0) return '';

        const nextUrl = assembleAudioBlobUrlFromChunks(rawChunks, audioMime);
        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return '';
        }

        AUDIO_BLOB_CACHE.set(audioToken, nextUrl);
        loadedTokenRef.current = audioToken;
        setUploadedBlobUrl(nextUrl);

        if (audioElRef.current) {
          audioElRef.current.src = nextUrl;
          audioElRef.current.load();
        }

        return nextUrl;
      } catch (err) {
        console.warn('Error loading custom audio chunks:', err);
        return '';
      }
    };

    loadChunksPromiseRef.current = loadChunks();

    return () => {
      cancelled = true;
    };
  }, [audioMode, audioToken, audioMime]);

  const resolvedCustomSrc =
    audioMode === 'uploaded'
      ? uploadedBlobUrl || (audioToken ? AUDIO_BLOB_CACHE.get(audioToken) || '' : '')
      : audioUrl;

  const startPlayback = async () => {
    let targetSrc = resolvedCustomSrc;

    if (audioMode === 'uploaded' && !targetSrc && loadChunksPromiseRef.current) {
      try {
        const resolved = await Promise.race([
          loadChunksPromiseRef.current,
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 4000)
          ),
        ]);
        if (resolved) {
          targetSrc = resolved;
        }
      } catch {}
    }

    if (targetSrc && audioElRef.current) {
      try {
        const el = audioElRef.current;
        if (el.src !== targetSrc) {
          el.src = targetSrc;
        }
        el.volume = 0.85;
        await el.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Autoplay prevented or audio load failed:', err);
        setIsPlaying(false);
      }
    }
  };

  const stopPlayback = () => {
    const el = audioElRef.current;
    if (el) {
      el.pause();
    }
    setIsPlaying(false);
  };

  const toggleMusic = async () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      await startPlayback();
    }
  };

  // Start on envelope open event
  useEffect(() => {
    const handleStartFromEnvelope = () => {
      if (!isPlayingRef.current) {
        void startPlayback();
      }
    };

    window.addEventListener('wedding:start-ambient-music', handleStartFromEnvelope);
    return () => {
      window.removeEventListener('wedding:start-ambient-music', handleStartFromEnvelope);
    };
  }, [resolvedCustomSrc]);

  // First user interaction auto-play
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!isPlayingRef.current) {
        void startPlayback();
      }
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true, passive: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true, passive: true });
    window.addEventListener('click', handleFirstInteraction, { once: true, passive: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true, passive: true });

    return cleanup;
  }, [resolvedCustomSrc]);

  useEffect(() => {
    return () => {
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5">
      <audio
        ref={audioElRef}
        src={resolvedCustomSrc}
        loop
        playsInline
        preload="auto"
        className="hidden"
      />
      <button
        type="button"
        onClick={() => void toggleMusic()}
        aria-pressed={isPlaying}
        title={audioTitle}
        aria-label={
          isPlaying
            ? `Pausar música (${audioTitle})`
            : `Reproducir música (${audioTitle})`
        }
        className={`group flex items-center gap-2.5 h-11 rounded-full border px-4 shadow-md transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b89753] ${
          isPlaying
            ? 'bg-[#2c3e35] border-[#2c3e35] text-[#fcfbf9]'
            : 'bg-white/95 backdrop-blur-sm border-[#b89753]/50 text-[#2c3e35] hover:border-[#b89753]'
        }`}
      >
        {isPlaying ? (
          <>
            <Volume2 className="w-4 h-4 text-[#b89753] shrink-0" />
            <span className="flex items-end gap-[2px] h-3.5" aria-hidden="true">
              <span className="w-[2px] h-full bg-[#b89753] rounded-full animate-eq-1" />
              <span className="w-[2px] h-full bg-[#b89753] rounded-full animate-eq-2" />
              <span className="w-[2px] h-full bg-[#b89753] rounded-full animate-eq-3" />
            </span>
            <span className="text-xs font-medium tracking-wide whitespace-nowrap">
              Música activa
            </span>
          </>
        ) : (
          <>
            <Music className="w-4 h-4 text-[#b89753] shrink-0" />
            <span className="text-xs font-medium tracking-wide whitespace-nowrap hidden sm:inline">
              Música
            </span>
            <VolumeX className="w-3.5 h-3.5 text-[#2c3e35]/45 sm:hidden" />
          </>
        )}
      </button>
    </div>
  );
};
