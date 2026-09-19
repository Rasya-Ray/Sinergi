"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

function IntroLogo() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 md:w-28 md:h-28">
      <motion.path
        d="M36 4L12 36h16L24 60l28-32H36L44 4H36Z"
        fill="white"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
      />
    </svg>
  );
}

function RingElement({ delay, size }: { delay: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full border-2 border-neo-yellow/30"
      style={{ width: size, height: size }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: [0, 0.6, 0.3], scale: [0.5, 1.1, 1] }}
      transition={{ duration: 0.8, delay, ease: "easeOut" }}
    />
  );
}

export function NestiIntro({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"logo" | "text" | "settle" | "exit">("logo");

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      onComplete();
      return;
    }

    const timers = [
      setTimeout(() => setPhase("text"), 900),
      setTimeout(() => setPhase("settle"), 1500),
      setTimeout(() => setPhase("exit"), 2100),
      setTimeout(() => onComplete(), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-neo-black flex items-center justify-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative flex flex-col items-center gap-6">
        <RingElement delay={0.1} size={140} />
        <RingElement delay={0.2} size={180} />
        <RingElement delay={0.3} size={220} />

        <motion.div
          initial={{ opacity: 0, scale: 0.6, rotate: -20 }}
          animate={
            phase === "logo"
              ? { opacity: 1, scale: 1, rotate: 0 }
              : phase === "settle" || phase === "exit"
              ? { opacity: 1, scale: 1, rotate: 0 }
              : { opacity: 1, scale: 1, rotate: 0 }
          }
          transition={{
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
            ...(phase === "settle" ? { type: "spring", stiffness: 200, damping: 15 } : {}),
          }}
        >
          <IntroLogo />
        </motion.div>

        <AnimatePresence>
          {(phase === "text" || phase === "settle" || phase === "exit") && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <h1 className="text-4xl md:text-6xl font-bold text-white tracking-[0.3em]">
                NESTI
              </h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="text-sm md:text-base text-neo-yellow/60 tracking-[0.5em] mt-2 font-mono"
              >
                SECURITY
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === "exit" && (
          <motion.div
            className="absolute inset-0 bg-neo-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          />
        )}
      </div>
    </motion.div>
  );
}
