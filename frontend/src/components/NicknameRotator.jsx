import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { AnimatePresence, motion } from 'framer-motion';

const nicknames = ['Amma', 'Nana', 'Thatha', 'Ammamma', 'Babai', 'Atha'];

export default function NicknameRotator() {
  const { locale } = useLanguage();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % nicknames.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex justify-center items-center py-12 px-4" data-testid="nickname-rotator">
      <motion.div 
        className="bg-white/60 backdrop-blur-xl rounded-3xl border border-ayana-line/30 p-10 shadow-lg text-center animate-float-gentle w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <p className="uppercase tracking-widest text-xs font-bold text-ayana-muted mb-2">
          Today
        </p>
        <div className="flex flex-col items-center">
          <span className="font-display text-2xl text-ayana-text mb-1">Amma hears from</span>
          
          <div className="h-16 flex items-center justify-center relative mt-2 w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={nicknames[index]}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="font-display text-4xl md:text-5xl font-bold gradient-text-warm flex items-center gap-2 absolute"
              >
                {nicknames[index]} <span className="text-3xl">✨</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
