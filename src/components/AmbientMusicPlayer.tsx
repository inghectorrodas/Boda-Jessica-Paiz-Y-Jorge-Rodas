import React, { useEffect, useRef, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Music, Volume2, VolumeX } from 'lucide-react';
import { WeddingConfigRecord } from '../data/weddingData';
import { db } from '../firebase';
import { assembleAudioBlobUrlFromChunks } from '../utils/audioStorage';

// In-memory cache across component re-renders to ensure zero-delay playback
const AUDIO_BLOB_CACHE = new Map<string, string>();

// Gentle romantic ambient chord progression synthesized via Web Audio API
// as fallback or when the couple chooses the built-in romantic melody.
const PROGRESSION = [
  [261.63, 329.63, 392.0, 493.88], // Cmaj7
  [220.0, 261.63, 329.63, 392.0], // Am7
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [196.0, 246.94, 293.66, 392.0], // G6
];

interface AmbientMusicPlayerProps {
  config: WeddingConfigRecord;
}

export const AmbientMusicPlayer: React.FC<AmbientMusicPlayerProps> = ({
  config,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Automatically prioritize uploaded song if a track token is present
  const audioToken = config.customAudioUpdatedToken?.trim() ?? '';
  const audioMode = audioToken && config.customAudioMode !== 'url'
    ? 'uploaded'
    : (config.customAudioMode ?? 'synth');

  const audioUrl = config.customAudioUrl?.trim() ?? '';
  const audioMime = config.customAudioMime?.trim() || 'audio/mpeg';
  const audioTitle = config.customAudioTitle?.trim() || 'Música de la boda';

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

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Preload uploaded audio chunks into an in-memory Blob URL so playback can start
  // immediately when user interacts or opens the invitation envelope.
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

    if (loadedTokenRef.current === audioToken && uploadedBlobUrl) {
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

        // Ensure chunks are strictly in sequential order
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

        // Preload HTML5 audio element
        if (audioElRef.current) {
          audioElRef.current.src = nextUrl;
          audioElRef.current.load();
        }

        return nextUrl;
      } catch (err) {
        console.warn('Error loading custom audio chunks from Firestore:', err);
        return '';
      }
    };

    const task = loadChunks();
    loadChunksPromiseRef.current = task;

    return () => {
      cancelled = true;
    };
  }, [audioMode, audioToken, audioMime, uploadedBlobUrl]);

  const resolvedCustomSrc =
    audioMode === 'uploaded'
      ? uploadedBlobUrl || (audioToken ? AUDIO_BLOB_CACHE.get(audioToken) || '' : '')
      : audioMode === 'url' && audioUrl.startsWith('https://')
        ? audioUrl
        : '';

  const stopSynth = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (masterGainRef.current && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.linearRampToValueAtTime(0.0001, now + 0.35);
    }
  };

  const stopHtmlAudio = () => {
    const el = audioElRef.current;
    if (el) {
      el.pause();
    }
  };

  const playArpeggioNote = (
    ctx: AudioContext,
    destination: GainNode,
    freq: number,
    delayOffset: number
  ) => {
    const now = ctx.currentTime + delayOffset;
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(0.09, now + 0.14);
    noteGain.gain.exponentialRampToValueAtTime(0.0008, now + 2.8);

    osc.connect(noteGain);
    noteGain.connect(destination);

    osc.start(now);
    osc.stop(now + 2.9);
  };

  const startSynth = async () => {
    stopHtmlAudio();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
      const master = audioCtxRef.current.createGain();
      master.gain.value = 0.0001;

      const filter = audioCtxRef.current.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;

      master.connect(filter);
      filter.connect(audioCtxRef.current.destination);
      masterGainRef.current = master;
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (masterGainRef.current) {
      const now = ctx.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.linearRampToValueAtTime(0.42, now + 0.5);
    }

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const triggerChord = () => {
      if (!audioCtxRef.current || !masterGainRef.current) return;
      const chord = PROGRESSION[stepRef.current % PROGRESSION.length];
      chord.forEach((freq, idx) => {
        playArpeggioNote(audioCtxRef.current!, masterGainRef.current!, freq, idx * 0.42);
      });
      stepRef.current += 1;
    };

    triggerChord();
    intervalRef.current = window.setInterval(triggerChord, 3200);
  };

  const startPlayback = async () => {
    let targetSrc = resolvedCustomSrc;

    // If custom audio was configured as uploaded, wait briefly for in-flight download:
    if (audioMode === 'uploaded' && !targetSrc && loadChunksPromiseRef.current) {
      if (audioElRef.current) {
        try {
          audioElRef.current.load();
        } catch {}
      }
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
      } catch {
        // Fall back to synth on timeout
      }
    }

    if (targetSrc && audioElRef.current) {
      stopSynth();
      try {
        const el = audioElRef.current;
        if (el.src !== targetSrc) {
          el.src = targetSrc;
        }
        el.volume = 0.85;
        await el.play();
        setIsPlaying(true);
        return;
      } catch (err) {
        console.warn('HTML5 audio play rejected, using fallback synth:', err);
      }
    }

    await startSynth();
    setIsPlaying(true);
  };

  const stopPlayback = () => {
    stopHtmlAudio();
    stopSynth();
    setIsPlaying(false);
  };

  const toggleMusic = async () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      await startPlayback();
    }
  };

  // Seamlessly transition if the custom audio finishes loading while user is already playing
  useEffect(() => {
    if (!isPlayingRef.current) return;

    if (audioMode === 'uploaded' && resolvedCustomSrc && audioElRef.current) {
      stopSynth();
      const el = audioElRef.current;
      if (el.src !== resolvedCustomSrc) {
        el.src = resolvedCustomSrc;
      }
      el.volume = 0.85;
      el.play().catch(() => {
        void startSynth();
      });
    } else if (audioMode === 'synth') {
      stopHtmlAudio();
      void startSynth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioMode, resolvedCustomSrc]);

  // Listener for opening envelope
  useEffect(() => {
    const handleStartFromEnvelope = () => {
      if (!isPlayingRef.current) {
        void startPlayback().catch(() => {});
      }
    };

    window.addEventListener('wedding:start-ambient-music', handleStartFromEnvelope);
    return () => {
      window.removeEventListener('wedding:start-ambient-music', handleStartFromEnvelope);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedCustomSrc, audioMode]);

  // Automatic playback without guest intervention:
  // 1) Try autoplay immediately on mount.
  // 2) On the first touch/click anywhere on the page, automatically start playing the song!
  useEffect(() => {
    const tryAutoplay = () => {
      if (!isPlayingRef.current) {
        void startPlayback().catch(() => {});
      }
    };

    tryAutoplay();

    const handleFirstUserInteraction = () => {
      if (!isPlayingRef.current) {
        void startPlayback().catch(() => {});
      }
      cleanupInteractionListeners();
    };

    const cleanupInteractionListeners = () => {
      window.removeEventListener('pointerdown', handleFirstUserInteraction);
      window.removeEventListener('touchstart', handleFirstUserInteraction);
      window.removeEventListener('click', handleFirstUserInteraction);
      window.removeEventListener('keydown', handleFirstUserInteraction);
    };

    window.addEventListener('pointerdown', handleFirstUserInteraction, { once: true, passive: true });
    window.addEventListener('touchstart', handleFirstUserInteraction, { once: true, passive: true });
    window.addEventListener('click', handleFirstUserInteraction, { once: true, passive: true });
    window.addEventListener('keydown', handleFirstUserInteraction, { once: true, passive: true });

    return () => {
      cleanupInteractionListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedCustomSrc]);

  useEffect(() => {
    return () => {
      stopHtmlAudio();
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5">
      <audio
        ref={audioElRef}
        src={resolvedCustomSrc || undefined}
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
