import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

const conversations = {
  en: [
    {
      incoming: 'Good morning Maa ☀️\nHow are you feeling today?',
      buttons: ['😊 Doing great', '😐 Just okay'],
      replies: {
        '😊 Doing great': 'That\'s wonderful! 💛\nDid you have your morning tea?',
        '😐 Just okay': 'Sending you a warm hug 🤗\nWant me to check again later?'
      }
    },
    {
      incoming: 'Lunch time! 🍽️\nDid Amma have lunch?',
      buttons: ['✅ Yes, ate well', '⏳ Not yet'],
      replies: {
        '✅ Yes, ate well': 'Great! Stay hydrated too 💧',
        '⏳ Not yet': 'No rush! 😊\nI\'ll check again soon.'
      }
    },
    {
      incoming: 'Goodnight Bangaram 💛\nSweet dreams!',
      buttons: ['🌙 Goodnight!', '💛 Love you too'],
      replies: {
        '🌙 Goodnight!': 'Sleep well, Maa 🌟\nSee you tomorrow!',
        '💛 Love you too': 'Your love means everything 💕\nRest well!'
      }
    }
  ],
  te: [
    {
      incoming: 'శుభోదయం అమ్మ ☀️\nఎలా ఉన్నారు?',
      buttons: ['😊 బాగున్నా', '😐 ఫర్వాలేదు'],
      replies: {
        '😊 బాగున్నా': 'అద్భుతం! 💛 చాయ్ తాగారా?',
        '😐 ఫర్వాలేదు': 'ప్రేమతో 🤗 మళ్ళీ అడుగుతా!'
      }
    }
  ],
  hi: [
    {
      incoming: 'सुप्रभात माँ ☀️\nकैसी हैं आप?',
      buttons: ['😊 बढ़िया हूँ', '😐 ठीक हूँ'],
      replies: {
        '😊 बढ़िया हूँ': 'बहुत अच्छा! 💛 चाय पी?',
        '😐 ठीक हूँ': 'प्यार भेज रही हूँ 🤗'
      }
    }
  ]
};

export default function InteractivePhoneDemo() {
  const { lang } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [messages, setMessages] = useState([]);
  const [showButtons, setShowButtons] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const activeLang = conversations[lang] ? lang : 'en';
  const currentConvo = conversations[activeLang];

  useEffect(() => {
    let t1, t2;
    setMessages([]);
    setShowButtons(false);
    setIsTyping(true);

    const step = currentStep >= currentConvo.length ? 0 : currentStep;
    if (step !== currentStep) {
      setCurrentStep(step);
      return;
    }

    const roundData = currentConvo[step];

    t1 = setTimeout(() => {
      setIsTyping(false);
      setMessages([{ id: Date.now(), type: 'incoming', text: roundData.incoming }]);
      
      t2 = setTimeout(() => {
        setShowButtons(true);
      }, 500);
    }, 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [currentStep, currentConvo]);

  useEffect(() => {
    setCurrentStep(0);
  }, [lang]);

  const handleReplyClick = (btnText) => {
    setShowButtons(false);
    setMessages(prev => [...prev, { id: Date.now(), type: 'outgoing', text: btnText }]);
    
    setTimeout(() => {
      setIsTyping(true);
      
      setTimeout(() => {
        setIsTyping(false);
        const replyText = currentConvo[currentStep].replies[btnText];
        setMessages(prev => [...prev, { id: Date.now(), type: 'incoming', text: replyText }]);
        
        setTimeout(() => {
          setCurrentStep(prev => prev + 1);
        }, 2000);
      }, 1200);
    }, 500);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-sm font-semibold text-ayana-primary animate-bounce">
        Try it yourself! 👇
      </div>
      <div className="phone-perspective" data-testid="interactive-phone-demo">
        <motion.div 
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="w-[300px] h-[620px] bg-white rounded-[40px] border-[6px] border-gray-800 shadow-2xl overflow-hidden flex flex-col relative"
          style={{ transform: 'rotateY(8deg) rotateX(2deg)' }}
        >
          <div className="flex justify-center bg-gray-800 absolute top-0 w-full z-10">
            <div className="w-28 h-7 bg-gray-800 rounded-b-2xl"></div>
          </div>

          <div className="bg-[#25D366] text-white p-3 pt-8 flex items-center gap-3 relative z-0">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">
              🤖
            </div>
            <div>
              <div className="font-semibold text-[15px]">AYANA 💛</div>
              <div className="text-[11px] opacity-90">{isTyping ? 'typing...' : 'online'}</div>
            </div>
          </div>

          <div className="bg-[#ECE5DD] flex-1 p-4 flex flex-col gap-3 overflow-y-auto pb-20">
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex flex-col max-w-[85%] ${msg.type === 'incoming' ? 'self-start' : 'self-end'}`}
                >
                  <div className={`${msg.type === 'incoming' ? 'bg-white rounded-2xl rounded-tl-sm' : 'bg-[#DCF8C6] rounded-2xl rounded-tr-sm'} text-[#111B21] text-[13px] px-3 py-2 shadow-sm relative`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <div className="text-[10px] text-gray-400 text-right mt-1 flex justify-end items-center gap-1">
                      7:05 AM {msg.type === 'outgoing' && <span className="text-[#34B7F1]">✓✓</span>}
                    </div>
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="self-start bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm"
                >
                  <div className="typing-dots flex gap-1 items-center h-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showButtons && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="flex flex-col gap-2 mt-auto pt-4"
                >
                  {currentConvo[currentStep]?.buttons.map((btn, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleReplyClick(btn)}
                      className="w-full bg-white border border-[#25D366] text-[#25D366] rounded-full py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-green-50"
                    >
                      {btn}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-[#F0F0F0] p-2 flex items-center gap-2 absolute bottom-0 w-full">
            <div className="flex-1 bg-white rounded-full px-4 py-2 text-sm text-gray-400 shadow-sm">
              Tap a button to reply...
            </div>
            <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-sm shrink-0">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M11.999 14.942c2.005 0 3.626-1.621 3.626-3.626V5.448c0-2.006-1.621-3.626-3.626-3.626-2.006 0-3.626 1.621-3.626 3.626v5.868c0 2.005 1.62 3.626 3.626 3.626zM20.266 11.316c-.504 0-.913.409-.913.913 0 4.053-3.298 7.351-7.354 7.351-4.053 0-7.351-3.298-7.351-7.351 0-.504-.408-.913-.912-.913s-.913.409-.913.913c0 4.796 3.673 8.749 8.354 9.117v3.082h-4.321c-.505 0-.914.409-.914.914s.409.913.914.913h10.457c.504 0 .913-.408.913-.913s-.409-.914-.913-.914h-4.321v-3.082c4.681-.368 8.354-4.321 8.354-9.117 0-.504-.409-.913-.913-.913z"/>
              </svg>
            </div>
          </div>
        </motion.div>
      </div>
      <div className="w-[200px] h-4 bg-black/10 blur-xl rounded-full mt-4"></div>
    </div>
  );
}
