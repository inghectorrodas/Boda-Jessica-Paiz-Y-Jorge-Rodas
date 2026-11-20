import React, { useEffect, useState } from 'react';
import { COUPLE_INFO } from '../data/weddingData';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

interface CountdownTimerProps {
  targetDateISO?: string;
}

function computeTimeLeft(targetISO: string): TimeLeft {
  const target = new Date(targetISO).getTime();
  const now = Date.now();
  const diff = target - now;

  if (Number.isNaN(target) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    isPast: false,
  };
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetDateISO = COUPLE_INFO.dateISO,
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    computeTimeLeft(targetDateISO)
  );

  useEffect(() => {
    setTimeLeft(computeTimeLeft(targetDateISO));
    const timer = window.setInterval(() => {
      setTimeLeft(computeTimeLeft(targetDateISO));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [targetDateISO]);

  if (timeLeft.isPast) {
    return (
      <div className="py-6 text-center border-y border-[#b89753]/25 bg-[#f7f5f0]/70">
        <p className="font-serif text-2xl text-[#2c3e35]">
          Hoy celebramos nuestro enlace matrimonial
        </p>
      </div>
    );
  }

  const units = [
    { value: timeLeft.days, label: 'Días' },
    { value: timeLeft.hours, label: 'Horas' },
    { value: timeLeft.minutes, label: 'Minutos' },
    { value: timeLeft.seconds, label: 'Segundos' },
  ];

  return (
    <div
      className="border-y border-[#b89753]/25 bg-[#f7f5f0]/60"
      aria-label="Cuenta regresiva para la boda"
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 sm:py-7 grid grid-cols-4 divide-x divide-[#b89753]/25">
        {units.map((unit) => (
          <div key={unit.label} className="text-center px-1 sm:px-2">
            <span className="block font-serif text-2xl sm:text-4xl lg:text-5xl font-semibold text-[#2c3e35] tabular-nums tracking-tight">
              {String(unit.value).padStart(2, '0')}
            </span>
            <span className="mt-1 sm:mt-1.5 block text-[10px] sm:text-xs tracking-[0.1em] sm:tracking-[0.18em] uppercase text-[#b89753] font-medium">
              {unit.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
