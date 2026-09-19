"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { NestiIntro } from "./NestiIntro";

const INTRO_KEY = "nesti_intro_seen";

export function IntroWrapper() {
  const [showIntro, setShowIntro] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem(INTRO_KEY);
  });

  const handleComplete = useCallback(() => {
    sessionStorage.setItem(INTRO_KEY, "1");
    setShowIntro(false);
  }, []);

  return (
    <AnimatePresence>
      {showIntro && <NestiIntro onComplete={handleComplete} />}
    </AnimatePresence>
  );
}
