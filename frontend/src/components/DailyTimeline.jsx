import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { motion } from 'framer-motion';

export default function DailyTimeline() {
  const { locale } = useLanguage();

  const schedule = [
    { time: '7:00 AM', label: 'Morning Greetings', emoji: '🌅' },
    { time: '8:30 AM', label: 'Tea & Medication', emoji: '☕' },
    { time: '10:00 AM', label: 'Morning Walk Check', emoji: '🚶' },
    { time: '12:30 PM', label: 'Lunch Reminder', emoji: '🍲' },
    { time: '9:00 PM', label: 'Goodnight & Summary', emoji: '🌙' }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } }
  };

  return (
    <div className="max-w-lg mx-auto py-12 px-6" data-testid="daily-timeline">
      <div className="text-center mb-10">
        <h2 className="font-display text-3xl font-bold text-ayana-text">
          Amma's <span className="highlight-primary">daily</span> rhythm
        </h2>
      </div>

      <motion.div 
        className="relative pl-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
      >
        {/* Vertical Line */}
        <div className="absolute top-4 bottom-4 left-[34px] w-0.5 bg-gradient-to-b from-ayana-primary via-ayana-accent to-ayana-secondary opacity-50 z-0"></div>

        <div className="space-y-8 relative z-10">
          {schedule.map((item, idx) => (
            <motion.div key={idx} variants={itemVariants} className="flex items-center gap-6">
              {/* Glowing Dot */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-ayana-primary/20 to-ayana-accent/20 flex items-center justify-center shrink-0 shadow-sm relative">
                <div className="w-4 h-4 bg-ayana-primary rounded-full animate-float-gentle"></div>
              </div>

              {/* Message Card */}
              <div className="flex-grow bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-ayana-line/30 px-5 py-4 transition-transform hover:scale-102 hover:shadow-md cursor-default">
                <div className="text-xs font-bold text-ayana-primary tracking-wider mb-1">{item.time}</div>
                <div className="flex items-center gap-2 text-ayana-text">
                  <span className="text-xl">{item.emoji}</span>
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className="mt-12 flex justify-center">
        <div className="bg-gradient-to-r from-ayana-primary to-ayana-accent text-white px-6 py-2 rounded-full text-sm font-bold shadow-md">
          5 interactions daily ✨
        </div>
      </div>
    </div>
  );
}
