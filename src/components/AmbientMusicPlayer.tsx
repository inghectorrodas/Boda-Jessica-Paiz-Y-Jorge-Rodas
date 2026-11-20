import React, { useEffect, useRef, useState } from 'react';
import { Music, Volume2, VolumeX } from 'lucide-react';

// Gentle romantic ambient chord progression synthesized via Web Audio API
// so playback never breaks due to third-party CDN or CORS issues.
const PROGRESSION = [
  [261.63, 329.63, 392.0, 493.88], // Cmaj7
  [220.0, 261.63, 329.63, 392.0], // Am7
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [196.0, 246.94, 293.66, 392.0], // G6
];

export const AmbientMusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const stepRef = useRef(0);

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

  const toggleMusic = async () => {
    if (isPlaying) {
      stopSynth();
      setIsPlaying(false);
    } else {
      await startSynth();
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    const handleStartFromEnvelope = () => {
      if (!isPlaying) {
        void startSynth().then(() => {
          setIsPlaying(true);
        }).catch(() => {});
      }
    };

    window.addEventListener('wedding:start-ambient-music', handleStartFromEnvelope);
    return () => {
      window.removeEventListener('wedding:start-ambient-music', handleStartFromEnvelope);
    };
  }, [isPlaying]);

  useEffect(() => {
    return () => {
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
      <button
        type="button"
        onClick={toggleMusic}
        aria-pressed={isPlaying}
        aria-label={isPlaying ? 'Pausar música ambiental' : 'Reproducir música ambiental'}
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
              Música ambiental
            </span>
            <VolumeX className="w-3.5 h-3.5 text-[#2c3e35]/45 sm:hidden" />
          </>
        )}
      </button>
    </div>
  );
};
