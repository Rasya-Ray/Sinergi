"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";

const WORDS = ["WEB DEVELOPER", "FRONTEND ENGINEER", "SECURITY ANALYST", "PORTFOLIO"];
const NAMES = ["RASYA", "KELVIN", "FATHIR"];

function RotatingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % WORDS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-flex items-center justify-center overflow-hidden h-[1.2em] align-bottom relative min-w-[120px] sm:min-w-[180px] md:min-w-[240px] lg:min-w-[320px]">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
          className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs sm:text-sm md:text-base lg:text-lg tracking-[0.3em] font-mono whitespace-nowrap"
        >
          {WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function MarqueeLine({ direction, speed = 30 }: { direction: "left" | "right"; speed?: number }) {
  const text = NAMES.join("   •   ");
  const doubled = `${text}   •   ${text}   •   ${text}   •   ${text}`;

  return (
    <div className="overflow-hidden whitespace-nowrap py-3">
      <motion.div
        className="inline-block"
        animate={{ x: direction === "left" ? ["0%", "-50%"] : ["-50%", "0%"] }}
        transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
      >
        <span className="text-white/[0.04] text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-wider uppercase select-none">
          {doubled}
        </span>
      </motion.div>
    </div>
  );
}

function BackgroundMarquee() {
  return (
    <div className="absolute inset-0 flex flex-col justify-center pointer-events-none select-none overflow-hidden">
      <MarqueeLine direction="left" speed={35} />
      <div className="h-5" />
      <MarqueeLine direction="right" speed={28} />
      <div className="h-5" />
      <MarqueeLine direction="left" speed={32} />
      <div className="h-5" />
      <MarqueeLine direction="right" speed={30} />
      <div className="h-5" />
      <MarqueeLine direction="left" speed={34} />
      <div className="h-5" />
      <MarqueeLine direction="right" speed={29} />
      <div className="h-5" />
      <MarqueeLine direction="left" speed={33} />
    </div>
  );
}

export function HeroIntro() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"united" | "splitting" | "split">("united");

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const fadeOut = useTransform(scrollYProgress, [0.75, 1], [1, 0]);
  const subOpacity = useTransform(scrollYProgress, [0.35, 0.5], [0, 1]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("splitting"), 1000);
    const t2 = setTimeout(() => setPhase("split"), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div ref={containerRef} className="h-[200vh] relative">
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden bg-neo-black">
        <BackgroundMarquee />

        <motion.div style={{ opacity: fadeOut }} className="relative z-10 flex flex-col items-center justify-center w-full px-4">
          <div className="flex items-center justify-center w-full">
            <AnimatePresence mode="wait">
              {phase === "united" ? (
                <motion.h1
                  key="united"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-white tracking-tight leading-none select-none"
                >
                  NESTI
                </motion.h1>
              ) : (
                <motion.div
                  key="split"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center w-full"
                >
                  <motion.span
                    initial={{ x: 0 }}
                    animate={{ x: "-12vw" }}
                    transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
                    className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-white tracking-tight leading-none select-none inline-block"
                  >
                    NES
                  </motion.span>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.5, ease: [0.76, 0, 0.24, 1] }}
                    className="mx-0.5"
                  >
                    <RotatingWord />
                  </motion.div>

                  <motion.span
                    initial={{ x: 0 }}
                    animate={{ x: "12vw" }}
                    transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
                    className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-white tracking-tight leading-none select-none inline-block"
                  >
                    TI
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.div className="mt-6 text-center">
            <p className="text-xs sm:text-sm text-gray-500 tracking-[0.5em] font-mono uppercase">
              AI Web Security Analyst
            </p>
          </motion.div>

          <div className="mt-8 flex flex-col items-center">
            <span className="text-white/30 text-[10px] tracking-[0.3em] font-mono uppercase mb-2">Scroll</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-5 h-8 border border-white/20 rounded-full flex justify-center pt-1.5">
                <div className="w-0.5 h-1.5 bg-white/40 rounded-full" />
              </div>
              <svg className="w-4 h-4 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
