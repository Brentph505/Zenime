// /hooks/useCountdown.ts
import { useState, useEffect } from 'react';

export const useCountdown = (targetDate: number | null): string => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft('');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const distance = targetDate - now;
      if (distance < 0) {
        setTimeLeft('Airing now or aired');
        return true;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(
        `${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`,
      );
      return false;
    };

    const shouldStop = updateTimer();
    if (shouldStop) return;

    const timer = setInterval(() => {
      const stop = updateTimer();
      if (stop) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
};
