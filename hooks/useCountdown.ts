"use client";

import { useEffect, useState } from "react";

export function useCountdown(endDateIso: string) {
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    function calc() {
      const diff = Math.max(
        0,
        Math.floor((new Date(endDateIso).getTime() - Date.now()) / 1000),
      );
      setSecondsRemaining(diff);
    }

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [endDateIso]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const isExpired = secondsRemaining === 0;
  const isUrgent = secondsRemaining <= 60 && secondsRemaining > 0;

  return { secondsRemaining, formatted, isExpired, isUrgent };
}
