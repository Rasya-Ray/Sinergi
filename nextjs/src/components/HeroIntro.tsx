"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";

const WORDS = ["WEB DEVELOPER", "FRONTEND ENGINEER", "SECURITY ANALYST", "PORTFOLIO"];

function RotatingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % WORDS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block overflow-hidden h-[1.2em] align-bottom relative min-w-[160px] sm:min-w-[200px] md:min-w-[260px] lg:min-w-[340px]">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
          className="absolute inset-0 flex items-center justify-center text-neo-black/40 text-xs sm:text-sm md:text-base lg:text-lg tracking-[0.3em] font-mono"
        >
          {WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function HeroIntro() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const leftX = useTransform(scrollYProgress, [0, 0.3], [0, -140]);
  const rightX = useTransform(scrollYProgress, [0, 0.3], [0, 140]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.15], [0, 1]);
  const splitOpacity = useTransform(scrollYProgress, [0.15, 0.35], [0, 1]);
  const subOpacity = useTransform(scrollYProgress, [0.3, 0.5], [0, 1]);
  const fadeOut = useTransform(scrollYProgress, [0.8, 1], [1, 0]);

  const [showSplit, setShowSplit] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplit(true), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={containerRef} className="h-[200vh] relative">
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden bg-neo-black">
        <motion.div style={{ opacity: fadeOut }} className="relative flex flex-col items-center justify-center w-full px-4">
          {!showSplit ? (
            <motion.div style={{ opacity: textOpacity }} className="text-center">
              <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-neo-white tracking-tight leading-none">
                NESTI
              </h1>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center w-full max-w-6xl mx-auto">
              <motion.div
                style={{ x: leftX }}
                className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-neo-white tracking-tight leading-none"
              >
                NES
              </motion.div>

              <motion.div
                style={{ opacity: splitOpacity }}
                className="flex items-center justify-center mx-1 sm:mx-2"
              >
                <RotatingWord />
              </motion.div>

              <motion.div
                style={{ x: rightX }}
                className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-neo-white tracking-tight leading-none"
              >
                TI
              </motion.div>
            </div>
          )}

          <motion.div
            style={{ opacity: subOpacity }}
            className="mt-8 text-center"
          >
            <p className="text-xs sm:text-sm text-neo-yellow/60 tracking-[0.5em] font-mono uppercase">
              AI Web Security Analyst
            </p>
          </motion.div>

          <motion.div
            style={{ opacity: subOpacity }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-5 h-8 border border-neo-white/20 rounded-full flex justify-center pt-1.5"
            >
              <div className="w-0.5 h-1.5 bg-neo-white/40 rounded-full" />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
