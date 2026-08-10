import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { motion } from 'framer-motion';

export default function SeasonalBadge() {
  const { locale } = useLanguage();

  const getSeason = () => {
    const month = new Date().getMonth();
    // 0 = Jan, 11 = Dec
    if (month >= 2 && month <= 5) return { season: 'Summer', emoji: '☀️', telugu: 'వేసవి' };
    if (month >= 6 && month <= 9) return { season: 'Monsoon', emoji: '🌧️', telugu: 'వర్షాకాలం' };
    return { season: 'Winter', emoji: '❄️', telugu: 'చలికాలం' };
  };

  const { season, emoji, telugu } = getSeason();

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center" data-testid="seasonal-badge">
      <p className="text-xs font-semibold text-ayana-muted mb-3 uppercase tracking-wider">
        Not a bot. It knows the season.
      </p>
      
      <motion.div 
        className="glass rounded-full px-6 py-3 border-2 border-ayana-accent/50 shadow-md inline-flex items-center gap-3 glow-pulse"
        whileHover={{ scale: 1.05 }}
      >
        <span className="text-2xl">{emoji}</span>
        <div className="flex flex-col text-left">
          <span className="text-sm font-bold text-ayana-text leading-tight">
            {season} Mode Active
          </span>
          {locale === 'te' && (
            <span className="text-xs text-ayana-secondary font-telugu">
              {telugu} సమయం
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
